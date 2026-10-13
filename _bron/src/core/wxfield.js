// Windveld: modelverwachting op een raster van punten over het Grevelingenmeer (Open-Meteo, meerdere locaties in één aanvraag),
// interpolatie in tijd en ruimte, en kleurschaal zoals in Windy/Windfinder. Puur (geen DOM).
import { parseForecast, windAt } from './wx.js';

/** Rastergebied (lat/lon) en aantal punten. ~2,4 km tussen de punten in oost-west, ~3,3 km noord-zuid. */
export const FIELD_BOX = { n: 51.80, s: 51.68, w: 3.80, e: 4.12 };
export const FIELD_NX = 7, FIELD_NY = 4;

/** Rasterpunten, rij voor rij van noord naar zuid, west naar oost. */
export function gridPts(box = FIELD_BOX, nx = FIELD_NX, ny = FIELD_NY) {
  const out = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    out.push({ i, j, lat: +(box.n - (box.n - box.s) * j / (ny - 1)).toFixed(4), lon: +(box.w + (box.e - box.w) * i / (nx - 1)).toFixed(4) });
  return out;
}

export function fieldUrl(model, dayIso, pts = gridPts()) {
  const p = new URLSearchParams({
    latitude: pts.map(q => q.lat).join(','), longitude: pts.map(q => q.lon).join(','),
    hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    wind_speed_unit: 'kn', timezone: 'Europe/Amsterdam', start_date: dayIso, end_date: dayIso, models: model,
  });
  return 'https://api.open-meteo.com/v1/forecast?' + p.toString();
}

/** Antwoord (array per locatie, of één object bij één locatie) → veld {box,nx,ny,series:[per punt]}. */
export function parseField(j, box = FIELD_BOX, nx = FIELD_NX, ny = FIELD_NY) {
  if (j && !Array.isArray(j) && (j.error || !j.hourly)) throw new Error(j.reason || 'Geen uurdata in het antwoord');
  const arr = Array.isArray(j) ? j : [j];
  if (arr.length !== nx * ny) throw new Error(`Verwacht ${nx * ny} rasterpunten, kreeg er ${arr.length}`);
  return { box, nx, ny, series: arr.map(x => parseForecast(x)) };
}

const rad = d => d * Math.PI / 180, deg = r => ((r * 180 / Math.PI) % 360 + 360) % 360;

/** Veld op tijdstip t: per punt {twd,tws}. */
export function fieldAt(F, t) { return F.series.map(s => windAt(s, t)); }

/** Wind op (lat,lon) uit een veld-op-tijdstip G (uit fieldAt): bilineair, richting via vectoren. Buiten het raster: rand. */
export function sampleGrid(F, G, lat, lon) {
  const { box, nx, ny } = F;
  const fx = Math.min(nx - 1, Math.max(0, (lon - box.w) / (box.e - box.w) * (nx - 1)));
  const fy = Math.min(ny - 1, Math.max(0, (box.n - lat) / (box.n - box.s) * (ny - 1)));
  const i0 = Math.min(nx - 2, Math.floor(fx)), j0 = Math.min(ny - 2, Math.floor(fy)), ax = fx - i0, ay = fy - j0;
  let sx = 0, sy = 0, sv = 0;
  for (const [di, dj, w] of [[0, 0, (1 - ax) * (1 - ay)], [1, 0, ax * (1 - ay)], [0, 1, (1 - ax) * ay], [1, 1, ax * ay]]) {
    const g = G[(j0 + dj) * nx + i0 + di]; if (!g || !w) continue;
    sx += w * Math.sin(rad(g.twd)); sy += w * Math.cos(rad(g.twd)); sv += w * g.tws;
  }
  return { twd: Math.round(deg(Math.atan2(sx, sy))) % 360, tws: +sv.toFixed(1) };
}

/** Wind op tijd en plaats. */
export function fieldWind(F, t, lat, lon) { return sampleGrid(F, fieldAt(F, t), lat, lon); }

/** Kleurschaal windsnelheid (kn), vergelijkbaar met Windy. */
export const SPEED_STOPS = [[0, [98, 113, 183]], [4, [57, 97, 159]], [7, [74, 148, 169]], [10, [77, 166, 77]], [13, [163, 186, 54]], [16, [231, 202, 56]], [19, [237, 141, 49]], [22, [219, 66, 52]], [26, [175, 40, 110]], [32, [112, 32, 130]]];
export function speedColor(kn) {
  const S = SPEED_STOPS; if (kn <= S[0][0]) return S[0][1].slice(); if (kn >= S[S.length - 1][0]) return S[S.length - 1][1].slice();
  let k = 0; while (S[k + 1][0] < kn) k++;
  const [a, ca] = S[k], [b, cb] = S[k + 1], f = (kn - a) / (b - a);
  return ca.map((c, i) => Math.round(c + (cb[i] - c) * f));
}
