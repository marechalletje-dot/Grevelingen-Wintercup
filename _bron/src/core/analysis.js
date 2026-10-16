// Post Race Analyses: track inlezen (GPX/CSV/AIS-JSON), opschonen, rakken herkennen, prestatie t.o.v. de polar
// en vergelijking met de simulatie vóór de race. Puur: geen DOM, geen globale toestand.
import { perf } from './polar.js';

const R = Math.PI / 180;
const NM = 1852;
/** Afstand in nm tussen twee [lat,lon] (equirectangulair, ruim nauwkeurig genoeg voor het Grevelingenmeer). */
export function distNm(a, b) {
  const x = (b[1] - a[1]) * Math.cos(((a[0] + b[0]) / 2) * R) * 60, y = (b[0] - a[0]) * 60;
  return Math.hypot(x, y);
}
/** Ware koers (°) van a naar b. */
export function bearing(a, b) {
  const x = (b[1] - a[1]) * Math.cos(((a[0] + b[0]) / 2) * R), y = b[0] - a[0];
  return ((Math.atan2(x, y) / R) + 360) % 360;
}
const angDiff = (a, b) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; };

// ---------- inlezen ----------
const toMs = v => {
  if (v == null || v === '') return NaN;
  if (typeof v === 'number') return v < 1e11 ? v * 1000 : v;          // epoch s of ms
  const s = String(v).trim();
  if (/^\d{9,13}(\.\d+)?$/.test(s)) { const n = +s; return n < 1e11 ? n * 1000 : n; }
  // "2026-10-11 11:02:03" (Safari kan geen spatie) en zonder zone = UTC (AIS en GPX zijn UTC)
  let q = s.replace(' ', 'T'); if (!/[zZ]|[+-]\d\d:?\d\d$/.test(q)) q += 'Z';
  return Date.parse(q);
};

/** GPX (trkpt/rtept/wpt met <time>) → [{t,lat,lon}] */
export function parseGpx(text) {
  const out = []; const re = /<(trkpt|rtept|wpt)\b([^>]*)>([\s\S]*?)<\/\1>/g; let m;
  while ((m = re.exec(text))) {
    const la = /lat\s*=\s*["']([-\d.]+)["']/.exec(m[2]), lo = /lon\s*=\s*["']([-\d.]+)["']/.exec(m[2]);
    const tm = /<time>([^<]+)<\/time>/.exec(m[3]);
    if (la && lo) out.push({ t: tm ? toMs(tm[1]) : NaN, lat: +la[1], lon: +lo[1] });
  }
  return out;
}

/** CSV/TSV met kolommen voor breedte, lengte en tijd (namen worden herkend) → [{t,lat,lon}] */
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim()); if (lines.length < 2) return [];
  const sep = [';', '\t', ','].find(s => lines[0].split(s).length > 2) || ',';
  const H = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const find = re => H.findIndex(h => re.test(h));
  const iLa = find(/^(lat|latitude|breedte)/), iLo = find(/^(lon|lng|long|longitude|lengte)/);
  const iT = find(/(time|tijd|timestamp|date|datum|epoch|utc)/);
  if (iLa < 0 || iLo < 0) return [];
  return lines.slice(1).map(l => {
    const c = l.split(sep).map(x => x.trim().replace(/^"|"$/g, ''));
    const num = s => +String(s).replace(',', '.');
    return { t: iT >= 0 ? toMs(c[iT]) : NaN, lat: num(c[iLa]), lon: num(c[iLo]) };
  }).filter(p => isFinite(p.lat) && isFinite(p.lon));
}

/** AIS-JSON van een API (bv. Datalastic vessel_history): zoekt de lijst met posities, wat de veldnamen ook zijn. */
export function parseAisJson(j) {
  const keys = o => Object.keys(o || {});
  const pick = (o, names) => { const k = keys(o).find(k => names.includes(k.toLowerCase())); return k ? o[k] : undefined; };
  const LAT = ['lat', 'latitude'], LON = ['lon', 'lng', 'long', 'longitude'];
  const TIME = ['last_position_epoch', 'last_position_utc', 'timestamp', 'time', 'epoch', 'datetime', 'date', 'utc', 'ts', 'position_time', 'received'];
  let best = null;
  (function walk(v, depth) {
    if (!v || depth > 6) return;
    if (Array.isArray(v)) {
      if (v.length && typeof v[0] === 'object' && pick(v[0], LAT) != null && pick(v[0], LON) != null) { if (!best || v.length > best.length) best = v; return; }
      v.forEach(x => walk(x, depth + 1)); return;
    }
    if (typeof v === 'object') keys(v).forEach(k => walk(v[k], depth + 1));
  })(j, 0);
  if (!best) return [];
  return best.map(o => ({ t: toMs(pick(o, TIME)), lat: +pick(o, LAT), lon: +pick(o, LON), sog: pick(o, ['speed', 'sog']) != null ? +pick(o, ['speed', 'sog']) : null }))
    .filter(p => isFinite(p.lat) && isFinite(p.lon));
}

/** Bestandsinhoud herkennen en inlezen. */
export function parseTrackFile(text, name = '') {
  const s = text.trim();
  if (/^\s*</.test(s) || /\.gpx$/i.test(name)) return parseGpx(s);
  if (/^[[{]/.test(s)) { try { return parseAisJson(JSON.parse(s)); } catch (e) { return []; } }
  return parseCsv(s);
}

/** URL voor AIS-historie. provider 'datalastic' of een eigen sjabloon met {mmsi} {from} {to} {key} {day}. */
/** VesselAPI (vrije laag): positie-historie per MMSI, sleutel in de header, max. 50 per pagina. */
export function vesselApiUrl(mmsi, day, next = null) {
  const [y, m, d] = day.split('-').map(Number);
  const from = new Date(y, m - 1, d, 6, 0).toISOString().replace(/\.\d{3}Z$/, 'Z'), to = new Date(y, m - 1, d, 20, 0).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const p = new URLSearchParams({ 'filter.ids': mmsi, 'filter.idType': 'mmsi', 'time.from': from, 'time.to': to, 'pagination.limit': '50' });
  if (next) p.set('pagination.nextToken', next);
  return 'https://api.vesselapi.com/v1/vessels/positions?' + p.toString();
}
/** Volgende-pagina-token ergens in het antwoord. */
export function findNextToken(j) {
  let tok = null;
  (function walk(v, d) { if (!v || tok || d > 4 || typeof v !== 'object') return; for (const k of Object.keys(v)) { if (/^next_?token$/i.test(k) && v[k]) { tok = v[k]; return; } walk(v[k], d + 1); } })(j, 0);
  return tok;
}
export function aisUrl({ provider, mmsi, key, tpl }, day) {
  const nxt = (() => { const [y, m, d] = day.split('-').map(Number); const D = new Date(Date.UTC(y, m - 1, d + 1)); return D.toISOString().slice(0, 10); })();
  if (provider === 'custom') return String(tpl || '').replace(/\{mmsi\}/g, encodeURIComponent(mmsi)).replace(/\{key\}/g, encodeURIComponent(key)).replace(/\{from\}/g, day).replace(/\{to\}/g, nxt).replace(/\{day\}/g, day);
  return `https://api.datalastic.com/api/v0/vessel_history?api-key=${encodeURIComponent(key)}&mmsi=${encodeURIComponent(mmsi)}&from=${day}&to=${nxt}`;
}

// ---------- opschonen ----------
/** Sorteren, dubbele/ongeldige punten weg, sprongen (> maxKn) weg, alleen punten binnen [t0,t1]. */
export function cleanTrack(pts, { t0 = -Infinity, t1 = Infinity, maxKn = 25 } = {}) {
  const a = pts.filter(p => isFinite(p.t) && isFinite(p.lat) && isFinite(p.lon) && Math.abs(p.lat) > 1 && p.t >= t0 && p.t <= t1).sort((x, y) => x.t - y.t);
  const out = [];
  for (const p of a) {
    const q = out[out.length - 1];
    if (q && p.t - q.t < 900) continue;
    if (q) { const v = distNm([q.lat, q.lon], [p.lat, p.lon]) / ((p.t - q.t) / 3600e3); if (v > maxKn) continue; }
    out.push({ t: p.t, lat: p.lat, lon: p.lon });
  }
  return out;
}
/** Snelheid en koers per punt over een venster van ±win ms (gladder dan punt-tot-punt). */
export function addMotion(pts, win = 30e3) {
  let a = 0, b = 0;
  return pts.map((p, i) => {
    while (pts[a].t < p.t - win && a < i) a++;
    while (b < pts.length - 1 && pts[b + 1].t <= p.t + win) b++;
    const A = pts[a === i && i > 0 ? i - 1 : a], B = pts[b === i && i < pts.length - 1 ? i + 1 : b];
    const dt = (B.t - A.t) / 3600e3; const d = distNm([A.lat, A.lon], [B.lat, B.lon]);
    return { ...p, sog: dt > 0 ? d / dt : 0, cog: d > 0.003 ? bearing([A.lat, A.lon], [B.lat, B.lon]) : null };
  });
}

// ---------- rakken herkennen ----------
/**
 * Per merkteken (einde van elk rak, [lat,lon]) het moment van ronden: het dichtste punt bij het merkteken,
 * na het vorige merkteken. Eerst binnen R nm komen en weer weggaan; anders het dichtste punt in de rest van de track.
 */
export function matchMarks(pts, marks, R = 0.12) {
  const out = []; let from = 0;
  for (const mk of marks) {
    let best = -1, bd = Infinity, inside = false;
    for (let i = from; i < pts.length; i++) {
      const d = distNm([pts[i].lat, pts[i].lon], mk);
      if (d < bd) { bd = d; best = i; }
      if (d < R) inside = true;
      if (inside && d > bd + 0.08) break;   // weer weg van het merkteken: ronding gevonden
    }
    if (best < 0) { out.push(null); continue; }
    out.push({ i: best, t: pts[best].t, d: bd, ok: bd < 0.25 });
    from = best + 1;
  }
  return out;
}

// ---------- prestatie ----------
/**
 * Per punt: ware wind (windFn(t,lat,lon) → {twd, tws, twa?, src?}), TWA en polar-snelheid en prestatie (snelheid / polar).
 * v52: geeft windFn een gemeten TWA (boordinstrumenten), dan telt die i.p.v. de TWA uit de grondkoers; heeft het punt
 * een snelheid door het water (p.stw), dan is dat de snelheid, anders SOG.
 */
export function perfSeries(pts, windFn, polar) {
  return pts.map(p => {
    const w = windFn(p.t, p.lat, p.lon);
    const hasTwa = w && w.twa != null && isFinite(w.twa);
    if (!w || (p.cog == null && !hasTwa)) return { ...p, twd: w && w.twd, tws: w && w.tws, twa: null, target: null, ratio: null, spd: p.stw != null ? p.stw : p.sog };
    const twa = hasTwa ? Math.min(180, Math.abs(w.twa)) : angDiff(p.cog, w.twd);
    const pf = perf(polar, twa, Math.max(2, w.tws), 100);
    const target = pf.bs; const spd = p.stw != null ? p.stw : p.sog;
    const ok = w.tws >= 3 && target > 0.8 && spd > 0.5;
    return { ...p, twd: w.twd, tws: w.tws, twa, wsrc: w.src || 'model', spd, mode: pf.mode, target, vmgTarget: pf.mode === 'direct' ? null : pf.vmc, ratio: ok ? spd / target : null };
  });
}
const vecMean = arr => { let sx = 0, sy = 0; arr.forEach(d => { sx += Math.sin(d * R); sy += Math.cos(d * R); }); return arr.length ? ((Math.atan2(sx, sy) / R) + 360) % 360 : null; };

/** Statistiek per rak tussen de rondingen (start = racestart). */
export function legStats(P, rounds, start) {
  const out = []; let t0 = start, i0 = Math.max(0, P.findIndex(p => p.t >= start));
  rounds.forEach((r, k) => {
    if (!r || i0 < 0) { out.push(null); return; }
    const seg = P.slice(i0, r.i + 1); let nm = 0;
    for (let j = 1; j < seg.length; j++) nm += distNm([seg[j - 1].lat, seg[j - 1].lon], [seg[j].lat, seg[j].lon]);
    const rr = seg.filter(p => p.ratio != null);
    // tijdgewogen prestatie
    let wsum = 0, rsum = 0; for (let j = 1; j < rr.length; j++) { const dt = Math.min(120e3, rr[j].t - rr[j - 1].t); wsum += dt; rsum += dt * Math.min(1.6, rr[j].ratio); }
    const ws = seg.filter(p => p.tws != null);
    out.push({ k, t0, t1: r.t, dur: (r.t - t0) / 3600e3, nm, sog: (r.t - t0) > 0 ? nm / ((r.t - t0) / 3600e3) : 0,
      ratio: wsum ? rsum / wsum : null, twd: vecMean(ws.map(p => p.twd)), tws: ws.length ? ws.reduce((a, p) => a + p.tws, 0) / ws.length : null, ok: r.ok, miss: r.d });
    t0 = r.t; i0 = r.i;
  });
  return out;
}

/** Samenvatting van de prestatie over de hele race (tijdgewogen). */
export function overall(L) {
  const v = L.filter(x => x && x.ratio != null); const T = v.reduce((a, x) => a + x.dur, 0);
  return { ratio: T ? v.reduce((a, x) => a + x.ratio * x.dur, 0) / T : null, dur: L.filter(Boolean).reduce((a, x) => a + x.dur, 0), nm: L.filter(Boolean).reduce((a, x) => a + x.nm, 0) };
}

/** Track compact opslaan: [[t(s), lat*1e5, lon*1e5], ...] */
export const packTrack = pts => pts.map(p => [Math.round(p.t / 1000), Math.round(p.lat * 1e5), Math.round(p.lon * 1e5)]);
export const unpackTrack = a => (a || []).map(([t, la, lo]) => ({ t: t * 1000, lat: la / 1e5, lon: lo / 1e5 }));
