// Handicap-rekenwerk (gecorrigeerde tijd = gezeilde tijd × factor). Puur.
export const corrected = (sailedMin, factor) => sailedMin * factor;
/** Gezeilde tijd (min) waarbij een boot met factor f gelijk eindigt met jou (tijd T, factor myf). */
export const tieTime = (T, myf, f) => T * myf / f;
/** Marge (min): + = de ander moet zoveel eerder finishen; - = jij moet zoveel eerder finishen. */
export const lagMin = (T, myf, f) => T - tieTime(T, myf, f);
/** Marge omgerekend naar meters bij snelheid kn. */
export const lagMeters = (lag, kn) => Math.abs(lag) * 60 / 3600 * kn * 1852;
/**
 * Marges t.o.v. alle meetellende boten. rows = [{boat, f, on}].
 * Geeft per boot {tie, lag, m} en de kritische boten vóór (ahead) en achter (behind).
 */
export function margins(rows, T, myf, kn) {
  let ahead = null, behind = null;
  const out = rows.map(x => {
    if (!x.f) return { x, tie: null, lag: null, m: null };
    const tie = tieTime(T, myf, x.f), lag = T - tie, m = lagMeters(lag, kn);
    if (x.on) { if (lag < 0 && (!ahead || lag < ahead.lag)) ahead = { x, lag }; if (lag >= 0 && (!behind || lag < behind.lag)) behind = { x, lag }; }
    return { x, tie, lag, m };
  });
  return { rows: out, ahead, behind };
}
