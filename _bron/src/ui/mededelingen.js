// Tab "Mededelingen": officiële mededelingen per racedag (uit data/mededelingen.js) en eigen notities per racedag (bewaard op dit toestel).
import { RACES } from '../data/results.js';
import { MEDEDELINGEN, MED_SRC } from '../data/mededelingen.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const dshort = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MAAND[m - 1]}`; };
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function initMededelingen({ store }) {
  const $ = id => document.getElementById(id);
  if (!$('tabMed')) return;
  const dates = RACES.map(r => r.date);
  // standaard: eerstvolgende racedag (vandaag of later), anders de laatste
  let day = dates.find(d => d >= todayIso()) || dates[dates.length - 1];
  let timer = null;
  const notesOf = d => (store.state.medNotes || {})[d] || '';
  const itemsOf = d => MEDEDELINGEN.filter(m => m.date === d || m.date === '');
  function saveNote(d, text) {
    const all = { ...(store.state.medNotes || {}) };
    if (text.trim()) all[d] = text; else delete all[d];
    store.set({ medNotes: all });
  }
  function render() {
    $('medDays').innerHTML = RACES.map(r => {
      const dot = itemsOf(r.date).length || notesOf(r.date).trim() ? ' •' : '';
      return `<button type="button" data-d="${r.date}" aria-pressed="${r.date === day}" title="${esc(r.note || '')}">${esc(r.name)} · ${dshort(r.date)}${dot}</button>`;
    }).join('');
    $('medDays').querySelectorAll('button').forEach(b => b.onclick = () => { flush(); day = b.dataset.d; render(); });
    const R = RACES.find(r => r.date === day);
    $('medTitle').textContent = R ? `${R.name} · ${dshort(R.date)} ${R.date.slice(0, 4)}` : '';
    const items = itemsOf(day).slice().sort((a, b) => (b.prio ? 1 : 0) - (a.prio ? 1 : 0));
    $('medList').innerHTML = items.length ? items.map(m => `<div class="med-item${m.prio ? ' prio' : ''}"><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p>${m.src || m.at ? `<small class="sub">${m.at ? 'overgenomen ' + esc(m.at) : ''}${m.src ? `${m.at ? ' · ' : ''}<a href="${esc(m.src)}" target="_blank" rel="noopener">bron</a>` : ''}</small>` : ''}</div>`).join('')
      : '<p class="sub">Nog geen officiële mededelingen voor deze racedag.</p>';
    $('medSrc').textContent = MED_SRC;
    const ta = $('medNotes'); ta.value = notesOf(day); ta.dataset.d = day;
  }
  function flush() { if (timer) { clearTimeout(timer); timer = null; const ta = $('medNotes'); saveNote(ta.dataset.d, ta.value); } }
  $('medNotes').addEventListener('input', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; const ta = $('medNotes'); saveNote(ta.dataset.d, ta.value); $('medSaved').textContent = 'Opgeslagen op dit toestel.'; }, 400);
    $('medSaved').textContent = '';
  });
  $('medNotes').addEventListener('blur', flush);
  $('medClear').onclick = () => { if (!notesOf(day).trim() && !$('medNotes').value.trim()) return; if (confirm('Notitie van deze racedag wissen?')) { if (timer) { clearTimeout(timer); timer = null; } saveNote(day, ''); render(); } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  render();
  return { render };
}
