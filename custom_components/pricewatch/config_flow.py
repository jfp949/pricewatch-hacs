"""Config flow for PriceWatch integration."""
from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

from .const import (
    DOMAIN,
    CONF_SCAN_INTERVAL,
    CONF_EMAIL_NOTIFY_SERVICE,
    DEFAULT_SCAN_INTERVAL,
    DEFAULT_NOTIFY_SERVICE,
)

STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_SCAN_INTERVAL, default=DEFAULT_SCAN_INTERVAL): vol.All(
            int, vol.Range(min=1, max=24)
        ),
        vol.Optional(CONF_EMAIL_NOTIFY_SERVICE, default=DEFAULT_NOTIFY_SERVICE): str,
    }
)


class PriceWatchConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for PriceWatch."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        errors = {}

        if user_input is not None:
            return self.async_create_entry(
                title="PriceWatch",
                data={
                    **user_input,
                    "monitors": {},
                },
            )

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_DATA_SCHEMA,
            errors=errors,
            description_placeholders={
                "scan_interval_hint": "Hours between automatic price scans (1-24)",
                "notify_hint": "Your HA notify service name (e.g. notify.gmail)",
            },
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return PriceWatchOptionsFlow(config_entry)


class PriceWatchOptionsFlow(config_entries.OptionsFlow):
    """Handle options flow for PriceWatch."""

    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        """Manage options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_SCAN_INTERVAL,
                        default=self.config_entry.options.get(
                            CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL
                        ),
                    ): vol.All(int, vol.Range(min=1, max=24)),
                    vol.Optional(
                        CONF_EMAIL_NOTIFY_SERVICE,
                        default=self.config_entry.options.get(
                            CONF_EMAIL_NOTIFY_SERVICE, DEFAULT_NOTIFY_SERVICE
                        ),
                    ): str,
                }
            ),
        )
