"""Sensor platform for PriceWatch — one sensor per monitored product."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import (
    DOMAIN,
    ATTR_STORE,
    ATTR_THRESHOLD,
    ATTR_TRACKED_PRICE,
    ATTR_DROP_PCT,
    ATTR_EMAIL,
    ATTR_LAST_CHECKED,
    ATTR_ALL_RESULTS,
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up PriceWatch sensors from a config entry."""
    coordinator = hass.data[DOMAIN][entry.entry_id]

    entities = [
        PriceWatchSensor(coordinator, monitor_id)
        for monitor_id in coordinator.monitors
    ]
    async_add_entities(entities, update_before_add=True)

    # Listen for new monitors added at runtime
    def _async_add_new_sensors(monitor_id: str):
        async_add_entities([PriceWatchSensor(coordinator, monitor_id)])

    coordinator.async_add_listener(lambda: None)


class PriceWatchSensor(CoordinatorEntity, SensorEntity):
    """Represents a single price-monitored product."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = "AUD"
    _attr_icon = "mdi:tag-search"

    def __init__(self, coordinator, monitor_id: str):
        super().__init__(coordinator)
        self._monitor_id = monitor_id
        monitor = coordinator.monitors.get(monitor_id, {})
        self._attr_name = f"PriceWatch: {monitor.get('product', monitor_id)}"
        self._attr_unique_id = f"{DOMAIN}_{monitor_id}"

    @property
    def _monitor_data(self) -> dict:
        if self.coordinator.data:
            return self.coordinator.data.get(self._monitor_id, {})
        return self.coordinator.monitors.get(self._monitor_id, {})

    @property
    def native_value(self):
        """Current cheapest price."""
        price = self._monitor_data.get("current_price")
        return round(float(price), 2) if price else None

    @property
    def extra_state_attributes(self) -> dict:
        data = self._monitor_data
        tracked = data.get("tracked_price") or data.get("current_price")
        current = data.get("current_price")

        drop_pct = None
        if tracked and current and tracked > 0:
            drop_pct = round((tracked - current) / tracked * 100, 1)

        return {
            ATTR_STORE: data.get("store"),
            ATTR_THRESHOLD: data.get("threshold"),
            ATTR_TRACKED_PRICE: data.get("tracked_price"),
            ATTR_DROP_PCT: drop_pct,
            ATTR_EMAIL: data.get("email"),
            ATTR_LAST_CHECKED: data.get("last_checked"),
            ATTR_ALL_RESULTS: data.get("all_results", []),
            "product": data.get("product"),
            "monitor_id": self._monitor_id,
        }

    @property
    def available(self) -> bool:
        return self._monitor_id in self.coordinator.monitors
