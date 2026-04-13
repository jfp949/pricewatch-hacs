/**
 * PriceWatch Lovelace Card
 * Place this file at: www/pricewatch/pricewatch-card.js
 * Then add to Lovelace resources as:
 *   url: /local/pricewatch/pricewatch-card.js
 *   type: module
 */

import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class PriceWatchCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _loading: { type: Boolean },
      _searching: { type: Boolean },
      _searchResults: { type: Array },
      _searchProduct: { type: String },
      _tab: { type: String },
    };
  }

  constructor() {
    super();
    this._loading = false;
    this._searching = false;
    this._searchResults = [];
    this._searchProduct = "";
    this._tab = "monitors";
  }

  setConfig(config) {
    this.config = config;
  }

  static get styles() {
    return css`
      :host {
        display: block;
        font-family: var(--primary-font-family, 'Roboto', sans-serif);
      }
      ha-card {
        background: var(--ha-card-background, var(--card-background-color, white));
        border-radius: var(--ha-card-border-radius, 12px);
        box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,0.1));
        overflow: hidden;
      }
      .card-header {
        padding: 16px 20px 0;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .card-header ha-icon {
        color: var(--primary-color);
      }
      .card-title {
        font-size: 1.1rem;
        font-weight: 500;
        color: var(--primary-text-color);
        flex: 1;
      }
      .scan-btn {
        --mdc-theme-primary: var(--primary-color);
        font-size: 0.75rem;
      }
      .tabs {
        display: flex;
        border-bottom: 1px solid var(--divider-color);
        margin-top: 12px;
      }
      .tab {
        flex: 1;
        padding: 10px;
        text-align: center;
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--secondary-text-color);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
      }
      .tab.active {
        color: var(--primary-color);
        border-bottom-color: var(--primary-color);
      }
      .content { padding: 16px 20px 20px; }

      /* Search tab */
      .search-row {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }
      .search-row input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
        font-size: 0.88rem;
        outline: none;
      }
      .search-row input:focus { border-color: var(--primary-color); }
      mwc-button { --mdc-theme-primary: var(--primary-color); }

      /* Alert config */
      .alert-config {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 12px;
      }
      .field label {
        display: block;
        font-size: 0.72rem;
        color: var(--secondary-text-color);
        margin-bottom: 4px;
      }
      .field input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
        font-size: 0.85rem;
        box-sizing: border-box;
        outline: none;
      }
      .field input:focus { border-color: var(--primary-color); }

      /* Results */
      .result-item {
        display: flex;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid var(--divider-color);
        gap: 10px;
      }
      .result-item:last-child { border-bottom: none; }
      .result-store {
        font-size: 0.7rem;
        color: var(--primary-color);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        min-width: 80px;
      }
      .result-name {
        flex: 1;
        font-size: 0.82rem;
        color: var(--secondary-text-color);
      }
      .result-price {
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--primary-text-color);
      }
      .result-price.cheapest { color: #22c55e; }
      .cheapest-badge {
        background: #dcfce7;
        color: #166534;
        font-size: 0.65rem;
        padding: 2px 6px;
        border-radius: 4px;
      }

      /* Monitor items */
      .monitor-item {
        display: flex;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid var(--divider-color);
        gap: 10px;
      }
      .monitor-item:last-child { border-bottom: none; }
      .monitor-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #22c55e;
        flex-shrink: 0;
      }
      .monitor-info { flex: 1; }
      .monitor-product {
        font-size: 0.88rem;
        font-weight: 500;
        color: var(--primary-text-color);
        margin-bottom: 2px;
      }
      .monitor-meta {
        font-size: 0.72rem;
        color: var(--secondary-text-color);
      }
      .monitor-price {
        text-align: right;
      }
      .monitor-current {
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--primary-text-color);
      }
      .monitor-alert {
        font-size: 0.7rem;
        color: var(--warning-color, #f59e0b);
      }
      .empty {
        text-align: center;
        padding: 2rem;
        color: var(--secondary-text-color);
        font-size: 0.85rem;
      }
      .add-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 12px;
        gap: 8px;
      }
    `;
  }

  get _monitors() {
    if (!this.hass) return [];
    return Object.values(this.hass.states)
      .filter((s) => s.entity_id.startsWith("sensor.pricewatch_"))
      .map((s) => ({
        entity_id: s.entity_id,
        product: s.attributes.product || s.entity_id,
        current_price: s.state !== "unavailable" ? parseFloat(s.state) : null,
        store: s.attributes.store,
        threshold: s.attributes.threshold,
        tracked_price: s.attributes.tracked_price,
        drop_pct: s.attributes.drop_percent,
        email: s.attributes.email,
        last_checked: s.attributes.last_checked,
        monitor_id: s.attributes.monitor_id,
      }));
  }

  _callService(service, data = {}) {
    this.hass.callService("pricewatch", service, data);
  }

  async _handleSearch() {
    const input = this.shadowRoot.querySelector("#product-input");
    const product = input?.value?.trim();
    if (!product) return;
    this._searchProduct = product;
    this._searching = true;
    this._searchResults = [];
    this.requestUpdate();

    // Trigger a HA service to search — result comes back via sensor state
    // For preview, we show a placeholder then resolve via hass
    this._callService("scan_now");
    setTimeout(() => {
      this._searching = false;
      this.requestUpdate();
    }, 4000);
  }

  _handleAddMonitor() {
    const emailEl = this.shadowRoot.querySelector("#alert-email");
    const thresholdEl = this.shadowRoot.querySelector("#alert-threshold");
    const product = this.shadowRoot.querySelector("#product-input")?.value?.trim();
    const email = emailEl?.value?.trim();
    const threshold = parseInt(thresholdEl?.value || "10");

    if (!product || !email) return;

    this._callService("add_monitor", { product, email, threshold });
    this._tab = "monitors";
    this.requestUpdate();
  }

  render() {
    return html`
      <ha-card>
        <div class="card-header">
          <ha-icon icon="mdi:tag-search-outline"></ha-icon>
          <span class="card-title">PriceWatch</span>
          <mwc-button
            class="scan-btn"
            dense
            @click=${() => this._callService("scan_now")}
          >Scan now</mwc-button>
        </div>

        <div class="tabs">
          <div class="tab ${this._tab === "monitors" ? "active" : ""}"
               @click=${() => { this._tab = "monitors"; this.requestUpdate(); }}>
            Monitors (${this._monitors.length})
          </div>
          <div class="tab ${this._tab === "search" ? "active" : ""}"
               @click=${() => { this._tab = "search"; this.requestUpdate(); }}>
            + Add Monitor
          </div>
        </div>

        <div class="content">
          ${this._tab === "monitors" ? this._renderMonitors() : this._renderSearch()}
        </div>
      </ha-card>
    `;
  }

  _renderMonitors() {
    const monitors = this._monitors;
    if (!monitors.length) {
      return html`<div class="empty">No monitors yet. Use the "Add Monitor" tab to get started.</div>`;
    }

    return html`
      ${monitors.map((m) => html`
        <div class="monitor-item">
          <div class="monitor-dot"></div>
          <div class="monitor-info">
            <div class="monitor-product">${m.product}</div>
            <div class="monitor-meta">
              ${m.store ? html`${m.store} &nbsp;·&nbsp;` : ""}
              Alert at ${m.threshold || 10}% drop
              ${m.email ? html`&nbsp;·&nbsp; ${m.email}` : ""}
            </div>
          </div>
          <div class="monitor-price">
            <div class="monitor-current">
              ${m.current_price != null ? `$${m.current_price.toFixed(2)}` : "—"}
            </div>
            ${m.drop_pct != null && m.drop_pct > 0
              ? html`<div class="monitor-alert">↓ ${m.drop_pct}%</div>`
              : ""}
          </div>
          <mwc-icon-button
            icon="delete"
            title="Remove monitor"
            @click=${() => this._callService("remove_monitor", { monitor_id: m.monitor_id })}
          ></mwc-icon-button>
        </div>
      `)}
    `;
  }

  _renderSearch() {
    return html`
      <div class="search-row">
        <input
          id="product-input"
          type="text"
          placeholder="e.g. Sony WH-1000XM5 headphones"
          @keydown=${(e) => e.key === "Enter" && this._handleSearch()}
        />
        <mwc-button raised @click=${this._handleSearch}>
          ${this._searching ? "Searching…" : "Search"}
        </mwc-button>
      </div>

      ${this._searching
        ? html`<div class="empty">🔍 Searching Australian retailers…</div>`
        : ""}

      <div class="alert-config">
        <div class="field">
          <label>Alert email</label>
          <input id="alert-email" type="email" placeholder="you@email.com" />
        </div>
        <div class="field">
          <label>Threshold (%)</label>
          <input id="alert-threshold" type="number" value="10" min="1" max="50" />
        </div>
      </div>

      <div class="add-row">
        <mwc-button @click=${this._handleAddMonitor}>Add Price Alert</mwc-button>
      </div>
    `;
  }
}

customElements.define("pricewatch-card", PriceWatchCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "pricewatch-card",
  name: "PriceWatch Card",
  description: "AI-powered price monitor with email alerts",
  preview: false,
});
