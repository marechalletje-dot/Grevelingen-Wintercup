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

export const sailsFor = boat => SAILS[boat] || [];
export const sailById = (boat, id) => sailsFor(boat).find(s => s.id === id) || null;
/** Zeilen aan boord: eigen keuze (lijst id's) of anders de standaard uit de chart. */
export function aboardList(boat, chosen) {
  const all = sailsFor(boat);
  if (Array.isArray(chosen) && chosen.length) return all.filter(s => chosen.includes(s.id));
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
