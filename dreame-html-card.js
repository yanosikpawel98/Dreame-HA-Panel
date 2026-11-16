/* Dreame Control Center 3.2 — custom Lovelace card (public distribution)
 * Home Assistant + Tasshack Dreame Vacuum, no Xiaomi Map Card required.
 * The SVG room overlay is calibrated from camera.l50_ultra_ae_map attributes.
 */
class DreameHtmlCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.tab = "map";
    this.selected = new Set();
    this.mapFailed = false;
    this.lastMapUrl = "";
    // Room outlines are supplied privately via the Home Assistant card config.
    this.rooms = [];
    this.groups = {
      parameters: [
        ["Tryb sprzątania", ["select.l50_ultra_ae_cleaning_mode"], "Odkurzanie, mopowanie lub obie czynności"],
        ["Siła ssania", ["select.l50_ultra_ae_suction_level"], "Reguluje moc odkurzacza"],
        ["Dozowanie wody", ["number.l50_ultra_ae_wetness_level"], "Suwak poziomu wilgotności szmatki"],
        ["Trasa sprzątania", ["select.l50_ultra_ae_cleaning_route"], "Szybka, standardowa lub dokładna"],
        ["Pranie mopów co", ["number.l50_ultra_ae_self_clean_area"], "Powierzchnia w m² między powrotami do stacji"],
        ["Sposób prania mopów", ["select.l50_ultra_ae_self_clean_frequency"], "Według powierzchni lub zadania, zależnie od modelu"],
        ["Czyszczenie szczelin", ["switch.l50_ultra_ae_gap_cleaning_extension"], "Wysuwanie mopa w wąskie miejsca"],
        ["Częstotliwość MopExtend", ["select.l50_ultra_ae_mop_extend_frequency"], "Jak często robot wysuwa mop przy krawędziach"]
      ],
      station: [
        ["Limit ładowania", ["select.l50_ultra_ae_battery_charge_level"], "Cel ładowania akumulatora; u Ciebie 80%"],
        ["Opróżnianie kurzu", ["select.l50_ultra_ae_auto_empty_mode"], "Kiedy stacja zasysa kurz z odkurzacza"],
        ["Tryb mycia mopów", ["select.l50_ultra_ae_washing_mode"], "Intensywność mycia nakładek w stacji"],
        ["Czas suszenia", ["select.l50_ultra_ae_drying_time"], "Jak długo stacja osusza mopy"],
        ["Automatyczne suszenie", ["switch.l50_ultra_ae_auto_drying"], "Suszenie nakładek po zakończeniu mycia"],
        ["Automatyczny detergent", ["switch.l50_ultra_ae_auto_add_detergent"], "Stacja sama dozuje środek czyszczący"]
      ],
      extra: [
        ["MopExtend", ["switch.l50_ultra_ae_mop_extend"], "Wysuwa mop bliżej listew i krawędzi"],
        ["SideReach", ["switch.l50_ultra_ae_side_reach"], "Wysuwa szczotkę boczną w narożnikach"],
        ["Omijanie przeszkód", ["switch.l50_ultra_ae_obstacle_avoidance"], "Rozpoznaje i omija przedmioty na podłodze"],
        ["Mopowanie pod meblami", ["switch.l50_ultra_ae_mopping_under_furnitures"], "Zwiększa zasięg mopa przy meblach"],
        ["Profile pokoi", ["switch.l50_ultra_ae_customized_cleaning"], "Indywidualne parametry dla pomieszczeń"],
        ["Blokada dziecięca", ["switch.l50_ultra_ae_child_lock"], "Blokuje przyciski fizyczne robota"]
      ]
    };
  }

  setConfig(config) {
    this.config = config || {};
    // Private room names and coordinates stay in the HA dashboard, never in GitHub.
    this.rooms = (Array.isArray(this.config.rooms) ? this.config.rooms : [])
      .map(r => ({
        id: Number(r.id),
        name: String(r.name || `Pokój ${r.id}`),
        x: Number(r.x),
        y: Number(r.y),
        p: r.p || r.outline
      }))
      .filter(r => Number.isFinite(r.id) &&
        Number.isFinite(r.x) && Number.isFinite(r.y) &&
        Array.isArray(r.p) && r.p.length >= 3 &&
        r.p.every(pt => Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite)));
    if (this.isConnected) this.build();
  }
  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot.querySelector('.dc')) this.build();
    this.update();
  }
  getCardSize() { return 12; }
  getGridOptions() { return { columns: 12, min_columns: 6 }; }
  state(id) { return this._hass?.states?.[id]?.state ?? "unavailable"; }
  stateObj(candidates) {
    const items = candidates.map(id => this._hass?.states?.[id]).filter(Boolean);
    return items.find(e => !["unknown","unavailable"].includes(e.state)) || items[0] || null;
  }
  valid(value) { return value != null && !["unknown","unavailable","none", ""].includes(String(value).toLowerCase()); }
  esc(value) {
    return String(value).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  }

  // Polish UI labels only; service calls keep original integration option values.
  polish(value) {
    if (value == null || !this.valid(value)) return "Niedostępne";
    const original = String(value).trim();
    const key = original.toLowerCase().replace(/[_-]+/g," ").replace(/\s+/g," ").trim();
    const dict = {
      "sweeping":"Odkurzanie", "vacuuming":"Odkurzanie", "vacuum":"Odkurzanie",
      "mopping":"Mopowanie", "mop":"Mopowanie",
      "sweeping and mopping":"Odkurzanie i mopowanie", "sweeping & mopping":"Odkurzanie i mopowanie",
      "vacuuming and mopping":"Odkurzanie i mopowanie", "vacuum and mop":"Odkurzanie i mopowanie",
      "sweep and mop":"Odkurzanie i mopowanie", "mopping and sweeping":"Mopowanie i odkurzanie",
      "sweeping then mopping":"Najpierw odkurzanie, potem mopowanie",
      "sweep then mop":"Najpierw odkurzanie, potem mopowanie",
      "vacuum then mop":"Najpierw odkurzanie, potem mopowanie",
      "mop after sweep":"Mopowanie po odkurzaniu", "mop after vacuum":"Mopowanie po odkurzaniu",
      "sweeping only":"Tylko odkurzanie", "vacuum only":"Tylko odkurzanie",
      "mopping only":"Tylko mopowanie", "mop only":"Tylko mopowanie",
      "standard":"Standardowa", "normal":"Standardowa", "regular":"Standardowa",
      "quick":"Szybka", "fast":"Szybka", "rapid":"Szybka", "speedy":"Szybka",
      "deep":"Dokładna", "deep cleaning":"Dokładne sprzątanie",
      "intensive":"Intensywna", "thorough":"Dokładna", "careful":"Dokładna",
      "quiet":"Cicha", "silent":"Cicha", "low noise":"Cicha", "gentle":"Delikatna",
      "strong":"Mocna", "medium":"Średnia", "low":"Niska", "high":"Wysoka",
      "max":"Maksymalna", "maximum":"Maksymalna", "max+":"Maksymalna+",
      "turbo":"Turbo", "auto":"Automatyczna", "automatic":"Automatyczna",
      "smart":"Inteligentna", "intelligent":"Inteligentna", "custom":"Niestandardowa",
      "customized":"Niestandardowa", "off":"Wyłączone", "on":"Włączone",
      "enabled":"Włączone", "disabled":"Wyłączone", "yes":"Tak", "no":"Nie",
      "none":"Brak", "never":"Nigdy", "always":"Zawsze", "default":"Domyślna",
      "balanced":"Zrównoważona", "economy":"Oszczędna", "efficient":"Wydajna",
      "daily":"Codziennie", "after each cleaning":"Po każdym sprzątaniu",
      "by area":"Według powierzchni", "area":"Powierzchnia", "by time":"Według czasu",
      "by room":"Według pokoju", "room":"Pokój", "time":"Czas",
      "installed":"Zamontowany", "removed":"Wyjęty", "not installed":"Niezamontowany",
      "full":"Pełny", "empty":"Pusty", "low water":"Mało wody",
      "low water warning":"Mało czystej wody", "no warning":"Brak ostrzeżeń",
      "no error":"Brak błędów", "charging":"Ładowanie", "docked":"W stacji",
      "cleaning":"Sprzątanie", "returning":"Powrót do stacji", "paused":"Wstrzymany",
      "idle":"Gotowy", "drying":"Suszenie", "washing":"Mycie mopów",
      "complete":"Zakończono", "completed":"Zakończono", "ready":"Gotowy",
      "unlimited":"Bez limitu", "limited":"Ograniczone", "every time":"Za każdym razem"
    };
    if (Object.prototype.hasOwnProperty.call(dict,key)) return dict[key];
    if (/^\d+(\s*%|\s*m²|\s*m2)?$/.test(key)) return original.replace(/m2/ig,'m²');
    if (/^\d+\s*(hours?|hrs?|h)$/.test(key)) return parseInt(key,10)+" godz.";
    if (/^\d+\s*(minutes?|mins?|min)$/.test(key)) return parseInt(key,10)+" min";
    if (/^\d+\s*(square meters?|sqm|m2)$/.test(key)) return parseInt(key,10)+" m²";
    // Generic translation for compound values not covered by the dictionary.
    const tokens = { "sweeping":"odkurzanie", "vacuuming":"odkurzanie", "mopping":"mopowanie",
      "and":"i", "then":"potem", "after":"po", "before":"przed", "quick":"szybka",
      "fast":"szybka", "standard":"standardowa", "intensive":"intensywna", "deep":"dokładna",
      "high":"wysoka", "low":"niska", "medium":"średnia", "strong":"mocna", "level":"poziom",
      "mode":"tryb", "cleaning":"sprzątanie", "auto":"automatyczna", "hours":"godz.", "hour":"godz.",
      "minutes":"min", "minute":"min", "times":"razy", "time":"czas", "area":"powierzchnia",
      "smart":"inteligentna", "quiet":"cicha", "water":"woda", "normal":"standardowa",
      "not":"nie", "installed":"zamontowany", "on":"włączone", "off":"wyłączone" };
    const parts = key.split(" ");
    if (parts.every(p => tokens[p] || /^\d+|%|m2|m²$/.test(p))) {
      const text = parts.map(p=>tokens[p] || p).join(" ");
      return text.charAt(0).toUpperCase()+text.slice(1);
    }
    return "Inna opcja: " + original; // Unexpected firmware value: do not invent its meaning.
  }

  fieldMarkup(items) {
    return items.map(([name, ids, help], i) => `<div class="field" data-ids="${this.esc(ids.join('|'))}">
      <div class="field-desc"><b>${this.esc(name)}</b><small>${this.esc(help)}</small></div>
      <div class="control"><span class="muted">Ładowanie…</span></div></div>`).join("");
  }
  dataRows(items) {
    return items.map(([name,id]) => `<div class="data-row"><span>${this.esc(name)}</span><b data-value="${id}">—</b></div>`).join("");
  }

  build() {
    if (!this.config || this.shadowRoot.querySelector('.dc')) return;
    const css = `
      :host{display:block;color:#edf5fd;font:13px/1.45 Inter,system-ui,-apple-system,sans-serif;--muted:#8ea3ba;--line:rgba(177,202,231,.12);--mint:#83e5b7;--blue:#94c2ff;--gold:#ffd580}
      *{box-sizing:border-box}button,select,input{font:inherit}button{cursor:pointer}
      .dc{overflow:hidden;min-width:0;background:radial-gradient(ellipse at 0 0,#223d4c 0,transparent 42%),#0e1825;border:1px solid var(--line);border-radius:21px}
      .header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:18px 19px 14px;border-bottom:1px solid var(--line)}
      .eyebrow{color:#83a9c1;letter-spacing:.17em;font-size:10px;font-weight:850}.header h2{margin:4px 0 0;font-size:21px;letter-spacing:-.045em}.chip{padding:7px 11px;border:1px solid rgba(131,229,183,.27);background:rgba(131,229,183,.08);color:var(--mint);border-radius:24px;font-size:10px;font-weight:750;white-space:nowrap}
      .hero{display:flex;align-items:center;gap:13px;margin:15px 17px 10px;padding:14px 16px;background:linear-gradient(115deg,#1e5148a8,#203142,#1e514860);border:1px solid #83e5b73f;border-radius:16px;animation:glow 3.6s ease-in-out infinite;overflow:hidden}
      .robot{width:43px;height:43px;border-radius:13px;background:#83e5b71d;color:var(--mint);display:grid;place-items:center;flex:none;font-size:25px}.hero strong{display:block;font-size:15px}.hero small{display:block;color:var(--muted);font-size:11px;margin-top:3px}.battery{margin-left:auto;font-weight:850;font-size:22px;white-space:nowrap}
      .dc[data-mode=cleaning] .hero{background:linear-gradient(110deg,#79572444,#32415a,#79572444);background-size:220% 100%;animation:slide 3s linear infinite;border-color:#ffd5807a}.dc[data-mode=cleaning] .robot{color:var(--gold);animation:wiggle 1.2s ease-in-out infinite}
      .dc[data-mode=returning] .hero{background:linear-gradient(110deg,#244b7b44,#32415a,#244b7b44);background-size:220% 100%;animation:slide 3s linear infinite;border-color:#94c2ff77}.dc[data-mode=returning] .robot{color:var(--blue)}.dc[data-mode=error] .hero{border-color:#ff7979ba;animation:alarm 1.4s ease-in-out infinite}.dc[data-mode=error] .robot{color:#ff8787}.dc[data-mode=drying] .hero{border-color:#c4a5ff8f}
      .notice{margin:9px 17px;padding:11px 12px;color:#ffdba9;background:#73532228;border:1px solid #ffd58059;border-radius:11px;font-size:11px}.notice[hidden]{display:none}
      .tabs{display:flex;gap:3px;overflow-x:auto;scrollbar-width:none;padding:9px 10px 0;border-bottom:1px solid var(--line)}.tabs::-webkit-scrollbar{display:none}.tab{flex:1;border:0;background:transparent;min-width:89px;padding:11px 8px;color:var(--muted);font-size:11px;font-weight:800;border-bottom:2px solid transparent;white-space:nowrap}.tab.active{color:var(--mint);border-bottom-color:var(--mint);background:linear-gradient(0deg,#83e5b713,transparent)}
      .page{padding:16px 17px 21px;animation:arrive .24s ease}.page[hidden]{display:none}.section-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px}.section-header h3{margin:0;font-size:16px;letter-spacing:-.025em}.sub{font-size:11px;color:var(--muted);margin-top:3px}
      .mapbox{position:relative;border:1px solid var(--line);border-radius:17px;background:radial-gradient(circle at 45% 25%,#233849,#111e2c 72%);overflow:hidden}.maphead{display:flex;align-items:center;justify-content:space-between;padding:10px 13px;border-bottom:1px solid var(--line)}.maphead strong{font-size:11px}.maphead small{color:var(--muted);font-size:10px}.mapframe{position:relative;max-width:660px;margin:0 auto;min-height:230px}.mapframe img{width:100%;height:auto;display:block;filter:brightness(.83) saturate(.77) contrast(1.08)}.mapframe svg{display:block;position:absolute;inset:0;width:100%;height:100%;overflow:visible;touch-action:manipulation}.mapframe.fallback{max-width:530px}.mapframe.fallback svg{position:relative;height:auto;aspect-ratio:620/650}.mapframe.fallback img{display:none}
      .room-shape{cursor:pointer;fill:#80dabc14;stroke:#83dbac95;stroke-width:2;vector-effect:non-scaling-stroke;transition:fill .2s,stroke .2s;pointer-events:all}.room-shape.selected{fill:#69e1a25e;stroke:#aeffce;stroke-width:3;filter:drop-shadow(0 0 5px #55c78b7a)}.room-label{pointer-events:none;fill:#e3fbef;font-weight:800;text-anchor:middle;paint-order:stroke;stroke:#142832;stroke-width:3;stroke-linejoin:round}.mapframe.fallback .room-shape{fill:#30465b;stroke:#94adbf88}.mapframe.fallback .room-shape.selected{fill:#307f6b;stroke:#a7f6cb}
      .mapinfo{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;color:var(--muted);font-size:10px;border-top:1px solid var(--line)}.dot{width:7px;height:7px;display:inline-block;border-radius:50%;background:var(--mint);box-shadow:0 0 10px var(--mint);margin-right:5px}
      .mapbar{margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:7px;flex-wrap:wrap}.smallbtn{padding:9px 10px;background:#233345;border:1px solid var(--line);border-radius:10px;color:#bed0e1;font-size:11px;font-weight:750}.smallbtn:disabled{opacity:.4}.mapactions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:10px}.primary{border:0;background:linear-gradient(110deg,#a4f2cd,#65cfa0);color:#112820;border-radius:12px;padding:12px 18px;font-size:12px;font-weight:850;box-shadow:0 8px 24px #66cfa027;flex:1;min-width:170px}.primary:disabled{opacity:.45;box-shadow:none}.minor{border:1px solid var(--line);background:#233244;color:#c4d5e5;padding:12px 13px;border-radius:12px;font-size:11px;font-weight:800}
      .param-title{margin:22px 0 11px;display:flex;align-items:center;gap:9px;font-size:14px;font-weight:850;letter-spacing:-.01em}.param-title:after{content:'';flex:1;height:1px;background:var(--line)}.cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.box{background:linear-gradient(145deg,#1c2a39,#172332);border:1px solid var(--line);padding:15px;border-radius:16px;min-width:0}.box h4{margin:0 0 10px;font-size:13px;font-weight:800}.field{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #b4cfdf13;min-width:0}.field:last-child{border-bottom:0}.field-desc{min-width:0;flex:1}.field-desc b{display:block;font-size:11px;font-weight:750}.field-desc small{display:block;font-size:10px;color:var(--muted);margin-top:4px;line-height:1.35}.control{max-width:55%;flex:none;min-width:0}.control select{width:155px;max-width:100%;background:#263749;color:#e6f1ff;padding:9px 8px;border:1px solid #accbe344;border-radius:10px;font-size:11px;outline:none}.control select option{background:#263749;color:#e6f1ff}.control input[type=number]{width:80px;max-width:100%;background:#263749;color:#e6f1ff;padding:9px;border:1px solid #accbe344;border-radius:10px}.control:has(.rangecontrol){max-width:100%;width:170px}.rangecontrol{width:100%;min-width:110px}.rangecontrol .rangevalue{text-align:right;font-size:11px;color:var(--mint);font-weight:800}.rangecontrol input{width:100%;accent-color:#83e5b7;cursor:pointer}.control button.toggle{width:42px;height:24px;background:#45576b;border:0;border-radius:30px;position:relative;transition:.22s}.toggle:before{content:'';position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#e1ebf6;transition:.22s}.toggle.on{background:#4cc391}.toggle.on:before{transform:translateX(18px)}.control button:disabled,.control select:disabled,.control input:disabled{opacity:.45;cursor:not-allowed}.missing{font-size:10px;color:#a5b4c3;font-style:italic;text-align:right}
      .metric{padding:15px;background:#1b2a38;border:1px solid var(--line);border-radius:15px}.metric label{display:block;color:var(--muted);font-size:11px}.metric strong{display:block;font-size:25px;font-weight:850;letter-spacing:-.05em;margin:4px 0}.metric small{color:var(--muted);font-size:10px}.data-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #b4cfdf13}.data-row:last-child{border-bottom:0}.data-row span{color:var(--muted);font-size:11px}.data-row b{text-align:right;font-size:11px;overflow-wrap:anywhere}.wear{padding:10px 0}.wear-top{display:flex;justify-content:space-between;font-size:11px}.wear-top span{color:var(--muted)}.track{margin-top:7px;background:#344554;height:7px;border-radius:30px;overflow:hidden}.fill{background:linear-gradient(90deg,#45ae92,#9df1c2);height:100%;width:0;transition:width .35s}.footer{border-top:1px solid var(--line);padding:12px 18px;display:flex;justify-content:space-between;gap:10px;color:#688399;font-size:10px}.toast{position:relative;margin:10px 17px;border-radius:10px;padding:10px 12px;background:#243e50;color:#d2eaf9;border:1px solid #83baff45;font-size:11px}.toast[hidden]{display:none}
      @keyframes glow{50%{box-shadow:0 0 22px #83e5b72a}}@keyframes scan{}@keyframes slide{from{background-position:110% 0}to{background-position:-110% 0}}@keyframes wiggle{50%{transform:rotate(6deg)}}@keyframes alarm{50%{box-shadow:0 0 20px #ff818155}}@keyframes arrive{from{opacity:.5;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
      @media(max-width:650px){.cols{grid-template-columns:1fr}.header{padding:14px}.page{padding:12px}.hero{margin:11px 11px 8px}.notice,.toast{margin-left:11px;margin-right:11px}.tabs{padding-left:4px;padding-right:4px}.tab{min-width:86px;font-size:10.5px;padding:11px 5px}.field-desc small{font-size:10px}.box{padding:13px}}
      @media(max-width:380px){.control select{width:138px}.battery{font-size:18px}.hero{gap:8px;padding:12px}.robot{width:35px;height:35px}}
      @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
    `;

    this.shadowRoot.innerHTML = `<style>${css}</style>
      <div class="dc" data-mode="ready">
        <div class="header"><div><div class="eyebrow">DREAME / CONTROL CENTER 3.1</div><h2>L50 Ultra AE</h2></div><span class="chip" id="online">● Połączony</span></div>
        <div class="hero"><div class="robot">◉</div><div><strong id="status">W stacji</strong><small id="substatus">Limit ładowania 80%</small></div><div class="battery" id="battery">—</div></div>
        <div class="notice" id="alerts" hidden></div><div class="toast" id="toast" hidden></div>
        <nav class="tabs"><button type="button" class="tab active" data-tab="map">▦ Mapa</button><button type="button" class="tab" data-tab="info">◉ Informacje</button><button type="button" class="tab" data-tab="settings">⚙ Ustawienia</button><button type="button" class="tab" data-tab="diagnostics">♡ Diagnostyka</button></nav>
        <section class="page" data-page="map">
          <div class="section-header"><div><h3>Mapa mieszkania</h3><div class="sub">Dotknij pomieszczeń na mapie. Przesuwanie zablokowane.</div></div><span class="chip">6 POKOI</span></div>
          <div class="mapbox"><div class="maphead"><strong>DOM / MAPA NA ŻYWO</strong><small id="mapType">Trwa wczytywanie</small></div>
            <div class="mapframe fallback" id="mapframe"><img id="mapimage" alt="Mapa odkurzacza" style="display:none"><svg id="overlay" viewBox="0 0 620 650" aria-label="Mapa z interaktywnymi pomieszczeniami"></svg></div>
            <div class="mapinfo"><span><span class="dot"></span><span id="mapstatus">Mapa przygotowana</span></span><span>Dotknij pokój, aby zaznaczyć</span></div></div>
          <div class="mapbar"><span class="sub" id="roomCount">Nie zaznaczono pokoi</span><div><button type="button" class="smallbtn" data-action="all">Cały dom</button> <button type="button" class="smallbtn" data-action="clear">Wyczyść</button></div></div>
          <div class="mapactions"><button type="button" class="primary" data-action="clean" id="cleanButton" disabled>Sprzątaj zaznaczone pokoje</button><button type="button" class="minor" data-action="pause">Ⅱ Pauza</button><button type="button" class="minor" data-action="home">⌂ Stacja</button></div>
          <div class="param-title">◫ PARAMETRY SPRZĄTANIA</div>
          <div class="cols"><div class="box"><h4>Odkurzanie i nawigacja</h4>${this.fieldMarkup([this.groups.parameters[0],this.groups.parameters[1],this.groups.parameters[3]])}</div>
          <div class="box"><h4>Mopowanie i krawędzie</h4>${this.fieldMarkup([this.groups.parameters[2],...this.groups.parameters.slice(4)])}</div></div>
        </section>
        <section class="page" data-page="info" hidden>
          <div class="section-header"><h3>Informacje o robocie</h3><span class="chip">NA ŻYWO</span></div>
          <div class="cols"><div class="metric"><label>Akumulator</label><strong data-metric="sensor.l50_ultra_ae_battery_level">—</strong><small id="batteryLimit">Cel ładowania: 80%</small></div>
          <div class="metric"><label>Posprzątana powierzchnia</label><strong data-metric="sensor.l50_ultra_ae_cleaned_area">—</strong><small>Ostatnie zadanie</small></div>
          <div class="metric"><label>Łącznie posprzątane</label><strong data-metric="sensor.l50_ultra_ae_total_cleaned_area">—</strong><small>Dane z integracji</small></div>
          <div class="metric"><label>Liczba sprzątań</label><strong data-metric="sensor.l50_ultra_ae_cleaning_count">—</strong><small>Historia robota</small></div></div>
          <div class="box" style="margin-top:12px"><h4>Aktualna praca</h4>${this.dataRows([["Pomieszczenie","sensor.l50_ultra_ae_current_room"],["Czas sprzątania","sensor.l50_ultra_ae_cleaning_time"],["Status robota","sensor.l50_ultra_ae_status"],["Status stacji","sensor.l50_ultra_ae_self_wash_base_status"],["Czas suszenia pozostały","sensor.l50_ultra_ae_drying_left"]])}</div>
        </section>
        <section class="page" data-page="settings" hidden><div class="section-header"><div><h3>Ustawienia</h3><div class="sub">Opisy wyjaśniają działanie każdej funkcji</div></div></div>
          <div class="cols"><div class="box"><h4>Stacja i akumulator</h4>${this.fieldMarkup(this.groups.station)}</div>
          <div class="box"><h4>Funkcje dodatkowe</h4>${this.fieldMarkup(this.groups.extra)}</div></div>
        </section>
        <section class="page" data-page="diagnostics" hidden><div class="section-header"><h3>Diagnostyka i konserwacja</h3><span class="chip" id="health">● Stan OK</span></div>
          <div class="cols"><div class="box"><h4>Robot i stacja</h4>${this.dataRows([["Problem","binary_sensor.l50_ultra_ae_problem"],["Kod błędu","sensor.l50_ultra_ae_error"],["Firmware","sensor.l50_ultra_ae_firmware_version"],["Czysta woda","sensor.l50_ultra_ae_clean_water_tank_status"],["Brudna woda","sensor.l50_ultra_ae_dirty_water_tank_status"],["Ostrzeżenie wody","sensor.l50_ultra_ae_low_water_warning"],["Worek na kurz","sensor.l50_ultra_ae_dust_bag_status"],["Detergent","sensor.l50_ultra_ae_detergent_status"],["Ładowanie","sensor.l50_ultra_ae_charging_status"]])}</div>
          <div class="box"><h4>Stan elementów eksploatacyjnych</h4>${[["Filtr","sensor.l50_ultra_ae_filter_left"],["Szczotka główna","sensor.l50_ultra_ae_main_brush_left"],["Szczotka boczna","sensor.l50_ultra_ae_side_brush_left"],["Czujniki","sensor.l50_ultra_ae_sensor_dirty_left"],["Koła","sensor.l50_ultra_ae_wheel_dirty_left"]].map(([name,id])=>`<div class="wear"><div class="wear-top"><span>${name}</span><b data-wear-text="${id}">—</b></div><div class="track"><div class="fill" data-wear="${id}"></div></div></div>`).join('')}</div></div>
        </section>
        <div class="footer"><span>DREAME · YANO HOME</span><span>Własna karta HTML · bez Xiaomi Map Card</span></div>
      </div>`;

    this.shadowRoot.getElementById('mapimage').addEventListener('load', () => {this.mapFailed = false; this.renderMap();});
    this.shadowRoot.getElementById('mapimage').addEventListener('error', () => {this.mapFailed = true; this.renderMap();});
    this.shadowRoot.addEventListener('click', e => this.handleClick(e));
    this.shadowRoot.addEventListener('input', e => {
      if (e.target.matches('input[type=range]')) {
        const value = e.target.closest('.rangecontrol')?.querySelector('.rangevalue');
        if (value) value.textContent = e.target.value;
      }
    });
    this.shadowRoot.addEventListener('change', e => this.handleChange(e));
    this.update();
  }

  // Determine an affine image calibration from three non-collinear camera points.
  calibration(points) {
    if (!Array.isArray(points) || points.length < 3) return null;
    const norm = p => {
      const v=p.vacuum, m=p.map;
      const vx=Number(Array.isArray(v)?v[0]:v?.x), vy=Number(Array.isArray(v)?v[1]:v?.y);
      const mx=Number(Array.isArray(m)?m[0]:m?.x), my=Number(Array.isArray(m)?m[1]:m?.y);
      return [vx,vy,mx,my];
    };
    const a=points.map(norm).filter(x=>x.every(Number.isFinite));
    let chosen=null, best=0;
    for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)for(let k=j+1;k<a.length;k++){
      const A=a[i],B=a[j],C=a[k];
      const d=(B[0]-A[0])*(C[1]-A[1])-(C[0]-A[0])*(B[1]-A[1]);
      if(Math.abs(d)>best){best=Math.abs(d);chosen=[A,B,C,d];}
    }
    if(!chosen || best<1e-7) return null;
    const [A,B,C,d]=chosen;
    const ax=((B[2]-A[2])*(C[1]-A[1])-(C[2]-A[2])*(B[1]-A[1]))/d;
    const bx=((B[0]-A[0])*(C[2]-A[2])-(C[0]-A[0])*(B[2]-A[2]))/d;
    const ay=((B[3]-A[3])*(C[1]-A[1])-(C[3]-A[3])*(B[1]-A[1]))/d;
    const by=((B[0]-A[0])*(C[3]-A[3])-(C[0]-A[0])*(B[3]-A[3]))/d;
    return (x,y) => [A[2]+ax*(x-A[0])+bx*(y-A[1]), A[3]+ay*(x-A[0])+by*(y-A[1])];
  }

  renderMap() {
    const svg=this.shadowRoot.getElementById('overlay');
    if(!svg) return;
    const img=this.shadowRoot.getElementById('mapimage');
    const cam=this._hass?.states?.['camera.l50_ultra_ae_map'];
    const points=cam?.attributes?.calibration_points || cam?.attributes?.calibration;
    const transform=this.calibration(points);
    const live=Boolean(transform && img.complete && img.naturalWidth > 0 && !this.mapFailed);
    const width=live?img.naturalWidth:620, height=live?img.naturalHeight:650;
    const mapPoint=live?transform:(x,y)=>[(x+6450)/10300*580+15,(5350-y)/10900*605+15];
    const fontsize=live?Math.max(10,Math.min(22,width/35)):16;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    this.shadowRoot.getElementById('mapframe').classList.toggle('fallback',!live);
    img.style.display=live?'block':'none';
    this.shadowRoot.getElementById('mapType').textContent=live?'MAPA DREAME · WŁASNA NAKŁADKA':'WŁASNY PLAN POMIESZCZEŃ';
    this.shadowRoot.getElementById('mapstatus').textContent=live?'Kalibracja z kamery HA':'Schemat na podstawie zapisanych obrysów';
    const ns='http://www.w3.org/2000/svg';
    svg.replaceChildren();
    for(const room of this.rooms){
      const g=document.createElementNS(ns,'g'); g.setAttribute('data-room',String(room.id));
      const poly=document.createElementNS(ns,'polygon');
      poly.setAttribute('points',room.p.map(p=>mapPoint(...p).map(v=>Number(v.toFixed(2))).join(',')).join(' '));
      poly.setAttribute('class','room-shape'+(this.selected.has(room.id)?' selected':''));
      poly.setAttribute('role','button'); poly.setAttribute('tabindex','0');
      poly.setAttribute('aria-label',room.name);
      const [x,y]=mapPoint(room.x,room.y);
      const label=document.createElementNS(ns,'text');label.setAttribute('x',x);label.setAttribute('y',y);
      label.setAttribute('class','room-label');label.setAttribute('font-size',fontsize);
      label.textContent=room.name;
      g.append(poly,label);svg.append(g);
    }
  }

  updateMap() {
    const img=this.shadowRoot.getElementById('mapimage');
    if(!img) return;
    const camera=this._hass?.states?.['camera.l50_ultra_ae_map'];
    const picture=camera?.attributes?.entity_picture;
    if(picture && picture!==this.lastMapUrl){
      this.lastMapUrl=picture;
      this.mapFailed=false;
      const url=this._hass?.hassUrl?this._hass.hassUrl(picture):picture;
      img.src=url;
    }
    this.renderMap();
  }

  async perform(domain, action, data={}, target={entity_id:'vacuum.l50_ultra_ae'}) {
    try {
      await this._hass.callService(domain,action,data,target);
      this.toast('Polecenie wysłane do robota.');
    } catch(err){this.toast('Nie udało się wykonać polecenia: '+(err?.message||err),true);}
  }
  toast(message,error=false){
    const el=this.shadowRoot.getElementById('toast');
    el.hidden=false;el.textContent=(error?'⚠ ':'✓ ')+message;
    el.style.borderColor=error?'#ff888888':'#83baff45';
  }
  handleClick(e) {
    const tab=e.target.closest('[data-tab]');
    if(tab){this.tab=tab.dataset.tab;this.shadowRoot.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===tab));this.shadowRoot.querySelectorAll('[data-page]').forEach(x=>x.hidden=x.dataset.page!==this.tab);return;}
    const room=e.target.closest('[data-room]');
    if(room){const id=Number(room.dataset.room);this.selected.has(id)?this.selected.delete(id):this.selected.add(id);this.renderMap();this.updateSelected();return;}
    const btn=e.target.closest('button');
    if(!btn)return;
    if(btn.classList.contains('toggle')){
      const id=btn.dataset.entity;
      if(!id||btn.disabled)return;
      this.perform('switch',btn.classList.contains('on')?'turn_off':'turn_on',{}, {entity_id:id});return;
    }
    if(btn.dataset.action==='all'){this.rooms.forEach(r=>this.selected.add(r.id));this.renderMap();this.updateSelected();}
    if(btn.dataset.action==='clear'){this.selected.clear();this.renderMap();this.updateSelected();}
    if(btn.dataset.action==='clean' && this.selected.size){
      this.perform('dreame_vacuum','vacuum_clean_segment',{segments:[...this.selected].sort((a,b)=>a-b)}, {entity_id:'vacuum.l50_ultra_ae'});
    }
    if(btn.dataset.action==='pause')this.perform('vacuum','pause');
    if(btn.dataset.action==='home')this.perform('vacuum','return_to_base');
  }
  handleChange(e){
    const field=e.target.closest('.field');if(!field)return;
    const id=e.target.dataset.entity;if(!id || e.target.disabled)return;
    if(e.target.matches('select'))this.perform('select','select_option',{option:e.target.value},{entity_id:id});
    if(e.target.matches('input[type=range],input[type=number]'))this.perform('number','set_value',{value:Number(e.target.value)},{entity_id:id});
  }
  updateSelected(){
    const count=this.selected.size;
    this.shadowRoot.getElementById('roomCount').textContent=count?`Zaznaczono: ${count} z 6 pokoi`:'Nie zaznaczono pokoi';
    const btn=this.shadowRoot.getElementById('cleanButton');
    btn.disabled=!count;btn.textContent=count?`Sprzątaj zaznaczone (${count})`:'Sprzątaj zaznaczone pokoje';
  }

  updateFields() {
    this.shadowRoot.querySelectorAll('.field').forEach(field=>{
      const ids=field.dataset.ids.split('|');
      const entity=this.stateObj(ids);
      const host=field.querySelector('.control');
      if(!entity){if(host.dataset.id!=='missing'){host.replaceChildren();const sp=document.createElement('span');sp.className='missing';sp.textContent='Brak encji';host.append(sp);host.dataset.id='missing';}return;}
      const id=entity.entity_id,domain=id.split('.')[0],value=entity.state;
      const available=this.valid(value);
      if(host.dataset.id!==id){
        host.dataset.id=id;host.replaceChildren();
        if(domain==='switch'){
          const el=document.createElement('button');el.type='button';el.className='toggle';el.dataset.entity=id;el.setAttribute('role','switch');el.setAttribute('aria-label',field.querySelector('b').textContent);host.append(el);
        }else if(domain==='select'){
          const el=document.createElement('select');el.dataset.entity=id;el.setAttribute('aria-label',field.querySelector('b').textContent);host.append(el);
        }else if(domain==='number'){
          if(id==='number.l50_ultra_ae_wetness_level'){
            const wrap=document.createElement('div');wrap.className='rangecontrol';
            const label=document.createElement('div');label.className='rangevalue';label.textContent=value;
            const el=document.createElement('input');el.type='range';el.dataset.entity=id;el.setAttribute('aria-label',field.querySelector('b').textContent);
            wrap.append(label,el);host.append(wrap);
          }else{
            const el=document.createElement('input');el.type='number';el.dataset.entity=id;el.setAttribute('aria-label',field.querySelector('b').textContent);host.append(el);
          }
        }
      }
      const el=host.querySelector('button,select,input');if(!el)return;
      el.disabled=!available;
      if(domain==='switch'){
        el.classList.toggle('on',value==='on');el.setAttribute('aria-checked',String(value==='on'));
      }else if(domain==='select'){
        const options=entity.attributes?.options || [];
        const signature=JSON.stringify(options);
        if(el.dataset.signature!==signature){
          el.replaceChildren(...options.map(o=>{const option=document.createElement('option');option.value=o;option.textContent=this.polish(o);return option;}));
          el.dataset.signature=signature;
        }
        if(this.shadowRoot.activeElement!==el)el.value=value;
      }else if(domain==='number'){
        const attrs=entity.attributes||{};
        if(attrs.min!=null)el.min=attrs.min;if(attrs.max!=null)el.max=attrs.max;
        if(attrs.step!=null)el.step=attrs.step;
        if(this.shadowRoot.activeElement!==el)el.value=available?value:'';
        const out=host.querySelector('.rangevalue');if(out && this.shadowRoot.activeElement!==el)out.textContent=available?value:'—';
      }
    });
  }

  update(){
    if(!this._hass||!this.shadowRoot.querySelector('.dc'))return;
    const s=id=>this.state(id);
    const v=s('vacuum.l50_ultra_ae'), phase=s('sensor.l50_ultra_ae_state'),charge=s('sensor.l50_ultra_ae_charging_status');
    const battery=Number(s('sensor.l50_ultra_ae_battery_level'));
    const limit=parseInt(s('select.l50_ultra_ae_battery_charge_level'),10)||80;
    const err=s('binary_sensor.l50_ultra_ae_problem')==='on'||v==='error';
    let label='Gotowy';
    if(v==='unavailable')label='Offline';else if(err)label='Wymagana uwaga';
    else if(v==='cleaning')label='Sprzątanie';else if(v==='paused')label='Wstrzymany';
    else if(v==='returning')label='Wraca do stacji';else if(phase==='drying')label='Suszenie mopów';
    else if(v==='docked'&&Number.isFinite(battery)&&battery>=limit)label=`Osiągnięto limit ${limit}%`;
    else if(v==='docked'&&charge==='charging')label='Ładowanie';else if(v==='docked')label='W stacji';
    const dc=this.shadowRoot.querySelector('.dc');dc.dataset.mode=err?'error':v==='cleaning'?'cleaning':v==='returning'?'returning':phase==='drying'?'drying':'ready';
    this.shadowRoot.getElementById('status').textContent=label;
    this.shadowRoot.getElementById('substatus').textContent=v==='cleaning'?`Pokój: ${this.polish(s('sensor.l50_ultra_ae_current_room'))}`:`Ustawiony limit ładowania: ${limit}%`;
    this.shadowRoot.getElementById('battery').textContent=this.valid(s('sensor.l50_ultra_ae_battery_level'))?battery+'%':'—';
    this.shadowRoot.getElementById('online').textContent=v==='unavailable'?'● Offline':'● Połączony';
    this.shadowRoot.getElementById('batteryLimit').textContent=`Limit ładowania: ${limit}%`;
    const alerts=[];
    const water=s('sensor.l50_ultra_ae_low_water_warning').toLowerCase();
    const dirty=s('sensor.l50_ultra_ae_dirty_water_tank_status').toLowerCase();
    const clean=s('sensor.l50_ultra_ae_clean_water_tank_status').toLowerCase();
    const error=s('sensor.l50_ultra_ae_error').toLowerCase();
    const noAlert=new Set(['no_warning','no warning','none','off','false','0','unknown','unavailable','no_error','no error']);
    if(!noAlert.has(water))alerts.push('💧 Sprawdź czystą wodę');
    if(['empty','low','low_water'].includes(clean))alerts.push('💧 Uzupełnij czystą wodę');
    if(dirty==='full')alerts.push('🪣 Wylej brudną wodę');
    else if(this.valid(dirty) && !['installed','normal','ok'].includes(dirty))alerts.push('🪣 Sprawdź zbiornik brudnej wody');
    if(!noAlert.has(error))alerts.push('⚠ Błąd robota: '+this.polish(error));
    if(err && !alerts.length)alerts.push('⚠ Robot wymaga uwagi');
    const alertEl=this.shadowRoot.getElementById('alerts');alertEl.hidden=!alerts.length;alertEl.textContent=[...new Set(alerts)].join(' · ');
    this.shadowRoot.getElementById('health').textContent=alerts.length?'● Sprawdź robota':'● Stan OK';
    for(const el of this.shadowRoot.querySelectorAll('[data-value]')){
      const value=s(el.dataset.value);
      el.textContent=el.dataset.value.startsWith('binary_sensor.')?(value==='on'?'Tak':value==='off'?'Nie':'—'):this.valid(value)?this.polish(value):'—';
    }
    for(const el of this.shadowRoot.querySelectorAll('[data-metric]')){
      const id=el.dataset.metric,value=s(id);
      el.textContent=this.valid(value)?(value+(id.includes('battery')?'%':id.includes('area')?' m²':'')):'—';
    }
    for(const el of this.shadowRoot.querySelectorAll('[data-wear]')){
      const raw=s(el.dataset.wear),val=parseFloat(raw);
      el.style.width=this.valid(raw)&&Number.isFinite(val)?Math.max(0,Math.min(100,val))+'%':'0%';
    }
    for(const el of this.shadowRoot.querySelectorAll('[data-wear-text]')){
      const raw=s(el.dataset.wearText);el.textContent=this.valid(raw)?raw+'%':'—';
    }
    this.updateFields();this.updateMap();this.updateSelected();
  }
}
if(!customElements.get('dreame-html-card')) customElements.define('dreame-html-card',DreameHtmlCard);