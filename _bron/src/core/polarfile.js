// Polar inlezen uit een bestand of geplakte tekst (puur rekenwerk, geen DOM).
// Ondersteund:
//  - tabel: kopregel met TWS, daarna per TWA een rij bootsnelheden (ORC-, OpenCPN .pol-, Excel/CSV-export; ; , tab of spaties).
//    Ook omgekeerd (rijen = TWS, kolommen = TWA). Rijen met een label als "Beat angle", "Beat VMG", "Run VMG",
//    "Gybe angle" (of Kruishoek/Gijphoek) worden als optimale hoeken/VMG gebruikt.
//  - Expedition-formaat: per regel TWS gevolgd door paren TWA BSP.
//  - JSON in het formaat van de app ({tws, ang, v, beatAng, beatVmg, runVmg, gybeAng}).
// Resultaat: polar zoals in data/boats.js; ontbrekende kruis-/gijphoeken en VMG worden uit de tabel berekend.
const RAD = Math.PI / 180;

const LABELS = [
  ['beatAng', /beat\s*ang|upwind\s*ang|kruis\s*hoek|kruishoek|opt.*kruis/i],
  ['beatVmg', /beat\s*vmg|upwind\s*vmg|kruis.*vmg/i],
  ['runVmg', /run\s*vmg|downwind\s*vmg|gijp.*vmg|voor.*wind.*vmg/i],
  ['gybeAng', /gybe\s*ang|jibe\s*ang|run\s*ang|downwind\s*ang|gijp\s*hoek|gijphoek/i],
];
const isNum = s => /^[-+]?\d+(?:[.,]\d+)?$/.test(String(s).trim());

function splitLine(line) {
  let delim = line.includes('\t') ? '\t' : line.includes(';') ? ';' : null;
  if (!delim && line.includes(',')) {
    const tk = line.trim().split(/\s+/);
    // "52 3,82 5,17" = spaties met decimale komma's; "52,3.82,5.17" of "52, 3.82, 5.17" = komma als scheiding
    const spaceDec = tk.length >= 3 && tk.slice(0, -1).filter(t => !t.endsWith(',')).length >= tk.length / 2;
    if (!spaceDec) delim = ',';
  }
  let parts = delim ? line.split(delim) : line.trim().split(/\s+/);
  parts = parts.map(s => s.trim()).filter((s, i, a) => s !== '' || (i > 0 && i < a.length - 1));
  // label van meerdere woorden (spatie-gescheiden): voorloop-tekst samenvoegen
  if (!delim) { let k = 0; while (k < parts.length && !isNum(parts[k])) k++; if (k > 1) parts = [parts.slice(0, k).join(' '), ...parts.slice(k)]; }
  const decComma = delim !== ',';
  return parts.map(s => (isNum(s) ? +(decComma ? s.replace(',', '.') : s) : s === '' ? NaN : s));
}

const interp = (pts, x) => { // pts gesorteerd [[x,y]], binnen bereik lineair, buiten: rand
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const q = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0] || 1); return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * q; }
  return pts[pts.length - 1][1];
};

/** Rijen [{tws, pts:[[twa,bs]]}] + optionele opt-waarden per tws → polar in app-formaat. */
export function buildPolar(rows, opt = {}) {
  rows = rows.map(r => ({ tws: +r.tws, pts: r.pts.filter(p => isFinite(p[0]) && isFinite(p[1]) && p[1] > 0 && p[0] > 0 && p[0] <= 180).sort((a, b) => a[0] - b[0]) }))
    .filter(r => isFinite(r.tws) && r.tws > 0 && r.pts.length >= 2).sort((a, b) => a.tws - b.tws);
  if (rows.length < 2) throw new Error('Te weinig windsnelheden gevonden (minimaal 2 kolommen TWS nodig).');
  const tws = rows.map(r => r.tws);
  if (new Set(tws).size !== tws.length) throw new Error('Dezelfde windsnelheid komt dubbel voor.');
  const angSet = new Set(); rows.forEach(r => r.pts.forEach(p => angSet.add(Math.round(p[0] * 10) / 10)));
  const ang = [...angSet].sort((a, b) => a - b);
  if (ang.length < 3) throw new Error('Te weinig windhoeken gevonden (minimaal 3 rijen TWA nodig).');
  const v = ang.map(a => rows.map(r => Math.round(interp(r.pts, a) * 100) / 100));
  for (const row of v) for (const x of row) if (!(x > 0 && x < 40)) throw new Error('Onlogische bootsnelheid in de tabel: ' + x);
  const pick = (k, i) => (opt[k] && isFinite(opt[k][i]) && opt[k][i] > 0 ? +opt[k][i] : null);
  const beatAng = [], beatVmg = [], runVmg = [], gybeAng = [], notes = [];
  rows.forEach((r, i) => {
    let bA = pick('beatAng', i), bV = pick('beatVmg', i), gA = pick('gybeAng', i), rV = pick('runVmg', i);
    const lo = r.pts[0][0], hi = r.pts[r.pts.length - 1][0];
    if (bA == null || bV == null) {
      let best = [lo, 0]; for (let a = lo; a <= Math.min(90, hi); a += 0.5) { const m = interp(r.pts, a) * Math.cos(a * RAD); if (m > best[1]) best = [a, m]; }
      if (bA == null && bV != null) bA = best[0]; if (bA != null && bV == null) bV = interp(r.pts, bA) * Math.cos(bA * RAD);
      if (bA == null) { bA = best[0]; bV = best[1]; } if (bA <= lo + 0.01 && lo > 35) notes.push('beat');
    }
    if (gA == null || rV == null) {
      let best = [hi, 0]; for (let a = Math.max(90, lo); a <= hi; a += 0.5) { const m = -interp(r.pts, a) * Math.cos(a * RAD); if (m > best[1]) best = [a, m]; }
      if (gA == null && rV != null) gA = best[0]; if (gA != null && rV == null) rV = -interp(r.pts, gA) * Math.cos(gA * RAD);
      if (gA == null) { gA = best[0]; rV = best[1]; } if (gA >= hi - 0.01 && hi < 170) notes.push('run');
    }
    beatAng.push(Math.round(bA * 10) / 10); beatVmg.push(Math.round(bV * 100) / 100); gybeAng.push(Math.round(gA * 10) / 10); runVmg.push(Math.round(rV * 100) / 100);
  });
  const P = { tws, ang, v, beatAng, beatVmg, runVmg, gybeAng };
  const warn = [];
  if (notes.includes('beat')) warn.push('Kruishoek niet in het bestand en kleinste hoek > 35°: kruishoek = kleinste hoek uit de tabel (mogelijk te ruim).');
  if (notes.includes('run')) warn.push('Gijphoek niet in het bestand en grootste hoek < 170°: gijphoek = grootste hoek uit de tabel.');
  if (!opt.beatAng) warn.push('Kruishoek en kruis-VMG berekend uit de tabel.');
  if (!opt.gybeAng) warn.push('Gijphoek en voor-de-wind-VMG berekend uit de tabel.');
  return { polar: P, warn };
}

/** Controle van een polar in app-formaat (bv. uit JSON of opslag). */
export function validPolar(P) {
  try {
    if (!P || !Array.isArray(P.tws) || !Array.isArray(P.ang) || !Array.isArray(P.v)) return false;
    const n = P.tws.length; if (n < 2 || P.ang.length < 3 || P.v.length !== P.ang.length) return false;
    if (!P.v.every(r => Array.isArray(r) && r.length === n && r.every(x => x > 0 && x < 40))) return false;
    for (const k of ['beatAng', 'beatVmg', 'runVmg', 'gybeAng']) if (!Array.isArray(P[k]) || P[k].length !== n || !P[k].every(x => isFinite(x) && x > 0)) return false;
    for (let i = 1; i < n; i++) if (!(P.tws[i] > P.tws[i - 1])) return false;
    for (let i = 1; i < P.ang.length; i++) if (!(P.ang[i] > P.ang[i - 1])) return false;
    return true;
  } catch (e) { return false; }
}

/** Tekst (bestand of geplakt) → { polar, warn[], fmt }. Gooit Error met Nederlandse melding. */
export function parsePolar(text) {
  text = String(text || '').replace(/^﻿/, '').trim();
  if (!text) throw new Error('Leeg bestand.');
  if (text[0] === '{') {
    let j; try { j = JSON.parse(text); } catch (e) { throw new Error('JSON kan niet gelezen worden.'); }
    const P = j.polar || j;
    if (validPolar(P)) return { polar: { tws: P.tws, ang: P.ang, v: P.v, beatAng: P.beatAng, beatVmg: P.beatVmg, runVmg: P.runVmg, gybeAng: P.gybeAng }, warn: [], fmt: 'JSON' };
    if (P && Array.isArray(P.tws) && Array.isArray(P.ang) && Array.isArray(P.v)) {
      const r = buildPolar(P.tws.map((t, i) => ({ tws: t, pts: P.ang.map((a, k) => [a, P.v[k] && P.v[k][i]]) })), P);
      return { ...r, fmt: 'JSON' };
    }
    throw new Error('JSON zonder polar (tws, ang, v).');
  }
  const lines = text.split(/\r?\n/).map(l => l.replace(/#.*$/, '').trimEnd()).filter(l => l.trim() && !/^\s*(\/\/|!)/.test(l));
  const rows = lines.map(splitLine);
  // Expedition: alleen getallen, oneven aantal (tws + paren), geen kopregel
  const allNum = rows.every(r => r.every(x => typeof x === 'number'));
  const expedition = allNum && rows.length >= 2 && rows.every(r => r.length >= 5 && r.length % 2 === 1) && !(rows[0][0] === 0)
    && rows.every(r => r.slice(1).filter((_, i) => i % 2 === 0).every((a, i, arr) => a >= 0 && a <= 180 && (i === 0 || a > arr[i - 1])))
    && new Set(rows.map(r => r.length)).size >= 1 && !(rows[0].slice(1).every(x => x <= 40));
  if (expedition) {
    const R = rows.map(r => { const pts = []; for (let i = 1; i + 1 < r.length; i += 2) pts.push([r[i], r[i + 1]]); return { tws: r[0], pts }; });
    return { ...buildPolar(R), fmt: 'Expedition' };
  }
  // tabel: zoek kopregel (eerste regel met ≥2 getallen na een eventueel label)
  let hi = rows.findIndex(r => r.filter(x => typeof x === 'number' && isFinite(x)).length >= 2);
  if (hi < 0) throw new Error('Geen tabel met getallen gevonden.');
  let head = rows[hi]; let headVals = typeof head[0] === 'number' && !(head[0] === 0 || isNaN(head[0])) && head.length === (rows[hi + 1] || []).length - 1 ? head : head.slice(1);
  headVals = headVals.filter(x => typeof x === 'number' && isFinite(x));
  const body = rows.slice(hi + 1).filter(r => r.length >= 2);
  const opt = {}; const data = [];
  for (const r of body) {
    const lab = r[0];
    if (typeof lab === 'string') { const m = LABELS.find(([, re]) => re.test(lab)); if (m) opt[m[0]] = r.slice(1).map(Number); continue; }
    if (typeof lab === 'number' && isFinite(lab)) data.push([lab, r.slice(1).map(Number)]);
  }
  if (!data.length) throw new Error('Geen rijen met snelheden gevonden.');
  const firstCol = data.map(d => d[0]);
  const transposed = Math.max(...headVals) > 40 && Math.max(...firstCol) <= 40;
  let R;
  if (!transposed) R = headVals.map((t, i) => ({ tws: t, pts: data.map(([a, vs]) => [a, vs[i]]) }));
  else R = data.map(([t, vs]) => ({ tws: t, pts: headVals.map((a, i) => [a, vs[i]]) }));
  if (transposed) Object.keys(opt).forEach(k => delete opt[k]);
  const res = buildPolar(R, opt);
  return { ...res, fmt: transposed ? 'tabel (rijen = TWS)' : 'tabel' };
}

/** Polar als tekst (tab-gescheiden, ORC-achtige opbouw) voor export. */
export function polarToText(P) {
  const f = x => String(x).replace('.', ',');
  const L = ['TWA\\TWS\t' + P.tws.join('\t')];
  L.push('Beat angle\t' + P.beatAng.map(f).join('\t'), 'Beat VMG\t' + P.beatVmg.map(f).join('\t'));
  P.ang.forEach((a, i) => L.push(a + '\t' + P.v[i].map(f).join('\t')));
  L.push('Run VMG\t' + P.runVmg.map(f).join('\t'), 'Gybe angle\t' + P.gybeAng.map(f).join('\t'));
  return L.join('\n') + '\n';
}
