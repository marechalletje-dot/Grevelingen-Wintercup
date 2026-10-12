// Windverwachting (modeldata via Open-Meteo, dezelfde modellen als de GRIB-bestanden) en een racesimulatie met wind die in de tijd verandert.
import { perf } from './polar.js';
import { twaOf } from './nav.js';
import { countManoeuvres } from './timing.js';

export const WX_POS = { lat: 51.745, lon: 3.92 };  // Grevelingenmeer, wedstrijdgebied Ossehoek/Scharendijke
export const MODELS = {
  auto: 'Automatisch (KNMI HARMONIE, verder vooruit ECMWF)',
  knmi_seamless: 'KNMI HARMONIE-AROME (2 km, ±2,5 dagen)',
  icon_seamless: 'DWD ICON (D2 2 km / EU 7 km)',
  ecmwf_ifs025: 'ECMWF IFS (25 km, 15 dagen)',
  best_match: 'Open-Meteo best match',
};
/** Model kiezen: KNMI zolang de dag binnen ~2 dagen ligt, anders ECMWF. */
export function pickModel(model, dayIso, now = Date.now()) {
  if (model && model !== 'auto') return model;
  const d = Date.parse(dayIso + 'T12:00:00');
  return d - now < 2.2 * 86400e3 ? 'knmi_seamless' : 'ecmwf_ifs025';
}
export function forecastUrl(model, dayIso, pos = WX_POS) {
  const p = new URLSearchParams({
    latitude: pos.lat, longitude: pos.lon, hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    wind_speed_unit: 'kn', timezone: 'Europe/Amsterdam', start_date: dayIso, end_date: dayIso, models: model,
  });
  return 'https://api.open-meteo.com/v1/forecast?' + p.toString();
}
/** Open-Meteo-antwoord → [{t (ms, lokale klok), h, twd, tws, gust}]; uren zonder data worden weggelaten. */
export function parseForecast(j) {
  if (!j || !j.hourly || !Array.isArray(j.hourly.time)) throw new Error(j && j.reason ? j.reason : 'Geen uurdata in het antwoord');
  const H = j.hourly; const key = n => Object.keys(H).find(k => k === n || k.startsWith(n + '_'));
  const S = H[key('wind_speed_10m')], D = H[key('wind_direction_10m')], G = H[key('wind_gusts_10m')] || [];
  const out = [];
  H.time.forEach((ts, i) => {
    if (S[i] == null || D[i] == null) return;
    const [d, hm] = ts.split('T'); const [y, mo, da] = d.split('-').map(Number); const [hh, mi] = hm.split(':').map(Number);
    out.push({ t: new Date(y, mo - 1, da, hh, mi || 0).getTime(), h: hh, twd: Math.round(D[i]) % 360, tws: +(+S[i]).toFixed(1), gust: G[i] != null ? +(+G[i]).toFixed(1) : null });
  });
  if (!out.length) throw new Error('Het model heeft geen data voor deze dag');
  return out;
}
const rad = d => d * Math.PI / 180, deg = r => ((r * 180 / Math.PI) % 360 + 360) % 360;
/** Wind op tijdstip t: lineair geïnterpoleerd (richting via vectoren), buiten de reeks de dichtstbijzijnde waarde. */
export function windAt(series, t) {
  if (!series || !series.length) return null;
  if (t <= series[0].t) return { twd: series[0].twd, tws: series[0].tws };
  const L = series[series.length - 1]; if (t >= L.t) return { twd: L.twd, tws: L.tws };
  let i = 0; while (series[i + 1].t < t) i++;
  const a = series[i], b = series[i + 1], f = (t - a.t) / (b.t - a.t);
  const ux = (1 - f) * Math.sin(rad(a.twd)) + f * Math.sin(rad(b.twd)), uy = (1 - f) * Math.cos(rad(a.twd)) + f * Math.cos(rad(b.twd));
  return { twd: Math.round(deg(Math.atan2(ux, uy))) % 360, tws: +((1 - f) * a.tws + f * b.tws).toFixed(1) };
}
/** Gemiddelde wind (vectorgemiddelde richting, rekenkundige snelheid) tussen t0 en t1, per 10 minuten bemonsterd. */
export function avgWind(series, t0, t1) {
  const n = Math.max(1, Math.round((t1 - t0) / 600e3)); let sx = 0, sy = 0, sv = 0, mn = Infinity, mx = -Infinity;
  for (let k = 0; k <= n; k++) { const w = windAt(series, t0 + (t1 - t0) * k / n); sx += Math.sin(rad(w.twd)); sy += Math.cos(rad(w.twd)); sv += w.tws; mn = Math.min(mn, w.tws); mx = Math.max(mx, w.tws); }
  return { twd: Math.round(deg(Math.atan2(sx, sy))) % 360, tws: +(sv / (n + 1)).toFixed(1), min: mn, max: mx };
}
/**
 * Simuleer de baan met wind die met de tijd verandert. legs = rakken van de app ({t, s:[{nm,tw}]}),
 * ctx = {polar, eff, tackS, gybeS}, start = ms. Per deelrak de wind op dat moment; manoeuvres per rak met de wind bij de start van het rak.
 */
export function simulate(legs, ctx, series, start) {
  let t = start; const out = [];
  for (const l of legs) {
    const w0 = windAt(series, t); const c0 = { ...ctx, twd: w0.twd, tws: w0.tws };
    const copy = { ...l, s: l.s.map(x => ({ ...x })) }; countManoeuvres([copy], c0);
    const t0 = t; let first = null;
    for (const sg of copy.s) {
      const w = windAt(series, t); const a = twaOf(w.twd, sg.tw); const p = perf(ctx.polar, a.a, Math.max(4, w.tws), ctx.eff);
      if (!first) first = { twd: w.twd, tws: w.tws, twa: a.a, side: a.side, mode: p.mode, kn: p.vmc };
      t += sg.nm / Math.max(0.3, p.vmc) * 3600e3;
    }
    t += copy._man.loss * 3600e3;
    const nm = copy.s.reduce((a, x) => a + x.nm, 0);
    out.push({ to: l.t, nm, start: t0, end: t, ...first, man: copy._man, kn: nm / ((t - t0) / 3600e3) });
  }
  return { legs: out, start, finish: t, hours: (t - start) / 3600e3 };
}
