// Zeilkeuze: bereiken per zeil uit de sail selection crossover chart van Dream Machine (alleen data + puur rekenwerk).
// Bron: artifact "Dream Machine – sail selection crossover chart". Alleen J3 (31,05 m²), S2 (103 m²) en de VMG-hoeken
// komen uit het ORC-certificaat; de overige bereiken en oppervlaktes zijn schattingen (controleren met de zeilmaker).
// tws = [van, tot] in kn ware wind, twa = [van, tot] in graden ware windhoek (0 = recht in de wind, 180 = recht voor de wind).

export const SAILS = {
  dm: [
    { id: 'J3LM', name: 'J3 L/M', area: '≈31 m²', tws: [0, 13], twa: [38, 95], aboard: false, col: '#eb6834', kind: 'fok' },
    { id: 'J3MH', name: 'J3 M/H', area: '31,05 m²', tws: [10, 22], twa: [38, 105], aboard: true, col: '#2a78d6', kind: 'fok' },
    { id: 'J4', name: 'J4', area: '≈20 m²', tws: [20, 25], twa: [40, 95], aboard: true, col: '#6250d6', kind: 'fok' },
    { id: 'C0', name: 'Code 0', area: '≈55 m²', tws: [4, 15], twa: [65, 120], aboard: false, col: '#eda100', kind: 'ruim' },
    { id: 'HYB', name: 'Hybride', area: '≈70 m²', tws: [5, 16], twa: [85, 130], aboard: false, col: '#8a5a2b', kind: 'ruim' },
    { id: 'A3', name: 'A3', area: '≈90 m²', tws: [7, 17], twa: [100, 148], aboard: false, col: '#e87ba4', kind: 'spi' },
    { id: 'A5', name: 'A5', area: '≈65 m²', tws: [17, 25], twa: [100, 148], aboard: false, col: '#c95c88', kind: 'spi' },
    { id: 'S2', name: 'S2', area: '103 m²', tws: [8, 18], twa: [115, 180], aboard: true, col: '#008300', kind: 'spi' },
    { id: 'S4', name: 'S4', area: '≈80 m²', tws: [16, 25], twa: [125, 180], aboard: false, col: '#e34948', kind: 'spi' },
  ],
};

// Eigen sail selection chart per boot (tab Boot); overschrijft SAILS als er een lijst voor die boot is.
let CUSTOM = {};
export function setCustomSails(m) { CUSTOM = m && typeof m === 'object' ? m : {}; }
export const defaultSails = boat => SAILS[boat] || [];
export const sailsFor = boat => (Array.isArray(CUSTOM[boat]) ? CUSTOM[boat] : SAILS[boat]) || [];
export const sailById = (boat, id) => sailsFor(boat).find(s => s.id === id) || null;
/** Zeilen aan boord: eigen keuze (lijst id's) of anders de standaard uit de chart. */
export function aboardList(boat, chosen) {
  const all = sailsFor(boat);
  if (Array.isArray(chosen) && chosen.length) { const f = all.filter(s => chosen.includes(s.id)); if (f.length) return f; }
  return all.filter(s => s.aboard);
}
export const inZone = (s, tws, twa) => tws >= s.tws[0] && tws <= s.tws[1] && twa >= s.twa[0] && twa <= s.twa[1];
// afstand tot een bereik, genormaliseerd (25 kn ≈ 180°): 0 = erbinnen
function dist(s, tws, twa) {
  const dv = tws < s.tws[0] ? s.tws[0] - tws : tws > s.tws[1] ? tws - s.tws[1] : 0;
  const da = twa < s.twa[0] ? s.twa[0] - twa : twa > s.twa[1] ? twa - s.twa[1] : 0;
  return Math.hypot(dv / 25, da / 180);
}
// hoe centraal binnen het bereik (0 = midden, 1 = rand)
function edge(s, tws, twa) {
  const cv = (s.tws[0] + s.tws[1]) / 2, ca = (s.twa[0] + s.twa[1]) / 2;
  return Math.max(Math.abs(tws - cv) / ((s.tws[1] - s.tws[0]) / 2 || 1), Math.abs(twa - ca) / ((s.twa[1] - s.twa[0]) / 2 || 1));
}

/**
 * Zeiladvies bij ware windsnelheid tws (kn) en ware windhoek twa (0–180°).
 * sails = lijst om uit te kiezen (bv. aboardList). Geeft { sail, ok, alt[] }:
 * ok = false als geen zeil uit de lijst dit bereik dekt (dan het dichtstbijzijnde), alt = andere zeilen die het ook dekken.
 */
export function advise(sails, tws, twa) {
  if (!sails || !sails.length || !isFinite(tws) || !isFinite(twa)) return null;
  twa = Math.max(40, Math.min(180, Math.abs(twa)));   // kruisrak: de boot vaart ±40° van de wind, ook als het merk recht in de wind ligt
  const fit = sails.filter(s => inZone(s, tws, twa)).sort((a, b) => edge(a, tws, twa) - edge(b, tws, twa));
  if (fit.length) return { sail: fit[0], ok: true, alt: fit.slice(1) };
  const near = [...sails].sort((a, b) => dist(a, tws, twa) - dist(b, tws, twa));
  return { sail: near[0], ok: false, alt: [] };
}

// ---------- zeillog (wissels met tijdstempel) ----------
/** Wissels sorteren en dubbele opeenvolgende zeilen weglaten. events = [{t, s}] (s = zeil-id). */
export function normLog(events) {
  const a = (events || []).filter(e => e && isFinite(e.t) && e.s).sort((x, y) => x.t - y.t);
  return a.filter((e, i) => i === 0 || e.s !== a[i - 1].s);
}
/** Zeil op tijdstip t (laatste wissel vóór t), of null. */
export function sailAt(events, t) {
  let s = null; for (const e of normLog(events)) { if (e.t <= t) s = e.s; else break; } return s;
}
/** Stukken tussen t0 en t1 per zeil: [{s, t0, t1}] (s = null vóór de eerste wissel). */
export function segments(events, t0, t1) {
  const ev = normLog(events); const out = []; let cur = sailAt(ev, t0), from = t0;
  for (const e of ev) { if (e.t <= t0) continue; if (e.t >= t1) break; if (e.s !== cur) { if (e.t > from) out.push({ s: cur, t0: from, t1: e.t }); cur = e.s; from = e.t; } }
  if (t1 > from) out.push({ s: cur, t0: from, t1 });
  return out;
}

// ---------- sail selection chart bewerken / inlezen ----------
export const KINDS = { fok: 'voorzeil', ruim: 'ruime wind (Code 0 / hybride)', spi: 'spinnaker / gennaker' };
const PALET = ['#2a78d6', '#008300', '#eb6834', '#6250d6', '#eda100', '#e34948', '#8a5a2b', '#e87ba4', '#0f8a8a', '#7a7a2a'];
const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const newSailId = (name, taken) => { let b = String(name || 'Z').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'Z', id = b, n = 2; while (taken.includes(id)) id = b + n++; return id; };
const clamp = (v, lo, hi, d) => { v = +v; return isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v * 10) / 10)) : d; };
/** Eén zeil controleren en aanvullen; geeft null als het onbruikbaar is. */
export function normSail(x, i = 0) {
  if (!x || !String(x.name || '').trim()) return null;
  let t0 = clamp(x.tws && x.tws[0], 0, 40, 0), t1 = clamp(x.tws && x.tws[1], 0, 40, 25), a0 = clamp(x.twa && x.twa[0], 0, 180, 40), a1 = clamp(x.twa && x.twa[1], 0, 180, 180);
  if (t1 < t0) [t0, t1] = [t1, t0]; if (a1 < a0) [a0, a1] = [a1, a0];
  if (t1 - t0 < 0.5 || a1 - a0 < 1) return null;
  const col = /^#[0-9a-f]{6}$/i.test(x.col || '') ? x.col : PALET[i % PALET.length];
  const kind = KINDS[x.kind] ? x.kind : a0 >= 100 ? 'spi' : a0 >= 60 ? 'ruim' : 'fok';
  return { id: String(x.id || ''), name: String(x.name).trim().slice(0, 20), area: String(x.area || '').trim().slice(0, 16), tws: [t0, t1], twa: [a0, a1], aboard: !!x.aboard, col, kind };
}
/** Lijst controleren: unieke id's, onbruikbare zeilen weg. */
export function normSails(list) {
  const out = [];
  (list || []).forEach((x, i) => { const s = normSail(x, i); if (!s) return; if (!s.id || out.some(o => o.id === s.id)) s.id = newSailId(s.name, out.map(o => o.id)); out.push(s); });
  return out;
}
/** Id's van standaardzeilen hergebruiken als de naam overeenkomt (zodat zeillog en keuze blijven kloppen). */
function matchIds(list, boat) {
  const def = SAILS[boat] || []; const taken = [];
  return list.map(s => { const d = def.find(o => key(o.name) === key(s.name)); const id = d && !taken.includes(d.id) ? d.id : newSailId(s.name, taken.concat(def.map(o => o.id))); taken.push(id); return { ...s, id }; });
}
/**
 * Sail selection chart inlezen. Ondersteund: de HTML van de "sail selection crossover chart" (array S),
 * JSON (lijst zeilen of {sails:[...]}) en CSV/tekst: naam; oppervlak; TWS van; TWS tot; TWA van; TWA tot; [aan boord]; [kleur].
 */
export function parseSailChart(text, boat = 'dm') {
  text = String(text || '').replace(/^\uFEFF/, '').trim(); if (!text) throw new Error('Leeg bestand.');
  let list = null;
  const m = text.match(/var\s+S\s*=\s*(\[[\s\S]*?\]\s*\])\s*;/);
  if (m) {
    let arr; try { arr = JSON.parse(m[1].replace(/'/g, '"')); } catch (e) { throw new Error('Zeilen in de chart kunnen niet gelezen worden.'); }
    list = [];
    for (const r of arr) {
      const [lab, t0, t1, a0, a1, gap, col, , , nm] = r; const [n0, ar] = String(lab || '').split('|'); const name = (n0 || nm || '').trim();
      const parts = String(nm || name).split('/').map(x => x.trim()).filter(Boolean);
      if (!n0 && parts.length > 1) { // gecombineerd bereik (bv. A3/A5): verdelen over de standaardbereiken of in gelijke delen
        const def = SAILS[boat] || [];
        parts.forEach((p, k) => { const d = def.find(o => key(o.name) === key(p)); const w = (t1 - t0) / parts.length;
          const tw = d ? [Math.max(t0, d.tws[0]), Math.min(t1, d.tws[1])] : [t0 + w * k, t0 + w * (k + 1)];
          list.push({ name: p, area: d ? d.area : '', tws: tw, twa: [a0, a1], aboard: !gap, col: d ? d.col : col }); });
      } else list.push({ name, area: (ar || '').trim(), tws: [t0, t1], twa: [a0, a1], aboard: !gap, col });
    }
  } else if (text[0] === '[' || text[0] === '{') {
    let j; try { j = JSON.parse(text); } catch (e) { throw new Error('JSON kan niet gelezen worden.'); }
    list = Array.isArray(j) ? j : Array.isArray(j.sails) ? j.sails : null; if (!list) throw new Error('JSON zonder lijst met zeilen.');
  } else {
    list = [];
    for (const line of text.split(/\r?\n/)) {
      const c = line.split(line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',').map(s => s.trim());
      const n = c.slice(2, 6).map(s => +s.replace(',', '.'));
      if (c.length < 6 || n.some(x => !isFinite(x)) || !c[0]) continue;   // kopregel of lege regel
      list.push({ name: c[0], area: c[1], tws: [n[0], n[1]], twa: [n[2], n[3]], aboard: c[6] ? /^(1|j|ja|y|yes|x|true|aan)/i.test(c[6]) : true, col: c[7] });
    }
  }
  const out = normSails(matchIds(list.map(x => ({ ...x, id: '' })).filter(x => x.name), boat).map(x => x));
  if (!out.length) throw new Error('Geen zeilen gevonden in het bestand.');
  return out;
}
/** Chart als CSV (puntkomma) voor export. */
export function sailsToCsv(list) {
  return 'naam;oppervlak;TWS van;TWS tot;TWA van;TWA tot;aan boord;kleur\n' + list.map(s => [s.name, s.area, s.tws[0], s.tws[1], s.twa[0], s.twa[1], s.aboard ? 'ja' : 'nee', s.col].join(';')).join('\n') + '\n';
}
