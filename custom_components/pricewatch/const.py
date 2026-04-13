"""Constants for PriceWatch integration."""

DOMAIN = "pricewatch"

CONF_SCAN_INTERVAL = "scan_interval"
CONF_EMAIL_NOTIFY_SERVICE = "email_notify_service"

DEFAULT_SCAN_INTERVAL = 6        # hours between price scans
DEFAULT_THRESHOLD = 10           # % drop to trigger alert
DEFAULT_NOTIFY_SERVICE = "notify"

ATTR_PRODUCT = "product"
ATTR_PRICE = "current_price"
ATTR_STORE = "store"
ATTR_THRESHOLD = "threshold"
ATTR_TRACKED_PRICE = "tracked_price"
ATTR_DROP_PCT = "drop_percent"
ATTR_EMAIL = "email"
ATTR_LAST_CHECKED = "last_checked"
ATTR_ALL_RESULTS = "all_results"

EVENT_PRICE_DROP = f"{DOMAIN}_price_drop"
