// Navigatie en hoeken. Puur.
export const LAT0 = 51.74, LON0 = 3.95;
export const KX = Math.cos(LAT0 * Math.PI / 180) * 60;  // nm per lengtegraad op de Grevelingen
/** lat/lon -> kaartcoördinaten in nm (x oost, y = -noord). */
export const llXY = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * 60];
export const xyLL = (x, y) => [-y / 60 + LAT0, x / KX + LON0];
/** Ware peiling van a naar b (graden). */
export const brgT = (a, b) => (Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180 / Math.PI + 360) % 360;
export const norm360 = v => ((v % 360) + 360) % 360;
export const pad3 = v => String(((Math.round(v) % 360) + 360) % 360).padStart(3, '0') + '°';
const WN = ['N','NNO','NO','ONO','O','OZO','ZO','ZZO','Z','ZZW','ZW','WZW','W','WNW','NW','NNW'];
export const WIND_NAMES = WN;
export const wname = d => WN[Math.round(norm360(d) / 22.5) % 16];
/** Ware windhoek (0..180) en de kant waar de wind vandaan komt (SB/BB) voor een koers tw bij windrichting twd. */
export function twaOf(twd, tw) { const a = ((twd - tw + 540) % 360) - 180; return { a: Math.abs(a), side: a >= 0 ? 'SB' : 'BB' }; }
/** Koerstype bij een TWA. */
export const pos = a => a < 40 ? 'kruisen' : a < 60 ? 'aan de wind' : a < 100 ? 'halve wind' : a < 150 ? 'ruime wind' : a < 160 ? 'bijna voor de wind' : 'voor de wind';
/** Gewogen gemiddelde van hoeken [[hoek, gewicht], ...]. */
export function cmean(arr) { let x = 0, y = 0; arr.forEach(([a, w]) => { x += Math.sin(a * Math.PI / 180) * w; y += Math.cos(a * Math.PI / 180) * w; }); return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360; }
/** Baanas uit de titel in het boekje. */
const AX = {'noord / zuid':[0,180],'oost / west':[90,270],'noord oost / zuid west':[45,225],'zuid west / noord oost':[45,225],'noord west / zuid oost':[135,315],'zuid oost / noord west':[135,315]};
export function axesOf(title) { const t = String(title).toLowerCase().replace(/\s+/g, ' ').trim(); return AX[t] || null; }
/** Past een baan (titel) bij windrichting twd? Binnen 22,5° van een van de assen. */
export function fitsWind(title, twd) { const ax = axesOf(title); if (!ax) return true; return ax.some(a => Math.abs(((twd - a) % 360 + 540) % 360 - 180) <= 22.5); }
/** Punt op afstand nm (zeemijl) en ware koers trueDeg vanaf p (kaartcoördinaten in nm, y = -noord). */
export function offsetNm(p, nm, trueDeg) { const a = trueDeg * Math.PI / 180; return [p[0] + Math.sin(a) * nm, p[1] - Math.cos(a) * nm]; }
/** Afstand (nm), ware (tw) en magnetische (mw) koers van a naar b. */
export function distCrs(a, b, decl) { const t = brgT(a, b); return { nm: Math.hypot(b[0] - a[0], b[1] - a[1]), tw: t, mw: norm360(t - decl) }; }
