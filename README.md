# 📡 PriceWatch — HACS Integration

AI-powered price monitor for Home Assistant. Track product prices across Australian retailers, get email alerts when prices drop, and view everything from your Lovelace dashboard.

---

## Features

- 🔍 AI-powered web search across JB Hi-Fi, Harvey Norman, Amazon AU, Kogan, The Good Guys, Officeworks and more
- 📉 Configurable % drop alert threshold per product
- 📧 HTML email alerts via any HA notify service (Gmail, SMTP, etc.)
- 📱 Mobile push notification support via HA Companion App
- 🕐 Scheduled automatic re-scans (every 1–24 hours, configurable)
- 🧩 Lovelace card for dashboard management
- ⚙️ Full HA service API (`add_monitor`, `remove_monitor`, `scan_now`)
- 🔥 HA event bus integration (`pricewatch_price_drop`) for custom automations

---

## Prerequisites

1. **Home Assistant** 2023.x or later
2. **HACS** installed ([hacs.xyz](https://hacs.xyz))
3. An email notify service configured in HA:
   - Gmail: `notify.gmail` via the [Google integration](https://www.home-assistant.io/integrations/google_mail/)
   - SMTP: `notify.smtp` via [SMTP notify](https://www.home-assistant.io/integrations/smtp/)

---

## Installation

### Step 1 — Add via HACS

1. Open HACS → **Integrations** → ⋮ menu → **Custom repositories**
2. Add: `https://github.com/your-repo/pricewatch-hacs`  Type: `Integration`
3. Search for **PriceWatch** and click **Download**
4. Restart Home Assistant

### Step 2 — Add the Lovelace card resource

In HA go to **Settings → Dashboards → Resources** (top right) → **Add Resource**:

```
URL:  /local/pricewatch/pricewatch-card.js
Type: JavaScript module
```

Copy `www/pricewatch/pricewatch-card.js` to your HA config: `config/www/pricewatch/`

### Step 3 — Set up the integration

1. Go to **Settings → Integrations → Add Integration**
2. Search for **PriceWatch**
3. Configure:
   - **Scan interval**: how often (in hours) to re-check prices (default: 6)
   - **Notify service**: your HA email notify service name (e.g. `notify.gmail`)
4. Click **Submit**

### Step 4 — Add automations

Copy `automations/pricewatch_email_alert.yaml` to your `config/automations/` folder.

In `configuration.yaml`:
```yaml
automation: !include_dir_merge_list automations/
```

Restart HA.

### Step 5 — Add the dashboard card

Edit your Lovelace dashboard → Add Card → search for **PriceWatch**:

```yaml
type: custom:pricewatch-card
title: Price Monitor
```

---

## Usage

### Via Lovelace Card

1. Click the **+ Add Monitor** tab
2. Type a product name (e.g. `Sony WH-1000XM5 headphones`)
3. Enter your email and set the alert threshold %
4. Click **Add Price Alert**

### Via HA Services

Open **Developer Tools → Services**:

**Add a monitor:**
```yaml
service: pricewatch.add_monitor
data:
  product: "Sony WH-1000XM5 headphones"
  email: "you@email.com"
  threshold: 15
```

**Remove a monitor:**
```yaml
service: pricewatch.remove_monitor
data:
  monitor_id: "a3f8b2c1"  # from sensor attributes
```

**Force an immediate scan:**
```yaml
service: pricewatch.scan_now
```

---

## Sensor Attributes

Each monitored product creates a sensor `sensor.pricewatch_<id>` with:

| Attribute | Description |
|---|---|
| `state` | Current cheapest price in AUD |
| `store` | Retailer with cheapest price |
| `tracked_price` | Price when monitor was created |
| `drop_percent` | % drop from tracked price |
| `threshold` | Alert trigger threshold |
| `email` | Alert recipient |
| `last_checked` | ISO timestamp of last scan |
| `all_results` | List of all retailer prices |
| `monitor_id` | 8-char ID for service calls |

---

## Custom Automations

PriceWatch fires a `pricewatch_price_drop` event on the HA event bus:

```yaml
trigger:
  - platform: event
    event_type: pricewatch_price_drop

# Event data:
#   product:      "Sony WH-1000XM5 headphones"
#   old_price:    499.00
#   new_price:    374.00
#   store:        "JB Hi-Fi"
#   drop_percent: 25.1
#   email:        "you@email.com"
```

---

## Directory Structure

```
custom_components/pricewatch/
├── __init__.py          # Integration setup & coordinator
├── config_flow.py       # UI config flow
├── const.py             # Constants
├── manifest.json        # HACS manifest
├── price_fetcher.py     # Async AI price fetcher
├── sensor.py            # Sensor platform
├── services.yaml        # Service definitions
└── strings.json         # UI strings & translations

www/pricewatch/
└── pricewatch-card.js   # Lovelace custom card

automations/
└── pricewatch_email_alert.yaml
```

---

## Troubleshooting

**Prices not updating?**
- Check HA logs for `pricewatch` errors
- Run `pricewatch.scan_now` manually
- Ensure outbound HTTPS to `api.anthropic.com` is not blocked

**Email alerts not arriving?**
- Verify your notify service name in integration options
- Check the automation is enabled in HA
- Test your notify service directly from Developer Tools

**Sensor showing unavailable?**
- A scan may have failed. Check logs and run `scan_now`
- Remove and re-add the monitor if the issue persists
