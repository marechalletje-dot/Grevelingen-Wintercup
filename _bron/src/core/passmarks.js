// Merktekens die je alleen aan een kant moet laten liggen (niet ronden): de route snijdt de hoek af naar het volgende merk.
// Puur. Coördinaten in kaarteenheden (nm; x = oost, y = zuid). Kanten: 'BB' = merk links van de boot, 'SB' = rechts.
const EN = p => [p[0], -p[1]];   // naar oost/noord
/** >0 als q links ligt van de richting a→b (in oost/noord-assen). */
export function sideOf(a, b, q) { const A = EN(a), B = EN(b), Q = EN(q); return (B[0] - A[0]) * (Q[1] - A[1]) - (B[1] - A[1]) * (Q[0] - A[0]); }
const okSide = (a, b, m, s) => { const v = sideOf(a, b, m); return s === 'BB' ? v > 0 : v < 0; };
/** Voetpunt van q op het lijnstuk a-b. */
export function foot(a, b, q) { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2)); return [a[0] + t * dx, a[1] + t * dy]; }

/**
 * legs: rakken van de app ({p:[[x,y]…], wp?}); legs[i] (i≥1) eindigt bij marks[i-1].
 * freeIn(i, j): mag punt j van rak i worden overgeslagen (geen vaarwaterboei)? clear(a, b): ligt lijnstuk a-b helemaal in bevaarbaar water?
 * Voor elk merk waar de route van het merk af draait (merk buiten de bocht) en de rechte lijn het merk aan de goede kant laat liggen,
 * wordt de hoek afgesneden: het rak eindigt dan dwars van het merk, het volgende rak begint daar. Geeft de indexen van de passeermerken.
 */
export function cutPassMarks(legs, marks, { clear = () => true, freeIn = () => true, minClear = 0.02 } = {}) {
  const passed = [];
  for (let i = 1; i < legs.length - 1; i++) {
    const m = marks[i - 1]; if (!m || !m.s || m.auto || m.b == null) continue;
    const L = legs[i], N = legs[i + 1]; if (L.p.length < 2 || N.p.length < 2) continue;
    const M = [m.x, m.y];
    let ia = L.p.length - 2, ib = 1;
    const A = () => L.p[ia], B = () => N.p[ib];
    // merk binnen de bocht = echt ronden
    if (!okSide(A(), B(), M, m.s)) continue;
    const valid = () => okSide(A(), B(), M, m.s) && Math.abs(sideOf(A(), B(), M)) / (Math.hypot(B()[0] - A()[0], B()[1] - A()[1]) || 1) >= minClear && clear(A(), B());
    if (!valid()) continue;
    // touw strak trekken over vrije routepunten
    for (let k = 0; k < 6; k++) {
      let moved = false;
      if (ia > 0 && freeIn(i, ia)) { ia--; if (valid()) moved = true; else ia++; }
      if (ib < N.p.length - 1 && freeIn(i + 1, ib)) { ib++; if (valid()) moved = true; else ib--; }
      if (!moved) break;
    }
    const P = foot(A(), B(), M);
    L.p = L.p.slice(0, ia + 1).concat([P]);
    N.p = [P].concat(N.p.slice(ib));
    if (N.wp) N.wp = [null].concat(N.wp.slice(ib));
    if (L.wp) L.wp = L.wp.slice(0, ia + 1).concat([null]);
    passed.push(i - 1);
  }
  return passed;
}
