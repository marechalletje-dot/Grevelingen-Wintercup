// Zeiltijd, manoeuvres en tijdnotatie. Puur: alle invoer via ctx = {polar, twd, tws, eff, tackS, gybeS}.
import { perf } from './polar.js';
import { twaOf } from './nav.js';
export const BOARD_UP = 0.5, BOARD_DN = 0.75;  // nm per overstag (kruisen) / per gijp (voor de wind)
/** Tijd (uur) voor een deelrak sg = {nm, tw}. */
export function segTime(sg, ctx) { const t = twaOf(ctx.twd, sg.tw); return sg.nm / perf(ctx.polar, t.a, ctx.tws, ctx.eff).vmc; }
export const sailTime = (leg, ctx) => leg.s.reduce((a, sg) => a + segTime(sg, ctx), 0);
export const legTime = (leg, ctx) => sailTime(leg, ctx) + (leg._man ? leg._man.loss : 0);
/** Telt overstagen en gijpen per rak en zet leg._man = {t, g, loss(uur)}. */
export function countManoeuvres(legs, ctx) {
  let prev = null;
  legs.forEach(l => {
    const m = { t: 0, g: 0, loss: 0 };
    l.s.forEach(sg => {
      const t = twaOf(ctx.twd, sg.tw); const p = perf(ctx.polar, t.a, ctx.tws, ctx.eff);
      if (p.mode === 'kruisen') { m.t += Math.max(1, Math.round(sg.nm / BOARD_UP)); prev = null; return; }
      if (p.mode === 'gijpend') { m.g += Math.max(1, Math.round(sg.nm / BOARD_DN)); prev = null; return; }
      if (prev && prev.side !== t.side) { if (t.a >= 90) m.g++; else m.t++; }
      prev = { side: t.side, a: t.a };
    });
    m.loss = (m.t * ctx.tackS + m.g * ctx.gybeS) / 3600; l._man = m;
  });
  return legs;
}
const p2 = n => String(n).padStart(2, '0');
/** Uren -> "m:ss" of "h:mm:ss". */
export function fmtT(h) { const s = Math.round(h * 3600); const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60; return hh ? `${hh}:${p2(mm)}:${p2(ss)}` : `${mm}:${p2(ss)}`; }
/** Minuten (absoluut) -> "m:ss" of "h:mm:ss". */
export function fmtMS(min) { const s = Math.round(Math.abs(min) * 60); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (h ? h + ':' + p2(m) : m) + ':' + p2(ss); }
/** Milliseconden -> "h:mm:ss". */
export function hms(ms) { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 3600)}:${p2(Math.floor(s % 3600 / 60))}:${p2(s % 60)}`; }
export function manTxt(m) { if (!m || (!m.t && !m.g)) return ''; const p = []; if (m.t) p.push(m.t + '× overstag'); if (m.g) p.push(m.g + '× gijp'); return p.join(', ') + ` (+${fmtT(m.loss)})`; }
