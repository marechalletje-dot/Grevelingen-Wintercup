// Panelen: elk vak (kaart, tabellen, tekstvakken) kan open/dicht, groter/kleiner, maximaal en verplaatst worden.
// - Verplaatsen: sleep aan ⠿. Vakken in de pagina wisselen van plek met hun buren; zwevende vakken op de kaart (rakkenpaneel, HUD) schuiven vrij.
// - Grootte: sleep aan het hoekje rechtsonder (dubbelklik = terug naar standaard). ⤢ = schermvullend (Esc of nogmaals ⤢ = terug).
// - De indeling wordt per schermtype (telefoon / groot scherm) bewaard in de centrale store (sleutel 'layout').
export const PANELS = [
  { id: 'boot',    sel: '.rail > .r-wind',   title: 'Boot & wind' },
  { id: 'baan',    sel: '.rail > .r-course', title: 'Kies baan' },
  { id: 'gebied',  sel: '.rail > .r-area',   title: 'Startgebied' },
  { id: 'startgate', sel: '.rail > .r-sg',   title: 'Start & gate' },
  { id: 'info',    sel: '#info',             title: 'Baaninfo' },
  { id: 'stem',    sel: '.rail > .r-voice',  title: 'Stem' },
  { id: 'legenda', sel: '#legendBox',        title: 'Legenda en lagen', mobileClosed: true },
  { id: 'export',  sel: '.rail > .r-actions', title: 'Export' },
  { id: 'kaart',   sel: '#chart',            title: 'Kaart', chart: true, wrap: true },
  { id: 'rakken',  sel: '#tabKaart > .log',  title: 'Rakken (tabel)' },
  { id: 'rakpnl',  sel: '#legsPanel',        title: 'Rakken', noCollapse: true },
  { id: 'hud',     sel: '#gpsHud',           title: 'GPS', keep: '#gCdBox' },
  { id: 'legpop',  sel: '#legPop',           title: 'Legenda', noCollapse: true },
  { id: 'uitgang', sel: '#tabDeeln .dl-top > .dl-card:not(.dl-sum)', title: 'Uitgangspunten' },
  { id: 'dlsum',   sel: '#dlSum',            title: 'Samenvatting' },
  { id: 'dltabel', sel: '#tabDeeln > .tbl',  title: 'Deelnemers' },
  { id: 'dladd',   sel: '#tabDeeln > .dl-add', title: 'Boot toevoegen' },
  { id: 'wb1',     sel: '#wb1', title: 'Startvolgorde & mijn start' },
  { id: 'wb2',     sel: '#wb2', title: 'Startprocedure' },
  { id: 'wb3',     sel: '#wb3', title: 'Startlijn, startgebied & finish' },
  { id: 'wb4',     sel: '#wb4', title: 'Op de baan' },
  { id: 'wb5',     sel: '#wb5', title: 'Na de finish & scoren' },
  { id: 'wb6',     sel: '#wb6', title: 'Klassen & zeilvoering' },
  { id: 'wb7',     sel: '#wb7', title: 'Wedstrijddagen 2026/27' },
  { id: 'ug1',     sel: '#tabUitleg > .ug-card:nth-of-type(1)', title: 'Zo werkt de app' },
  { id: 'ug2',     sel: '#tabUitleg > .ug-card:nth-of-type(2)', title: 'Achtergrond: banenkaart' },
  { id: 'ug3',     sel: '#tabUitleg > .ug-card:nth-of-type(3)', title: 'Achtergrond: deelnemers' },
];
const MOBILE_ORDER = ['boot', 'baan', 'gebied', 'kaart', 'startgate', 'info', 'stem', 'export', 'legenda'];
const clone = o => JSON.parse(JSON.stringify(o || {}));

export function initPanels({ store, onResize = () => {} }) {
  const mode = () => (innerWidth < 760 ? 'm' : 'd');
  const isRace = () => document.body.classList.contains('race');
  let LAY = clone(store.state.layout);
  const L = () => (LAY[mode()] = LAY[mode()] || { p: {}, o: {} });
  const P = id => (L().p[id] = L().p[id] || {});
  const save = () => store.set({ layout: clone(LAY) });
  const els = {}; const DEF = {};
  const rail = document.querySelector('.rail'), main = document.querySelector('#tabKaart > .main');

  for (const cfg of PANELS) {
    let el = document.querySelector(cfg.sel); if (!el) continue;
    if (cfg.wrap) { const w = document.createElement('div'); w.className = 'chartwrap'; w.id = 'chartWrap'; el.parentElement.insertBefore(w, el); w.appendChild(el); el = w; }
    els[cfg.id] = el; el.classList.add('pnl'); el.dataset.pid = cfg.id;
    const isDet = el.tagName === 'DETAILS';
    let bar;
    if (isDet) { bar = el.querySelector(':scope > summary'); bar.classList.add('pbar'); }
    else { bar = document.createElement('div'); bar.className = 'pbar'; bar.innerHTML = `<span class="pt">${cfg.title}</span>`; el.insertBefore(bar, el.firstChild); }
    const hand = document.createElement('span'); hand.className = 'phand'; hand.textContent = '⠿'; hand.title = 'Sleep om te verplaatsen'; hand.setAttribute('aria-hidden', 'true');
    bar.insertBefore(hand, bar.firstChild);
    const btns = document.createElement('span'); btns.className = 'pbtns';
    if (!cfg.noCollapse && !isDet) btns.innerHTML += `<button type="button" class="pcolb" title="Open / dicht" aria-label="${cfg.title} open of dicht">▾</button>`;
    btns.innerHTML += `<button type="button" class="pmaxb" title="Schermvullend" aria-label="${cfg.title} schermvullend">⤢</button>`;
    bar.appendChild(btns);
    const grip = document.createElement('div'); grip.className = 'pgrip'; grip.title = 'Sleep om groter of kleiner te maken (dubbelklik = standaard)'; el.appendChild(grip);
    if (cfg.keep) { const k = el.querySelector(cfg.keep); k && k.classList.add('pkeep'); }
    // knoppen in een <summary> mogen het paneel niet open/dicht klappen
    for (const n of [hand, btns, grip]) { n.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); }); }
    const cb = btns.querySelector('.pcolb');
    if (cb) cb.addEventListener('click', () => { const c = !el.classList.contains('pcol'); setCol(el, c); P(cfg.id).c = c; save(); onResize(); });
    if (isDet && cfg.id === 'legenda') el.addEventListener('toggle', () => { P(cfg.id).c = !el.open; save(); });
    btns.querySelector('.pmaxb').addEventListener('click', () => toggleMax(el));
    hand.addEventListener('pointerdown', e => startMove(e, el, cfg));
    grip.addEventListener('pointerdown', e => startSize(e, el, cfg));
    grip.addEventListener('dblclick', () => { const p = P(cfg.id); delete p.w; delete p.h; if (cfg.chart) delete L().mapH; if (el.parentElement === rail && mode() === 'd') delete L().railw; save(); apply(); });
  }
  function setCol(el, c) { el.classList.toggle('pcol', c); const b = el.querySelector(':scope > .pbar .pcolb'); if (b) b.textContent = c ? '▸' : '▾'; }
  function toggleMax(el) {
    const on = !el.classList.contains('pmax'); document.querySelectorAll('.pnl.pmax').forEach(x => x.classList.remove('pmax'));
    el.classList.toggle('pmax', on); document.body.classList.toggle('has-pmax', on); setTimeout(onResize, 30);
  }
  addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.pnl.pmax')) { document.querySelectorAll('.pnl.pmax').forEach(x => x.classList.remove('pmax')); document.body.classList.remove('has-pmax'); setTimeout(onResize, 30); } });

  // Groepen een naam geven en de standaardvolgorde onthouden.
  // ---------- volgorde ----------
  const groupKey = c => c.dataset.pg || (c.dataset.pg = c.id || c.classList[0] || 'g');
  const panelKids = c => [...c.children].filter(x => x.classList.contains('pnl'));
  for (const el of Object.values(els)) { const c = el.parentElement; if (c && !DEF[groupKey(c)]) DEF[groupKey(c)] = panelKids(c).map(k => k.dataset.pid); }
  function setOrder(c, ids) {
    const kids = [...c.children]; const slots = kids.map((k, i) => (k.classList.contains('pnl') ? i : -1)).filter(i => i >= 0);
    const cur = slots.map(i => kids[i]); const want = ids.map(id => cur.find(k => k.dataset.pid === id)).filter(Boolean);
    cur.forEach(k => { if (!want.includes(k)) want.push(k); });
    slots.forEach((s, j) => { kids[s] = want[j]; }); kids.forEach(k => c.appendChild(k));
  }
  function placeChart() {
    const chart = els.kaart; if (!chart || !rail || !main) return;
    if (mode() === 'm' && !isRace()) { if (chart.parentElement !== rail) rail.insertBefore(chart, els.gebied ? els.gebied.nextSibling : null); }
    else if (chart.parentElement !== main) main.appendChild(chart);
  }

  // ---------- toepassen ----------
  function apply() {
    placeChart();
    const lay = L(); const m = mode();
    for (const g of Object.keys(DEF)) {
      const c = document.querySelector(`[data-pg="${g}"]`); if (!c) continue;
      const def = c === rail && m === 'm' && !isRace() ? MOBILE_ORDER : DEF[g];
      setOrder(c, lay.o[g] || def);
    }
    if (main) main.style.setProperty('--railw', m === 'd' && lay.railw ? lay.railw + 'px' : '');
    const map = document.getElementById('map'); if (map) map.style.height = lay.mapH ? lay.mapH + 'px' : '';
    for (const cfg of PANELS) {
      const el = els[cfg.id]; if (!el) continue; const p = lay.p[cfg.id] || {};
      const def = m === 'm' && cfg.mobileClosed;
      if (el.tagName === 'DETAILS') { if (cfg.id === 'legenda') el.open = !(p.c ?? def); }
      else setCol(el, !!p.c);
      el.style.width = p.w ? p.w + 'px' : ''; el.style.height = p.h && !cfg.chart ? p.h + 'px' : '';
      el.classList.toggle('psized', !!p.h && !cfg.chart);
      const abs = getComputedStyle(el).position === 'absolute';
      if (abs && p.x != null && el.offsetParent) {
        Object.assign(el.style, { left: (p.x * 100).toFixed(2) + '%', top: (p.y * 100).toFixed(2) + '%', right: 'auto', bottom: 'auto', transform: 'none' });
      } else if (!abs || p.x == null) { el.style.left = el.style.top = el.style.right = el.style.bottom = el.style.transform = ''; }
    }
    onResize();
  }

  // ---------- slepen: verplaatsen ----------
  function startMove(e, el, cfg) {
    if (e.button > 0 || el.classList.contains('pmax')) return; e.preventDefault(); e.stopPropagation();
    const h = document;
    const abs = getComputedStyle(el).position === 'absolute' && el.offsetParent;
    el.classList.add('pdrag'); document.body.classList.add('pdragging');
    if (abs) {
      const par = el.offsetParent, pr = par.getBoundingClientRect(), r = el.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      const mv = ev => {
        const x = Math.max(0, Math.min(pr.width - 40, ev.clientX - pr.left - dx)), y = Math.max(0, Math.min(pr.height - 24, ev.clientY - pr.top - dy));
        Object.assign(el.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto', transform: 'none' });
      };
      const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
        el.classList.remove('pdrag'); document.body.classList.remove('pdragging');
        const p = P(cfg.id); p.x = el.offsetLeft / par.clientWidth; p.y = el.offsetTop / par.clientHeight; save(); apply(); };
      h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
      return;
    }
    const c = el.parentElement; let last = { x: e.clientX, y: e.clientY };
    const html = document.documentElement; const anc = html.style.overflowAnchor; html.style.overflowAnchor = 'none';
    // automatisch scrollen zolang de vinger/muis bij de rand van het scherm staat
    const tick = setInterval(() => { const y = last.y; if (y < 60) { scrollBy(0, -12); place(last.x, y); } else if (y > innerHeight - 60) { scrollBy(0, 12); place(last.x, y); } }, 16);
    const mv = ev => { last = { x: ev.clientX, y: ev.clientY }; place(last.x, last.y); };
    const place = (x, y) => {
      const sibs = panelKids(c).filter(k => k !== el && k.offsetParent !== null);
      let before = null;
      for (const s of sibs) { const r = s.getBoundingClientRect(); if (y < r.top || (y <= r.bottom && (y < r.top + r.height / 2 || x < r.left + r.width / 2) && x <= r.right)) { before = s; break; } }
      const t0 = el.getBoundingClientRect().top;
      if (before) { if (el.nextElementSibling !== before) c.insertBefore(el, before); }
      else { const last = sibs[sibs.length - 1]; if (last && last.nextElementSibling !== el) c.insertBefore(el, last.nextSibling); }
      const d = el.getBoundingClientRect().top - t0; if (Math.abs(d) > 1) scrollBy(0, d);   // vak blijft onder de vinger
    };
    const up = () => { clearInterval(tick); html.style.overflowAnchor = anc; h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
      el.classList.remove('pdrag'); document.body.classList.remove('pdragging');
      L().o[groupKey(c)] = panelKids(c).map(k => k.dataset.pid); save(); onResize(); };
    h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  }

  // ---------- slepen: grootte ----------
  function startSize(e, el, cfg) {
    if (e.button > 0) return; e.preventDefault(); e.stopPropagation();
    const g = document;
    const r = el.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    const map = document.getElementById('map'), mh0 = map ? map.getBoundingClientRect().height : 0;
    const inRail = el.parentElement === rail && mode() === 'd' && !isRace();
    const abs = getComputedStyle(el).position === 'absolute';
    const rw0 = rail ? rail.getBoundingClientRect().width : 260;
    let res = {};
    const mv = ev => {
      const dw = ev.clientX - x0, dh = ev.clientY - y0;
      if (cfg.chart) { const h = Math.max(220, Math.round(mh0 + dh)); map.style.height = h + 'px'; res = { mapH: h }; return; }
      const h = Math.max(40, Math.round(r.height + dh)); el.style.height = h + 'px'; el.classList.add('psized'); res = { h };
      if (inRail) { const w = Math.max(220, Math.min(620, Math.round(rw0 + dw))); main.style.setProperty('--railw', w + 'px'); res.railw = w; }
      else if (abs) { const w = Math.max(160, Math.round(r.width + dw)); el.style.width = w + 'px'; res.w = w; }
    };
    const up = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
      if (res.mapH) L().mapH = res.mapH; if (res.railw) L().railw = res.railw;
      if (res.h) P(cfg.id).h = res.h; if (res.w) P(cfg.id).w = res.w; save(); onResize(); };
    g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  }

  let lastMode = mode();
  addEventListener('resize', () => { if (mode() !== lastMode) { lastMode = mode(); apply(); } });
  function reset() { LAY[mode()] = { p: {}, o: {} }; save(); location.reload(); }
  apply();
  return { apply, reset, els };
}
