// Vak "Windverwachting" (tab Banenkaart): modelverwachting ophalen, uurtabel, gemiddelde wind tijdens de race en racesimulatie.
import { MODELS, pickModel, forecastUrl, parseForecast, windAt, avgWind, simulate } from '../core/wx.js';
import { RACES } from '../data/results.js';
import { wname } from '../core/nav.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const DAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const dlabel = s => { const [y, m, d] = s.split('-').map(Number); const D = new Date(y, m - 1, d); return `${DAG[D.getDay()]} ${d} ${MND[m - 1]}`; };
const arrow = twd => `<span class="wxarr" style="transform:rotate(${twd}deg)" aria-hidden="true">↓</span>`;
const fmtH = h => { const s = Math.round(h * 3600); return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };

export function initWx({ store, getLegs, getCtx, getStart, applyWind, onChange = () => {} }) {
  const $ = id => document.getElementById(id);
  if (!$('wxGet')) return { series: () => null, demoWind: () => null };
  let WX = store.state.wxData && store.state.wxData.series ? store.state.wxData : null;
  let SIM = null;
  // dagkeuze: vandaag t/m 3 dagen vooruit + wedstrijddagen binnen 15 dagen
  function days() {
    const now = new Date(); const out = new Map();
    for (let k = 0; k < 4; k++) { const d = new Date(now); d.setDate(d.getDate() + k); out.set(iso(d), dlabel(iso(d)) + (k === 0 ? ' (vandaag)' : k === 1 ? ' (morgen)' : '')); }
    for (const r of RACES) { const t = Date.parse(r.date + 'T12:00:00'); if (t > Date.now() - 86400e3 && t < Date.now() + 15 * 86400e3) out.set(r.date, `${dlabel(r.date)} · ${r.name}`); }
    return [...out.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }
  function nextRaceDay() { const r = RACES.find(r => Date.parse(r.date + 'T18:00:00') > Date.now()); return r && Date.parse(r.date) - Date.now() < 15 * 86400e3 ? r.date : null; }
  function fillSelects() {
    const D = days(); let cur = store.state.wxDay;
    if (!D.some(([k]) => k === cur)) cur = nextRaceDay() || D[1][0];
    $('wxDay').innerHTML = D.map(([k, l]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${esc(l)}</option>`).join('');
    $('wxModel').innerHTML = Object.entries(MODELS).map(([k, l]) => `<option value="${k}"${k === store.state.wxModel ? ' selected' : ''}>${esc(l)}</option>`).join('');
    $('wxDemo').checked = !!store.state.wxDemo;
  }
  const day = () => $('wxDay').value;
  async function fetchWx() {
    const d = day(); const model = pickModel($('wxModel').value, d); const url = forecastUrl(model, d);
    $('wxInfo').textContent = 'Verwachting ophalen…'; $('wxGet').disabled = true;
    try {
      const r = await fetch(url); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.reason || ('HTTP ' + r.status));
      const series = parseForecast(j);
      WX = { day: d, model, fetched: Date.now(), series };
      store.set({ wxData: WX });
    } catch (e) {
      $('wxInfo').textContent = `Ophalen mislukt (${e.message}). Probeer een ander model of controleer de internetverbinding.`;
      $('wxGet').disabled = false; return;
    }
    $('wxGet').disabled = false; render();
  }
  function render() {
    SIM = null;
    const ok = WX && WX.day === day();
    $('wxOut').hidden = !ok; $('wxSimBox').hidden = true;
    if (!ok) { $('wxInfo').textContent = WX ? `Opgeslagen verwachting is voor ${dlabel(WX.day)}; haal de verwachting voor deze dag op.` : 'Nog geen verwachting opgehaald.'; onChange(); return; }
    const start = getStart(WX.day); const legs = getLegs();
    let end = start + 3 * 3600e3;
    if (legs && legs.length) { SIM = simulate(legs, getCtx(), WX.series, start); end = SIM.finish; }
    const A = avgWind(WX.series, start, end);
    $('wxInfo').innerHTML = `${esc(MODELS[WX.model] || WX.model)} · opgehaald ${new Date(WX.fetched).toLocaleString('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`;
    const rows = WX.series.filter(s => s.h >= 9 && s.h <= 17);
    $('wxBody').innerHTML = rows.map(s => { const inRace = s.t > start - 3600e3 && s.t <= end; return `<tr class="${inRace ? 'race' : ''}"><td>${pad(s.h)}:00</td><td>${arrow(s.twd)} ${String(s.twd).padStart(3, '0')}° <small>${wname(s.twd)}</small></td><td class="num">${Math.round(s.tws)}</td><td class="num">${s.gust != null ? Math.round(s.gust) : '–'}</td></tr>`; }).join('');
    $('wxAvg').innerHTML = `Tijdens de race (${hm(start)}–${hm(end)}): <b>${String(A.twd).padStart(3, '0')}° ${wname(A.twd)}, ${A.tws.toFixed(0)} kn</b> (${Math.round(A.min)}–${Math.round(A.max)} kn)`;
    $('wxUse').onclick = () => { applyWind(Math.round(A.twd / 5) * 5 % 360, Math.max(4, Math.min(24, Math.round(A.tws)))); render(); };
    onChange();
  }
  function renderSim() {
    if (!SIM) return;
    $('wxSimBox').hidden = false;
    $('wxSimHead').textContent = `Start ${hm(SIM.start)} · finish ${hm(SIM.finish)} · zeiltijd ${fmtH(SIM.hours)}`;
    $('wxSimBody').innerHTML = SIM.legs.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.to)}</td><td class="num">${hm(l.start)}</td><td>${String(l.twd).padStart(3, '0')}° ${Math.round(l.tws)} kn</td><td class="num">${Math.round(l.twa)}° ${l.side}</td><td class="num">${l.kn.toFixed(1)}</td><td class="num">${fmtH((l.end - l.start) / 3600e3)}</td></tr>`).join('');
  }
  $('wxGet').onclick = fetchWx;
  $('wxDay').onchange = () => { store.set({ wxDay: day() }); render(); };
  $('wxModel').onchange = () => store.set({ wxModel: $('wxModel').value });
  $('wxSim').onclick = () => { render(); renderSim(); };
  $('wxDemo').onchange = () => store.set({ wxDemo: $('wxDemo').checked });
  if ($('rWx').tagName === 'DETAILS') { $('rWx').open = !!store.state.wxOpen; $('rWx').addEventListener('toggle', () => store.set({ wxOpen: $('rWx').open })); }
  fillSelects(); render();
  return {
    refresh: () => { if (WX && WX.day === day()) { const vis = !$('wxSimBox').hidden; render(); if (vis) renderSim(); } },
    series: () => (WX && WX.day === day() ? WX.series : null),
    // wind voor de proefvaart: {start (ms), at(t)} of null
    demoWind: () => (store.state.wxDemo && WX && WX.day === day() ? { start: getStart(WX.day), at: t => windAt(WX.series, t) } : null),
  };
}
