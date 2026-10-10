// Ingesproken fragmenten: welke stukjes er zijn, en welke reeks stukjes bij een melding hoort. Puur.
const D = ['nul', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen'];
/** Alle in te spreken fragmenten, in de volgorde van het opnamescherm. */
export const CLIPS = [
  ...D.map((t, i) => ({ k: 'd' + i, t, g: 'Cijfers' })),
  ...[[10, 'tien'], [11, 'elf'], [12, 'twaalf'], [13, 'dertien'], [14, 'veertien'], [15, 'vijftien'], [20, 'twintig'], [30, 'dertig'], [40, 'veertig'], [50, 'vijftig']]
    .map(([n, t]) => ({ k: 'n' + n, t, g: 'Getallen' })),
  { k: 'm5', t: 'vijf minuten', g: 'Start' }, { k: 'm4', t: 'vier minuten', g: 'Start' }, { k: 'm1', t: 'één minuut', g: 'Start' },
  { k: 'start', t: 'start!', g: 'Start' },
  { k: 'over2', t: 'over twee minuten', g: 'Volgend rak' }, { k: 'rak', t: 'rak', g: 'Volgend rak' }, { k: 'koers', t: 'koers', g: 'Volgend rak' },
  { k: 'twa', t: 'T, W, A', g: 'Volgend rak' }, { k: 'sb', t: 'stuurboord', g: 'Volgend rak' }, { k: 'bb', t: 'bakboord', g: 'Volgend rak' },
  { k: 'fin2', t: 'nog twee minuten tot de finish', g: 'Volgend rak' },
  { k: 'spih', t: 'spinnaker hijsen', g: 'Spinnaker' }, { k: 'spis', t: 'spinnaker strijken', g: 'Spinnaker' },
  { k: 'stemaan', t: 'stem aan', g: 'Overig' },
];
export const CLIP_KEYS = new Set(CLIPS.map(c => c.k));
/** Getal als fragmenten: 0-15 en tientallen als één woord, anders cijfer voor cijfer. */
export function numKeys(n) {
  n = Math.round(n);
  if (n >= 0 && n <= 9) return ['d' + n];
  if ([10, 11, 12, 13, 14, 15, 20, 30, 40, 50].includes(n)) return ['n' + n];
  return String(n).split('').map(c => 'd' + c);
}
/** Koers altijd als drie cijfers: 088 -> nul acht acht. */
export const courseKeys = c => String(Math.round(c) % 360).padStart(3, '0').split('').map(x => 'd' + x);
/** Startcountdown (seconden voor de start). */
export function countdownKeys(t) {
  if (t === 300) return ['m5']; if (t === 240) return ['m4']; if (t === 60) return ['m1']; if (t === 0) return ['start'];
  return numKeys(t);
}
export const nextLegKeys = (legNo, course, twa, side) => ['over2', 'rak', ...numKeys(legNo), 'koers', ...courseKeys(course), 'twa', ...String(Math.round(twa)).split('').map(x => 'd' + x), side === 'SB' ? 'sb' : 'bb'];
export const spiKeys = (kind, side) => [kind === 'HIJSEN' ? 'spih' : 'spis', side === 'SB' ? 'sb' : 'bb'];
/** Alle fragmenten aanwezig? */
export const complete = (keys, have) => keys.every(k => have.has(k));
/** Stilte voor en na weghalen (mono samples, -1..1). Houdt een kleine marge. */
export function trimSilence(x, sr, thr = 0.03, padMs = 40) {
  let a = 0, b = x.length - 1;
  while (a < x.length && Math.abs(x[a]) < thr) a++;
  while (b > a && Math.abs(x[b]) < thr) b--;
  if (a >= b) return x.slice(0, 0);
  const pad = Math.round(sr * padMs / 1000);
  return x.slice(Math.max(0, a - pad), Math.min(x.length, b + pad + 1));
}
/** Normaliseren naar een vaste piek, zodat alle fragmenten even hard klinken. */
export function normalize(x, peak = 0.9) { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (!m) return x; const f = peak / m; return x.map(v => v * f); }
