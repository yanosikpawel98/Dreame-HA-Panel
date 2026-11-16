/* Dreame Auto Loader — jedyny zasób Lovelace dla panelu.
   Nowy kod ładowany po pełnym odświeżeniu strony HA. */
class DreameAutoCard extends HTMLElement {
  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._child = null;
    this._loading = null;
  }
  setConfig(config) {
    this._config = config || {};
    this._mount();
    if (this._child) this._child.setConfig(this._config);
  }
  set hass(hass) {
    this._hass = hass;
    if (this._child) this._child.hass = hass;
    else this._mount();
  }
  getCardSize() { return 12; }
  getGridOptions() { return {columns: 12, min_columns: 6}; }
  connectedCallback() { this._mount(); }
  async _mount() {
    if (!this._config || this._child || this._loading) return;
    this.textContent = "Ładowanie panelu Dreame…";
    this._loading = (async () => {
      const url = new URL("dreame-html-card.js", import.meta.url);
      url.searchParams.set("reload", String(Date.now()));
      await import(url.href);
      if (!customElements.get("dreame-html-card")) {
        throw new Error("Nie zarejestrowano karty dreame-html-card");
      }
      const card = document.createElement("dreame-html-card");
      card.setConfig(this._config);
      if (this._hass) card.hass = this._hass;
      this._child = card;
      this.replaceChildren(card);
    })();
    try { await this._loading; }
    catch (err) {
      this._loading = null;
      this.textContent = "Błąd ładowania Dreame: " + err.message + ". Odśwież stronę.";
    }
  }
}
if (!customElements.get("dreame-auto-card")) {
  customElements.define("dreame-auto-card", DreameAutoCard);
}
