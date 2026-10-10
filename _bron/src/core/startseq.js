// Startvolgorde Grevelingen Wintercup (WB art. 5.3, 11.1, 11.3):
// - 1e waarschuwingssein 10:55; oranje vlag 5 min ervoor (10:50).
// - Waarschuwing = startgroepvlag (5 min voor de start); het waarschuwingssein van de volgende start
//   volgt direct na het startsein van de vorige start (kettingstart, elke 5 minuten).
export const FIRST_WARN = '10:55';
export const GROUPS = [
  { id: 'TS1', name: 'Toer-S 1', flag: 'H' },
  { id: 'TS2', name: 'Toer-S 2', flag: 'R' },
  { id: 'TS3', name: 'Toer-S 3', flag: 'W' },
  { id: 'T1', name: 'Toer 1', flag: 'Q' },
  { id: 'T2', name: 'Toer 2', flag: 'O' },
  { id: 'T3', name: 'Toer 3', flag: 'J' },
  { id: 'ORC1', name: 'ORC 1', flag: 'K' },
  { id: 'ORC2', name: 'ORC 2', flag: 'F' },
  { id: 'MH', name: 'Multihull', flag: 'G' },
];
const toMin = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
export const hhmm = min => String(Math.floor(min / 60) % 24).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');

/** Tijden (minuten na middernacht) voor de start op positie pos (1 = eerste start) in een kettingstart. */
export function slotTimes(pos, firstWarn = FIRST_WARN, gap = 5) {
  pos = Math.max(1, Math.round(+pos) || 1);
  const warn = toMin(firstWarn) + (pos - 1) * gap;
  return { orange: toMin(firstWarn) - 5, warn, prep: warn + 1, oneMin: warn + 4, start: warn + 5 };
}

/** Hele kettingstart: n starts vanaf firstWarn. */
export function chain(n, firstWarn = FIRST_WARN, gap = 5) {
  return Array.from({ length: Math.max(0, n) }, (_, i) => ({ pos: i + 1, ...slotTimes(i + 1, firstWarn, gap) }));
}

/** Unix-ms van het waarschuwingssein (= 5-minutensein) op de gegeven dag. */
export function warnMs(pos, day = new Date(), firstWarn = FIRST_WARN, now = Date.now()) {
  const t = slotTimes(pos, firstWarn); const d = new Date(day);
  d.setHours(Math.floor(t.warn / 60), t.warn % 60, 0, 0);
  // al voorbij (meer dan een uur geleden)? dan is de start van de volgende dag bedoeld
  if (now != null && d.getTime() < now - 3600e3) d.setDate(d.getDate() + 1);
  return d.getTime();
}
