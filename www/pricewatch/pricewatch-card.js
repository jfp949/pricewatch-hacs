class PriceWatchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._monitors = [];
    this._tab = "monitors";
    this._searching = false;
  }

  set hass(hass) {
    this._hass = hass;
    this._monitors = Object.values(hass.states)
      .filter((s) => s.entity_id.startsWith("sensor.pricewatch_"))
      .map((s) => ({
        entity_id: s.entity_id,
        product: s.attributes.product || s.entity_id,
        current_price: s.state !== "unavailable" ? parseFloat(s.state) : null,
        store: s.attributes.store,
        threshold: s.attributes.threshold,
        email: s.attributes.email,
        drop_pct: s.attributes.drop_percent,
        monitor_id: s.attributes.monitor_id,
      }));
    this._render();
  }

  setConfig(config) {
    this.config = config;
  }

  static getConfigElement() {
    return document.createElement("pricewatch-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  _callService(service, data = {}) {
    this._hass.callService("pricewatch", service, data);
  }

  _switchTab(tab) {
    this._tab = tab;
    this._render();
  }

  _handleSearch() {
    const input = this.shadowRoot.getElementById("product-input");
    const product = input?.value?.trim();
    if (!product) return;
    this._searching = true;
    this._render();
    this._callService("scan_now");
    setTimeout(() => {
      this._searching = false;
      this._render();
    }, 5000);
  }

  _handleAddMonitor() {
    const product = this.shadowRoot.getElementById("product-input")?.value?.trim();
    const email = this.shadowRoot.getElementById("alert-email")?.value?.trim();
    const threshold = parseInt(this.shadowRoot.getElementById("alert-threshold")?.value || "10");
    if (!product || !email) {
      alert("Please enter a product name and email address.");
      return;
    }
    this._callService("add_monitor", { product, email, threshold });
    this._tab = "monitors";
    this._render();
  }

  _handleRemove(monitorId) {
    if (confirm("Remove this monitor?")) {
      this._callService("remove_monitor", { monitor_id: monitorId });
    }
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :host { display: block; }
        .card {
          background: var(--ha-card-background, var(--card-background-color, #fff));
          border-radius: var(--ha-card-border-radius, 12px);
          box-shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0,0,0,0.1));
          overflow: hidden;
          font-family: var(--primary-font-family, Roboto, sans-serif);
        }
        .header {
          display: flex;
          align-items: center;
          padding: 16px 16px 0;
          gap: 10px;
        }
        .header-icon { font-size: 22px; }
        .header-title {
          flex: 1;
          font-size: 1.05rem;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .scan-btn {
          font-size: 0.75rem;
          padding: 5px 12px;
          border-radius: 6px;
          border: 1px solid var(--primary-color);
          background: transparent;
          color: var(--primary-color);
          cursor: pointer;
        }
        .scan-btn:hover { background: var(--primary-color); color: white; }
        .tabs {
          display: flex;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
          margin-top: 12px;
        }
        .tab {
          flex: 1;
          padding: 10px;
          text-align: center;
          font-size: 0.82rem;
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
        .content { padding: 16px; }
        .empty {
          text-align: center;
          padding: 2rem 1rem;
          color: var(--secondary-text-color);
          font-size: 0.85rem;
        }
        .monitor-item {
          display: flex;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
          gap: 10px;
        }
        .monitor-item:last-child { border-bottom: none; }
        .dot {
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
        }
        .monitor-meta {
          font-size: 0.72rem;
          color: var(--secondary-text-color);
          margin-top: 2px;
        }
        .monitor-price {
          text-align: right;
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .monitor-drop {
          font-size: 0.7rem;
          color: #22c55e;
          text-align: right;
        }
        .remove-btn {
          background: none;
          border: none;
          color: var(--secondary-text-color);
          cursor: pointer;
          font-size: 1rem;
          padding: 4px 6px;
          border-radius: 4px;
        }
        .remove-btn:hover { color: #ef4444; background: #fee2e2; }
        .search-row {
          display: flex;
          gap: 8px;
          margin-bottom: 14px;
        }
        input[type=text], input[type=email], input[type=number] {
          padding: 9px 12px;
          border: 1px solid var(--divider-color, #ccc);
          border-radius: 8px;
          background: var(--secondary-background-color, #f5f5f5);
          color: var(--primary-text-color);
          font-size: 0.88rem;
          outline: none;
          width: 100%;
        }
        input:focus { border-color: var(--primary-color); }
        .search-row input { flex: 1; width: auto; }
        .search-btn {
          padding: 9px 16px;
          border-radius: 8px;
          border: none;
          background: var(--primary-color);
          color: white;
          font-size: 0.85rem;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .search-btn:hover { opacity: 0.9; }
        .alert-config {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 14px;
        }
        .field label {
          display: block;
          font-size: 0.72rem;
          color: var(--secondary-text-color);
          margin-bottom: 4px;
        }
        .add-row {
          display: flex;
          justify-content: flex-end;
        }
        .add-btn {
          padding: 9px 18px;
          border-radius: 8px;
          border: none;
          background: var(--primary-color);
          color: white;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .add-btn:hover { opacity: 0.9; }
        .searching {
          text-align: center;
          padding: 1rem;
          color: var(--secondary-text-color);
          font-size: 0.85rem;
        }
      </style>

      <div class="card">
        <div class="header">
          <span class="header-icon">📡</span>
          <span class="header-title">PriceWatch</span>
          <button class="scan-btn" id="scan-btn">Scan now</button>
        </div>

        <div class="tabs">
          <div class="tab ${this._tab === "monitors" ? "active" : ""}" id="tab-monitors">
            Monitors (${this._monitors.length})
          </div>
          <div class="tab ${this._tab === "add" ? "active" : ""}" id="tab-add">
            + Add Monitor
          </div>
        </div>

        <div class="content">
          ${this._tab === "monitors" ? this._renderMonitors() : this._renderAdd()}
        </div>
      </div>
    `;

    this.shadowRoot.getElementById("scan-btn")
      ?.addEventListener("click", () => this._callService("scan_now"));
    this.shadowRoot.getElementById("tab-monitors")
      ?.addEventListener("click", () => this._switchTab("monitors"));
    this.shadowRoot.getElementById("tab-add")
      ?.addEventListener("click", () => this._switchTab("add"));

    if (this._tab === "add") {
      this.shadowRoot.getElementById("search-btn")
        ?.addEventListener("click", () => this._handleSearch());
      this.shadowRoot.getElementById("add-btn")
        ?.addEventListener("click", () => this._handleAddMonitor());
      this.shadowRoot.getElementById("product-input")
        ?.addEventListener("keydown", (e) => { if (e.key === "Enter") this._handleSearch(); });
    }

    if (this._tab === "monitors") {
      this.shadowRoot.querySelectorAll(".remove-btn").forEach((btn) => {
        btn.addEventListener("click", () => this._handleRemove(btn.dataset.id));
      });
    }
  }

  _renderMonitors() {
    if (!this._monitors.length) {
      return `<div class="empty">No monitors yet.<br>Use "+ Add Monitor" to get started.</div>`;
    }
    return this._monitors.map((m) => `
      <div class="monitor-item">
        <div class="dot"></div>
        <div class="monitor-info">
          <div class="monitor-product">${m.product}</div>
          <div class="monitor-meta">
            ${m.store ? m.store + " &nbsp;·&nbsp; " : ""}
            Alert at ${m.threshold || 10}% drop
            ${m.email ? "&nbsp;·&nbsp; " + m.email : ""}
          </div>
        </div>
        <div>
          <div class="monitor-price">
            ${m.current_price != null ? "$" + m.current_price.toFixed(2) : "—"}
          </div>
          ${m.drop_pct > 0 ? `<div class="monitor-drop">↓ ${m.drop_pct}%</div>` : ""}
        </div>
        <button class="remove-btn" data-id="${m.monitor_id}" title="Remove">✕</button>
      </div>
    `).join("");
  }

  _renderAdd() {
    return `
      <div class="search-row">
        <input id="product-input" type="text" placeholder="e.g. Sony WH-1000XM5 headphones" />
        <button class="search-btn" id="search-btn">
          ${this._searching ? "Searching…" : "Search"}
        </button>
      </div>
      ${this._searching ? `<div class="searching">🔍 Searching Australian retailers…</div>` : ""}
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
        <button class="add-btn" id="add-btn">Add Price Alert</button>
      </div>
    `;
  }

  connectedCallback() {
    this._render();
  }
}

customElements.define("pricewatch-card", PriceWatchCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "pricewatch-card",
  name: "PriceWatch",
  description: "AI-powered price monitor with email alerts",
  preview: false,
});
