// Tab "Bepalingen": seinvlaggen tekenen en de startplanner (mijn groep + positie in de kettingstart).
import { GROUPS, chain, slotTimes, hhmm, warnMs } from '../core/startseq.js';

const Y = '#f5c400', B = '#1d4fa0', R = '#d42020', W = '#fff', K = '#111', O = '#f28c00';
const rect = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const FLAGS = {
  H: rect(0, 0, 15, 20, W) + rect(15, 0, 15, 20, R),
  R: rect(0, 0, 30, 20, R) + rect(12, 0, 6, 20, Y) + rect(0, 7, 30, 6, Y),
  W: rect(0, 0, 30, 20, B) + rect(5, 4, 20, 12, W) + rect(10, 7, 10, 6, R),
  Q: rect(0, 0, 30, 20, Y),
  O: rect(0, 0, 30, 20, Y) + `<polygon points="0,0 30,0 30,20" fill="${R}"/>`,
  J: rect(0, 0, 30, 20, B) + rect(0, 6.7, 30, 6.6, W),
  K: rect(0, 0, 15, 20, Y) + rect(15, 0, 15, 20, B),
  F: rect(0, 0, 30, 20, W) + `<polygon points="15,1 28,10 15,19 2,10" fill="${R}"/>`,
  G: [0, 1, 2, 3, 4, 5].map(i => rect(i * 5, 0, 5, 20, i % 2 ? B : Y)).join(''),
  S: rect(0, 0, 30, 20, W) + rect(10, 6, 10, 8, B),
  T: rect(0, 0, 10, 20, R) + rect(10, 0, 10, 20, W) + rect(20, 0, 10, 20, B),
  X: rect(0, 0, 30, 20, W) + rect(12, 0, 6, 20, B) + rect(0, 7, 30, 6, B),
  P: rect(0, 0, 30, 20, B) + rect(10, 6, 10, 8, W),
  I: rect(0, 0, 30, 20, Y) + `<circle cx="15" cy="10" r="5.5" fill="${K}"/>`,
  U: rect(0, 0, 15, 10, R) + rect(15, 0, 15, 10, W) + rect(0, 10, 15, 10, W) + rect(15, 10, 15, 10, R),
  Z: `<polygon points="0,0 30,0 15,10" fill="${Y}"/><polygon points="30,0 30,20 15,10" fill="${B}"/><polygon points="0,20 30,20 15,10" fill="${R}"/><polygon points="0,0 0,20 15,10" fill="${K}"/>`,
  N: [0, 1, 2, 3].flatMap(c => [0, 1, 2, 3].map(r => rect(c * 7.5, r * 5, 7.5, 5, (c + r) % 2 ? W : B))).join(''),
  A: rect(0, 0, 15, 20, W) + `<polygon points="15,0 30,0 22,10 30,20 15,20" fill="${B}"/>`,
  Zwart: rect(0, 0, 30, 20, K),
  Oranje: rect(0, 0, 30, 20, O),
  EV: `<polygon points="0,0 30,10 0,20" fill="${B}"/><polygon points="3,4.5 19,10 3,15.5" fill="${Y}"/>`,
};
export const flagSvg = f => FLAGS[f] ? `<svg class="sflag" viewBox="0 0 30 20" role="img" aria-label="vlag ${f}"><title>${f}</title>${FLAGS[f]}<rect x=".5" y=".5" width="29" height="19" fill="none" stroke="#0004"/></svg>` : '';

export function initRegels({ store, setSig5, toRace }) {
  const $ = id => document.getElementById(id);
  document.querySelectorAll('#tabRegels [data-f]').forEach(el => { el.innerHTML = flagSvg(el.dataset.f); });
  const grp = $('wbGrp'), pos = $('wbPos');
  if (!grp) return;
  grp.innerHTML = GROUPS.map(g => `<option value="${g.id}">${g.name} · vlag ${g.flag}</option>`).join('');
  pos.innerHTML = GROUPS.map((_, i) => `<option value="${i + 1}">${i + 1}e start</option>`).join('');
  grp.value = store.state.wbGrp; pos.value = String(store.state.wbPos);
  const render = () => {
    const g = GROUPS.find(x => x.id === grp.value) || GROUPS[0]; const p = +pos.value; const t = slotTimes(p);
    $('wbMine').innerHTML = `<div class="wb-flag">${flagSvg(g.flag)}<b>${g.name}</b></div>
      <div class="wb-times"><span>oranje vlag <b>${hhmm(t.orange)}</b></span><span>waarschuwing (vlag ${g.flag} op) <b>${hhmm(t.warn)}</b></span>
      <span>voorbereiding (P/I/Z/U/zwart op) <b>${hhmm(t.prep)}</b></span><span>1 minuut (voorbereidingsvlag neer) <b>${hhmm(t.oneMin)}</b></span>
      <span class="wb-start">START (vlag ${g.flag} neer) <b>${hhmm(t.start)}</b></span></div>`;
    $('wbChain').innerHTML = chain(GROUPS.length).map(c => `<tr${c.pos === p ? ' class="me"' : ''}><td>${c.pos}</td><td>${hhmm(c.warn)}</td><td>${hhmm(c.start)}</td><td>${c.pos === p ? g.name + ' ' + flagSvg(g.flag) : ''}</td></tr>`).join('');
  };
  grp.onchange = () => { store.set({ wbGrp: grp.value }); render(); };
  pos.onchange = () => { store.set({ wbPos: +pos.value }); render(); };
  $('wbToRace').onclick = () => {
    const ms = warnMs(+pos.value); setSig5(ms);
    $('wbSet').textContent = `5-minutensein ${hhmm(slotTimes(+pos.value).warn)} gezet in Racemodus.`;
    if (toRace) toRace();
  };
  render();
}
