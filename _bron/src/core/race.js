// Startprocedure: signalen, gesproken countdown en klokweergave. Puur.
export const PREP_MS = 300000;  // 5-minutensein -> start
/** Pieptonen: [seconden voor de start, aantal, frequentie, duur]. */
export const BEEPS = [[240, 2, 880, .25], [60, 3, 880, .25], [10, 1, 1200, .6], [0, 1, 660, 1.4]];
/** Gesproken countdown: [seconden voor de start, tekst]. */
export const VCALLS = [[300,'5 minuten'],[240,'4 minuten'],[60,'1 minuut'],[50,'50'],[40,'40'],[30,'30'],[20,'20'],
  [10,'10'],[9,'9'],[8,'8'],[7,'7'],[6,'6'],[5,'5'],[4,'4'],[3,'3'],[2,'2'],[1,'1'],[0,'start']];
/**
 * Welke signalen moeten nu klinken? left = seconden tot de start, fired = Set met al afgegeven sleutels (wordt bijgewerkt).
 * Een signaal telt alleen binnen een kort venster, zodat er na het ontwaken geen oude signalen klinken.
 */
export function dueSignals(left, fired, voice) {
  const beeps = [], calls = [];
  for (const [t, n, f, d] of BEEPS) {
    if (t === 10 && voice) continue;
    const k = 's' + t; if (left <= t && left > t - 2 && !fired.has(k)) { fired.add(k); beeps.push({ n, f, d }); }
  }
  if (voice) for (const [t, txt] of VCALLS) {
    const k = 'v' + t; if (left <= t && left > t - 1.5 && !fired.has(k)) { fired.add(k); calls.push({ txt, quick: t <= 20, t }); }
  }
  return { beeps, calls };
}
const p2 = n => String(n).padStart(2, '0');
/** Toestand van de grote klok in Racemodus. */
export function clockState(now, start, fin) {
  if (!start) return null;
  if (now < start) {
    const sec = Math.ceil((start - now) / 1000);
    return { phase: 'pre', label: 'START OVER', text: `${Math.floor(sec / 60)}:${p2(sec % 60)}`, cls: sec <= 10 ? 'now' : sec <= 60 ? 'soon' : '' };
  }
  const go = !fin && now - start < 8000;
  return { phase: fin ? 'fin' : 'run', label: fin ? 'GEZEILD' : go ? 'START!' : 'RACE', elapsed: (fin || now) - start, cls: go ? 'go' : '' };
}
