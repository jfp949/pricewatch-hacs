"""PriceWatch - AI-powered price monitor for Home Assistant."""
from __future__ import annotations

import asyncio
import logging
from datetime import timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN, CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL
from .price_fetcher import PriceFetcher

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR, Platform.NOTIFY]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up PriceWatch from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    scan_interval = entry.options.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)

    coordinator = PriceWatchCoordinator(
        hass,
        entry=entry,
        update_interval=timedelta(hours=scan_interval),
    )

    await coordinator.async_config_entry_first_refresh()

    hass.data[DOMAIN][entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Register services
    async def handle_add_monitor(call):
        """Handle the add_monitor service call."""
        product = call.data.get("product")
        email = call.data.get("email")
        threshold = call.data.get("threshold", 10)
        await coordinator.add_monitor(product, email, threshold)

    async def handle_remove_monitor(call):
        """Handle the remove_monitor service call."""
        monitor_id = call.data.get("monitor_id")
        await coordinator.remove_monitor(monitor_id)

    async def handle_scan_now(call):
        """Handle the scan_now service call."""
        await coordinator.async_refresh()

    hass.services.async_register(DOMAIN, "add_monitor", handle_add_monitor)
    hass.services.async_register(DOMAIN, "remove_monitor", handle_remove_monitor)
    hass.services.async_register(DOMAIN, "scan_now", handle_scan_now)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    if unload_ok := await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok


class PriceWatchCoordinator(DataUpdateCoordinator):
    """Manages fetching price data and triggering alerts."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, update_interval: timedelta):
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=update_interval,
        )
        self.entry = entry
        self.monitors: dict = entry.data.get("monitors", {})
        self.fetcher = PriceFetcher(hass)

    async def _async_update_data(self) -> dict:
        """Fetch latest prices for all monitored items."""
        results = {}
        try:
            for monitor_id, monitor in self.monitors.items():
                _LOGGER.debug("Scanning price for: %s", monitor["product"])
                price_data = await self.fetcher.get_cheapest_price(monitor["product"])
                results[monitor_id] = {
                    **monitor,
                    "current_price": price_data.get("cheapest_price"),
                    "store": price_data.get("store"),
                    "last_checked": price_data.get("timestamp"),
                    "all_results": price_data.get("results", []),
                }

                # Check if alert threshold is breached
                if price_data.get("cheapest_price") and monitor.get("tracked_price"):
                    drop_pct = (
                        (monitor["tracked_price"] - price_data["cheapest_price"])
                        / monitor["tracked_price"]
                        * 100
                    )
                    if drop_pct >= monitor.get("threshold", 10):
                        await self._fire_price_alert(monitor, price_data, drop_pct)
                        # Update tracked price to new low
                        self.monitors[monitor_id]["tracked_price"] = price_data["cheapest_price"]

        except Exception as err:
            raise UpdateFailed(f"Error fetching prices: {err}") from err

        return results

    async def _fire_price_alert(self, monitor: dict, price_data: dict, drop_pct: float):
        """Send a price drop notification via HA notify service."""
        message = (
            f"Price drop alert for {monitor['product']}!\n"
            f"Now: ${price_data['cheapest_price']:.2f} at {price_data['store']}\n"
            f"Was: ${monitor['tracked_price']:.2f}\n"
            f"Drop: {drop_pct:.1f}%"
        )
        _LOGGER.info("Price alert triggered: %s", message)

        # Fire HA event (can be caught by automations)
        self.hass.bus.async_fire(
            f"{DOMAIN}_price_drop",
            {
                "product": monitor["product"],
                "old_price": monitor["tracked_price"],
                "new_price": price_data["cheapest_price"],
                "store": price_data["store"],
                "drop_percent": round(drop_pct, 1),
                "email": monitor.get("email"),
            },
        )

        # Also push via HA notify if configured
        if monitor.get("email"):
            try:
                await self.hass.services.async_call(
                    "notify",
                    "notify",
                    {"title": f"PriceWatch: {monitor['product']}", "message": message},
                )
            except Exception as err:
                _LOGGER.warning("Could not send notify: %s", err)

    async def add_monitor(self, product: str, email: str, threshold: int):
        """Add a new product to monitor."""
        import uuid
        monitor_id = str(uuid.uuid4())[:8]
        price_data = await self.fetcher.get_cheapest_price(product)
        self.monitors[monitor_id] = {
            "product": product,
            "email": email,
            "threshold": threshold,
            "tracked_price": price_data.get("cheapest_price"),
            "store": price_data.get("store"),
            "added": price_data.get("timestamp"),
        }
        # Persist monitors to config entry
        self.hass.config_entries.async_update_entry(
            self.entry, data={**self.entry.data, "monitors": self.monitors}
        )
        await self.async_refresh()
        return monitor_id

    async def remove_monitor(self, monitor_id: str):
        """Remove a monitored product."""
        self.monitors.pop(monitor_id, None)
        self.hass.config_entries.async_update_entry(
            self.entry, data={**self.entry.data, "monitors": self.monitors}
        )
        await self.async_refresh()
