// Laylines en startlijn-maten. Puur. Coördinaten in de kaarteenheid van de app (nm; x = oost, y = zuid).
import { interpTws } from './polar.js';

const R = Math.PI / 180;
const dir = h => [Math.sin(h * R), -Math.cos(h * R)];
const norm = a => ((a % 360) + 360) % 360;

/** Optimale kruishoek (TWA) uit de polar bij windsnelheid tws. */
export function beatAngle(polar, tws) { return interpTws(polar, polar.beatAng, tws); }

/**
 * Laylines naar een bovenwinds merkteken: de koersen waarmee je het merk aan de wind net haalt.
 * Stuurboordslag vaart TWD − kruishoek, bakboordslag TWD + kruishoek (ware koersen). Lijnen lopen vanaf het merk terug.
 */
export function laylines(mark, twd, beat, len = 1) {
  const hs = norm(twd - beat), hb = norm(twd + beat);
  const [sx, sy] = dir(hs), [bx, by] = dir(hb);
  return { sb: { hdg: hs, from: [mark[0] - sx * len, mark[1] - sy * len], to: mark }, bb: { hdg: hb, from: [mark[0] - bx * len, mark[1] - by * len], to: mark } };
}

/** Loodrechte afstand (nm) van punt p tot de lijn door a en b, en de voet van de loodlijn. */
export function perpToLine(a, b, p) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  if (!L2) return { d: Math.hypot(p[0] - a[0], p[1] - a[1]), foot: a.slice() };
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2; const foot = [a[0] + t * dx, a[1] + t * dy];
  return { d: Math.hypot(p[0] - foot[0], p[1] - foot[1]), foot, t };
}

/** Ware peiling van a naar b (°). */
export const bearingXY = (a, b) => norm(Math.atan2(b[0] - a[0], -(b[1] - a[1])) / R);

/**
 * Maten van de bovenboei t.o.v. de startlijn. line = [pin, schip] of null (dan staat de lijn haaks op start→boei).
 * Geeft: loodrechte afstand (nm), ware koers vanaf het midden van de startlijn en de haakse koers op de lijn naar de boeikant.
 */
export function gateFromLine(start, gate, line = null) {
  const mid = line ? [(line[0][0] + line[1][0]) / 2, (line[0][1] + line[1][1]) / 2] : start;
  const dist = Math.hypot(gate[0] - mid[0], gate[1] - mid[1]);
  const perp = line ? perpToLine(line[0], line[1], gate).d : dist;
  return { perp, dist, crs: bearingXY(mid, gate), mid };
}
