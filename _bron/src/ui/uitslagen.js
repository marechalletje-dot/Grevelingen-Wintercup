// Tab "Uitslagen": tussenstand per groep (Toer-S 1/2/3, ORC 1) en daguitslagen per race.
import { RACES, GROUPS, GROUP_ORDER, RESULTS_SRC } from '../data/results.js';
import { standings, boatKey } from '../core/standings.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const dshort = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MAAND[m - 1]}`; };
const toS = t => { if (!t) return null; const p = t.split(':').map(Number); return p[0] * 3600 + p[1] * 60 + (p[2] || 0); };
const hms = s => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const MINE = new Set(['DREAMMACHINE', 'XCPOLE']);

export function initUitslagen({ store }) {
  const $ = id => document.getElementById(id);
  if (!$('tabUitslag')) return;
  const ids = RACES.map(r => r.id);
  let grp = store.state.uGrp; let race = null;
  const sailedAll = id => GROUP_ORDER.some(g => GROUPS[g].races[id] && GROUPS[g].races[id].length);
  function render() {
    const G = GROUPS[grp]; const S = standings(G, ids);
    $('uGrp').innerHTML = GROUP_ORDER.map(g => `<button type="button" data-g="${g}" aria-pressed="${g === grp}">${esc(GROUPS[g].title)} <small>vlag ${GROUPS[g].flag}</small></button>`).join('');
    $('uGrp').querySelectorAll('button').forEach(b => b.onclick = () => { grp = b.dataset.g; store.set({ uGrp: grp }); render(); });
    $('uCal').innerHTML = RACES.map(r => `<span class="ucal${sailedAll(r.id) ? ' done' : ''}${r.id === race ? ' sel' : ''}" data-r="${r.id}" title="${esc(r.note || '')}"><b>${esc(r.name)}</b>${dshort(r.date)}${sailedAll(r.id) ? ' ✓' : ''}</span>`).join('');
    $('uCal').querySelectorAll('.ucal.done').forEach(s => s.onclick = () => { race = s.dataset.r; render(); });
    const n = S.sailed.length;
    $('uStandInfo').textContent = n ? `Na ${n} ${n === 1 ? 'race' : 'races'} · ${S.discards ? S.discards + ' aftrek' : 'nog geen aftrek'} (aftrek vanaf 6 races, WB 17.6). Voorlopige tussenstand; het officiële totaalklassement wordt opgemaakt na de finale op 20 maart 2027.` : 'Nog geen races gevaren.';
    $('uStandHead').innerHTML = `<tr><th>#</th><th>GC</th><th>Boot</th>${RACES.map(r => `<th class="num" title="${esc(r.name)}">${dshort(r.date)}</th>`).join('')}<th class="num">Totaal</th><th class="num">Netto</th></tr>`;
    $('uStandBody').innerHTML = S.rows.map(b => `<tr class="${MINE.has(b.key) ? 'me' : ''}"><td>${b.rank}</td><td>${esc(b.gc)}</td><td>${esc(b.boat)}<small class="zn">${esc(b.type || '')}</small></td>${RACES.map(r => {
      const p = b.pts[r.id]; if (!p) return '<td class="num muted">–</td>';
      const v = `${String(p.p).replace('.', ',')}${p.code ? ` <small>${p.code}</small>` : ''}`; return `<td class="num">${p.drop ? `(${v})` : v}</td>`;
    }).join('')}<td class="num">${String(b.gross).replace('.', ',')}</td><td class="num"><b>${String(b.net).replace('.', ',')}</b></td></tr>`).join('');
    // daguitslag
    if (!race || !(G.races[race] && G.races[race].length)) race = S.sailed[S.sailed.length - 1] || null;
    const R = RACES.find(r => r.id === race);
    if (R && G.races[race]) {
      const rows = G.races[race]; const w = rows.find(x => x.pl === 1); const wc = w ? toS(w.corr) : null;
      const srcs = R.src ? Object.entries(R.src).map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">uitslag ${k === 'TS' ? 'Toer-S' : k}</a>`).join(' · ') : '';
      $('uRaceTitle').innerHTML = `${esc(R.name)} · ${dshort(R.date)} ${R.date.slice(0, 4)} · ${esc(G.title)} (vlag ${G.flag}), start ${G.start} ${srcs ? '· ' + srcs : ''}`;
      $('uRaceBody').innerHTML = rows.map(x => { const c = toS(x.corr); return `<tr class="${MINE.has(boatKey(x.boat)) ? 'me' : ''}"><td>${esc(x.pl)}</td><td>${esc(x.gc)}</td><td>${esc(x.boat)}<small class="zn">${esc(x.type)} · ${esc(x.skip)}</small></td><td class="num">${esc(x.fin || '–')}</td><td class="num">${esc(x.sail || '–')}</td><td class="num">${esc(x.corr || '–')}</td><td class="num">${c && wc && c > wc ? '+' + hms(c - wc) : (c ? '–' : '')}</td><td class="num">${String(x.pts).replace('.', ',')}</td></tr>`; }).join('');
      $('uRace').hidden = false;
    } else $('uRace').hidden = true;
    $('uSrc').textContent = RESULTS_SRC;
  }
  render();
  return { render };
}
