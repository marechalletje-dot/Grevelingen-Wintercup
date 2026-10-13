// Tab "Post Race Analyses": GPS-track (opgenomen in de app, GPX/CSV-bestand of AIS via eigen API-sleutel) vergelijken met
// de simulatie vóór de race en met de polar, met de actuele (achteraf) modelwind van de racedag op plaats en tijd.
import { parseTrackFile, parseAisJson, aisUrl, vesselApiUrl, findNextToken, cleanTrack, addMotion, matchMarks, perfSeries, legStats, overall, packTrack, unpackTrack, distNm } from '../core/analysis.js';
import { fieldUrl, parseField, fieldWind, fieldAt, sampleGrid } from '../core/wxfield.js';
import { simulate } from '../core/wx.js';
import { RACES } from '../data/results.js';
import { wname } from '../core/nav.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(2, '0');
const isoOf = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const hm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const hms = t => { const d = new Date(t); return `${hm(t)}:${pad(d.getSeconds())}`; };
const fmtH = h => { if (h == null || !isFinite(h)) return '–'; const s = Math.round(Math.abs(h) * 3600); return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
const fmtD = h => { if (h == null || !isFinite(h)) return '–'; const s = Math.round(h * 3600), a = Math.abs(s); return `${s > 0 ? '+' : s < 0 ? '−' : '±'}${Math.floor(a / 60)}:${pad(a % 60)}`; };
const pct = r => (r == null ? '–' : Math.round(r * 100) + '%');
const DAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const dlabel = s => { const [y, m, d] = s.split('-').map(Number); const D = new Date(y, m - 1, d); return `${DAG[D.getDay()]} ${d} ${MND[m - 1]} ${y}`; };
const LS = {
  get(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  keys(pre) { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(pre)) out.push(k); } } catch (e) {} return out; },
};
const K_TRK = 'wc_trk_', K_SIM = 'wc_presim_', K_ACT = 'wc_act_', K_AIS = 'wc_ais';

// ---------- opname tijdens de race (aangeroepen vanuit de GPS-afhandeling) ----------
const REC = { day: null, doc: null, last: 0, dirty: 0 };
function recFlush() { if (REC.doc && REC.dirty) { LS.set(K_TRK + REC.day, REC.doc); REC.dirty = 0; } }
/** Eén GPS-punt opnemen (min. 5 s tussen punten). meta = {baan, area, boat, start}. */
export function recordFix(t, lat, lon, meta) {
  if (!isFinite(lat) || !isFinite(lon) || t - REC.last < 5000) return;
  const day = isoOf(t);
  if (REC.day !== day) { recFlush(); REC.day = day; const old = LS.get(K_TRK + day); REC.doc = old && old.src === 'app' ? old : { day, src: 'app', meta: {}, pts: [] }; }
  REC.doc.pts.push([Math.round(t / 1000), Math.round(lat * 1e5), Math.round(lon * 1e5)]);
  REC.doc.meta = { ...REC.doc.meta, ...meta }; REC.doc.saved = Date.now(); REC.last = t;
  if (++REC.dirty >= 6) recFlush();
}
if (typeof document !== 'undefined') { document.addEventListener('visibilitychange', () => { if (document.hidden) recFlush(); }); addEventListener('pagehide', recFlush); }

/** Simulatie vóór de race bewaren (laatste versie vóór de start telt). */
export function savePreSim(day, sim, meta) {
  if (!sim || !sim.legs || !sim.legs.length || Date.now() > sim.start) return;
  LS.set(K_SIM + day, { day, saved: Date.now(), ...meta, start: sim.start, finish: sim.finish, field: !!sim.field,
    legs: sim.legs.map(l => ({ to: l.to, start: l.start, end: l.end, twd: l.twd, tws: l.tws, twa: Math.round(l.twa), side: l.side, kn: +l.kn.toFixed(2) })) });
}

export function initAnalysis(o) {
  const $ = id => (id === 'paKeyRow' ? [...document.querySelectorAll('.pa-keyrow')] : document.getElementById(id));
  if (!$('tabAnalyse')) return { render() {} };
  const { getLegs, getMeta, setCourse, getPolar, getCtx, xyLL, waterD, slotStart, boats } = o;
  let A = { day: null, trk: null, act: null };

  // ---------- dagen ----------
  function days() {
    const today = isoOf(Date.now()); const m = new Map();
    for (const r of RACES) if (r.date <= today) m.set(r.date, `${dlabel(r.date)} · ${r.name}`);
    for (const k of LS.keys(K_TRK)) { const d = k.slice(K_TRK.length); if (!m.has(d)) m.set(d, dlabel(d) + ' · eigen track'); }
    if (!m.has(today)) m.set(today, dlabel(today) + ' (vandaag)');
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }
  const hasTrk = k => { const t = LS.get(K_TRK + k); return !!(t && t.pts && t.pts.length >= 20); };
  function fillDays() {
    const D = days(); let cur = A.day || $('paDay').value;
    if (!D.some(([k]) => k === cur)) cur = (D.find(([k]) => hasTrk(k)) || D.find(([k]) => RACES.some(r => r.date === k)) || D[0])[0];
    $('paDay').innerHTML = D.map(([k, l]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${esc(l)}${hasTrk(k) ? ' ✓' : ''}</option>`).join('');
    A.day = cur;
  }
  const ais = () => { const a = { provider: 'vesselapi', mmsi: '', key: '', tpl: '', ...(LS.get(K_AIS) || {}) }; if (!a.mmsi && getMeta().boat === 'dm') a.mmsi = '244001631'; return a; };  // MMSI Dream Machine
  function fillAis() { const a = ais(); $('paProv').value = a.provider; $('paMmsi').value = a.mmsi; $('paKey').value = a.key; $('paTpl').value = a.tpl; $('paTplRow').hidden = !['custom', 'proxy'].includes(a.provider); $('paKeyRow').forEach(e => e.hidden = a.provider === 'proxy'); }
  function saveAis() { LS.set(K_AIS, { provider: $('paProv').value, mmsi: $('paMmsi').value.trim(), key: $('paKey').value.trim(), tpl: $('paTpl').value.trim() }); $('paTplRow').hidden = !['custom', 'proxy'].includes($('paProv').value); $('paKeyRow').forEach(e => e.hidden = $('paProv').value === 'proxy'); }

  // ---------- gegevens van de gekozen dag ----------
  function load() {
    const d = A.day; A.trk = LS.get(K_TRK + d); A.act = LS.get(K_ACT + d); A.sim = LS.get(K_SIM + d);
    const m = { ...(A.sim || {}), ...((A.trk && A.trk.meta) || {}) };
    const st = m.start && isoOf(m.start) === d ? m.start : slotStart(d);
    $('paStart').value = hms(st);
    const cur = getMeta();
    $('paCourse').innerHTML = `Baan <b>${esc(cur.baan)}</b> · startgebied ${esc(cur.area)} · ${esc(boats[cur.boat] ? boats[cur.boat].name : cur.boat)} <span class="sub">(uit Race preparation)</span>`;
    const differs = m.baan && (+m.baan !== +cur.baan || (m.area && m.area !== cur.area) || (m.boat && m.boat !== cur.boat));
    $('paUseCourse').hidden = !differs; if (differs) $('paUseCourse').textContent = `Gebruik baan ${m.baan}${m.area ? ' / ' + m.area : ''}${m.boat && boats[m.boat] ? ' · ' + boats[m.boat].name : ''} van deze race`;
    A.meta = m;
    { const c = getCtx(); $('paManBaan').value = (A.sim && A.sim.manual && A.sim.baan) || m.baan || cur.baan; $('paManTwd').value = A.sim && A.sim.manual ? A.sim.manual.twd : c.twd; $('paManTws').value = A.sim && A.sim.manual ? A.sim.manual.tws : c.tws; }
    // track
    if (A.trk && A.trk.pts && A.trk.pts.length >= 20) {
      const P = unpackTrack(A.trk.pts); const src = { app: 'opgenomen in de app', file: 'uit bestand' + (A.trk.name ? ' ' + A.trk.name : ''), ais: 'AIS (' + (A.trk.provider || 'API') + ')' }[A.trk.src] || A.trk.src;
      $('paTrk').innerHTML = `✓ Track ${esc(src)}: ${P.length} punten, ${hm(P[0].t)}–${hm(P[P.length - 1].t)}`;
      $('paDel').hidden = false;
    } else { $('paTrk').textContent = 'Nog geen track voor deze dag. Neem op in de tab Race, laad een GPX/CSV-bestand of haal AIS-data op.'; $('paDel').hidden = true; }
    $('paSimInfo').textContent = A.sim ? `Simulatie vooraf${A.sim.manual ? ` (achteraf gemaakt: ${String(A.sim.manual.twd).padStart(3, '0')}° ${A.sim.manual.tws} kn constant)` : ` bewaard ${hm(A.sim.saved)}`} · baan ${A.sim.baan || '?'} · start ${hm(A.sim.start)} · finish ${hm(A.sim.finish)}.` : 'Geen simulatie vóór de race bewaard (wordt bewaard zodra je vóór de start de windverwachting ophaalt in Race preparation).';
    $('paWxInfo').textContent = A.act ? `Actuele modelwind ${A.act.model.replace('_seamless', '').toUpperCase()} opgehaald ${new Date(A.act.fetched).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.` : 'Nog niet opgehaald.';
  }
  const startMs = () => { const [h, mi, s] = ($('paStart').value || '11:00:00').split(':').map(Number); const [y, m, d] = A.day.split('-').map(Number); return new Date(y, m - 1, d, h || 0, mi || 0, s || 0).getTime(); };

  // ---------- bronnen ----------
  function storeTrack(pts, src, extra = {}) {
    const P = cleanTrack(pts);
    if (P.length < 10) throw new Error(pts.length && !pts.some(p => isFinite(p.t)) ? 'de punten hebben geen tijden' : 'te weinig bruikbare punten');
    const days = new Map(); P.forEach(p => days.set(isoOf(p.t), (days.get(isoOf(p.t)) || 0) + 1));
    const day = [...days.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const dayPts = P.filter(p => isoOf(p.t) === day);
    const ok = LS.set(K_TRK + day, { day, src, ...extra, meta: (LS.get(K_TRK + day) || {}).meta || {}, pts: packTrack(dayPts), saved: Date.now() });
    if (!ok) throw new Error('opslaan op dit toestel mislukt (geheugen vol?)');
    A.day = day; return dayPts.length;
  }
  async function onFile(f) {
    const msg = $('paMsg'); msg.textContent = 'Bestand lezen…';
    try { const n = storeTrack(parseTrackFile(await f.text(), f.name), 'file', { name: f.name }); msg.textContent = `${n} punten ingelezen.`; fillDays(); load(); await analyse(); }
    catch (e) { msg.textContent = `Bestand niet bruikbaar: ${e.message}. Gebruik GPX met tijden, of CSV met kolommen tijd, lat en lon.`; }
  }
  async function fetchAis() {
    saveAis(); const a = ais(); const msg = $('paMsg');
    if (!a.mmsi || (a.provider !== 'proxy' && !a.key) || (['custom', 'proxy'].includes(a.provider) && !a.tpl)) { msg.textContent = a.provider === 'proxy' ? 'Vul MMSI en de URL van je Apps Script-proxy in.' : 'Vul MMSI en API-sleutel in (en bij eigen dienst het URL-sjabloon).'; return; }
    msg.textContent = 'AIS-data ophalen…';
    try {
      const get = async (u, hdr) => { const r = await fetch(u, hdr ? { headers: hdr } : undefined); const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error((j && (j.message || j.error && (j.error.message || j.error) || j.meta && j.meta.message)) || 'HTTP ' + r.status); return j; };
      let pts = [];
      if (a.provider === 'vesselapi') {
        let next = null, pages = 0;
        do { const j = await get(vesselApiUrl(a.mmsi, A.day, next), { Authorization: 'Bearer ' + a.key }); pts = pts.concat(parseAisJson(j)); next = findNextToken(j); pages++; msg.textContent = `AIS-data ophalen… ${pts.length} posities`; } while (next && pages < 30);
      } else if (a.provider === 'proxy') {
        const j = await get(a.tpl + (a.tpl.includes('?') ? '&' : '?') + new URLSearchParams({ mmsi: a.mmsi, day: A.day }).toString());
        if (j && j.error) throw new Error(j.error); pts = parseAisJson(j);
      } else pts = parseAisJson(await get(aisUrl(a, A.day)));
      if (!pts.length) throw new Error('geen posities voor deze dag (valt het schip buiten het bereik van AIS-ontvangers, of is de dag ouder dan de dienst bewaart?)');
      const n = storeTrack(pts, 'ais', { provider: { custom: 'eigen dienst', vesselapi: 'VesselAPI', datalastic: 'Datalastic', proxy: 'VesselAPI via proxy' }[a.provider] });
      msg.textContent = `${n} AIS-posities opgehaald.`; fillDays(); load(); await analyse();
    } catch (e) {
      const net = /fetch|network/i.test(e.message);
      msg.textContent = net && a.provider !== 'proxy' ? `AIS ophalen mislukt: de dienst staat aanvragen rechtstreeks vanuit de browser niet toe. Kies bij Dienst "VesselAPI via eigen proxy (Google Apps Script)" en volg de stappen in de Uitleg.` : `AIS ophalen mislukt (${e.message}). Controleer MMSI, sleutel/proxy en tegoed.`;
    }
  }
  async function fetchActual() {
    const d = A.day; const info = $('paWxInfo'); info.textContent = 'Actuele modelwind ophalen…'; $('paWx').disabled = true;
    const tries = [['knmi_seamless', 'https://historical-forecast-api.open-meteo.com'], ['knmi_seamless', 'https://api.open-meteo.com'], ['best_match', 'https://historical-forecast-api.open-meteo.com']];
    let err = null;
    for (const [model, host] of tries) {
      try {
        const u = fieldUrl(model, d).replace('https://api.open-meteo.com', host);
        const r = await fetch(u); const j = await r.json(); if (!r.ok || (j && j.error)) throw new Error((j && j.reason) || 'HTTP ' + r.status);
        const field = parseField(j);
        A.act = { day: d, model, host: host.includes('historical') ? 'historical' : 'forecast', fetched: Date.now(), field }; LS.set(K_ACT + d, A.act); err = null; break;
      } catch (e) { err = e; }
    }
    $('paWx').disabled = false;
    if (err) { info.textContent = `Ophalen mislukt (${err.message}).`; return false; }
    load(); return true;
  }

  // ---------- analyse ----------
  async function analyse() {
    const out = $('paOut'); const msg = $('paMsg');
    if (!A.trk || !A.trk.pts || A.trk.pts.length < 20) { out.hidden = true; return; }
    const legs = getLegs(); if (!legs || !legs.length) { msg.textContent = 'Geen baan beschikbaar.'; return; }
    if (!A.act && navigator.onLine !== false) await fetchActual();
    const start = startMs();
    const marks = legs.map(l => { const p = l.p[l.p.length - 1]; return xyLL(p[0], p[1]); });
    const P0 = addMotion(cleanTrack(unpackTrack(A.trk.pts), { t0: start - 60e3 }));
    if (P0.length < 10) { msg.textContent = 'Te weinig trackpunten na de start. Controleer de starttijd.'; out.hidden = true; return; }
    const F = A.act && A.act.field;
    const windFn = F ? (t, la, lo) => fieldWind(F, t, la, lo) : () => null;
    const P = perfSeries(P0, windFn, getPolar(A.metaBoat()));
    const rounds = matchMarks(P, marks);
    const L = legStats(P, rounds, start);
    const OV = overall(L);
    // ideale polar-tijd met de actuele wind (zelfde rekenwijze als de simulatie vooraf, rendement 100%)
    let ideal = null;
    if (F) {
      const mid = F.series[Math.floor(F.series.length / 2)];
      const ctx = { ...getCtx(), polar: getPolar(A.metaBoat()), eff: 100 };
      ideal = simulate(legs, ctx, mid, start, (t, xy) => { const [la, lo] = xyLL(xy[0], xy[1]); return sampleGrid(F, fieldAt(F, t), la, lo); });
    }
    const pre = A.sim && A.sim.legs && A.sim.legs.length === legs.length ? A.sim : null;
    renderSummary(L, OV, ideal, pre, start, F);
    renderTable(legs, L, ideal, pre, start);
    renderMap(P, legs, rounds);
    renderCharts(P, L, start, ideal, pre);
    out.hidden = false;
    const miss = rounds.filter(r => !r || !r.ok).length;
    msg.textContent = miss ? `Let op: ${miss} merkteken(s) niet duidelijk gerond in de track (grootste afstand ${Math.max(...rounds.map(r => (r ? r.d : 9))).toFixed(2)} nm). Klopt de baan?` : '';
  }
  A.metaBoat = () => getMeta().boat;

  function renderSummary(L, OV, ideal, pre, start, F) {
    const fin = L.filter(Boolean).pop(); const act = fin ? (fin.t1 - start) / 3600e3 : null;
    const preH = pre ? (pre.finish - pre.start) / 3600e3 : null, idH = ideal ? ideal.hours : null;
    let wind = '–';
    if (F) { const ws = L.filter(x => x && x.tws != null); if (ws.length) { const T = ws.reduce((a, x) => a + x.dur, 0); wind = `${Math.round(ws.reduce((a, x) => a + x.tws * x.dur, 0) / T)} kn`; } }
    const preW = pre ? `${Math.round(pre.legs.reduce((a, l) => a + l.tws, 0) / pre.legs.length)} kn` : null;
    const k = (lab, val, sub) => `<div class="pa-kpi"><small>${lab}</small><b>${val}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
    $('paSum').innerHTML =
      k('Zeiltijd werkelijk', fmtH(act), fin ? `finish ${hms(fin.t1)}` : '') +
      k('Simulatie vooraf', preH != null ? fmtH(preH) : '–', preH != null && act != null ? `${fmtD(act - preH)} ${act > preH ? 'langzamer' : 'sneller'}` : 'niet bewaard') +
      k('Polar met actuele wind', idH != null ? fmtH(idH) : '–', idH != null && act != null ? `${fmtD(act - idH)} t.o.v. 100% polar` : 'geen winddata') +
      k('Prestatie t.o.v. polar', pct(OV.ratio), 'gem. bootsnelheid / polarsnelheid') +
      k('Wind (model, achteraf)', wind, preW ? `verwacht ${preW}` : '');
  }

  function renderTable(legs, L, ideal, pre, start) {
    const rows = legs.map((l, i) => {
      const x = L[i]; const s = pre ? pre.legs[i] : null; const id = ideal ? ideal.legs[i] : null;
      const sd = s ? (s.end - s.start) / 3600e3 : null, idd = id ? (id.end - id.start) / 3600e3 : null;
      const cls = x && x.ratio != null ? (x.ratio < 0.85 ? 'lo' : x.ratio < 0.95 ? 'mlo' : x.ratio > 1.05 ? 'hi' : 'ok') : '';
      const name = i === 0 ? 'Gate' : l.t;
      return `<tr><td class="num no">${i + 1}</td><td class="to">${esc(name)}${x && !x.ok ? '<small class="warn">niet gerond?</small>' : ''}</td>
        <td class="num">${x ? fmtH(x.dur) : '–'}<small>${x ? hm(x.t1) : ''}</small></td>
        <td class="num">${fmtH(sd)}<small>${sd != null && x ? fmtD(x.dur - sd) : ''}</small></td>
        <td class="num">${fmtH(idd)}<small>${idd != null && x ? fmtD(x.dur - idd) : ''}</small></td>
        <td class="num">${x && x.twd != null ? String(Math.round(x.twd)).padStart(3, '0') + '°' : '–'}<small>${x && x.tws != null ? Math.round(x.tws) + ' kn' : ''}${s ? ' · v ' + Math.round(s.tws) : ''}</small></td>
        <td class="num">${x ? x.sog.toFixed(1) : '–'}<small>${x ? x.nm.toFixed(2) + ' nm' : ''}</small></td>
        <td class="num"><span class="pa-pf ${cls}">${x ? pct(x.ratio) : '–'}</span></td></tr>`;
    }).join('');
    $('paLegs').innerHTML = rows;
  }

  // kleur per prestatie (divergerend rond 100%, grijs = op polar)
  const PF_COL = r => (r == null ? '#9aa3ad' : r < 0.85 ? '#b8461b' : r < 0.95 ? '#e59a52' : r <= 1.05 ? '#8f9aa6' : '#2f6db5');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, at, par) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (par) par.appendChild(e); return e; };

  function renderMap(P, legs, rounds) {
    const svg = $('paMap'); svg.innerHTML = '';
    const ll2 = p => o.llXY(p.lat, p.lon);
    const xs = [], ys = []; P.forEach(p => { const [x, y] = ll2(p); xs.push(x); ys.push(y); }); legs.forEach(l => l.p.forEach(q => { xs.push(q[0]); ys.push(q[1]); }));
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); const pd = Math.max(x1 - x0, y1 - y0) * 0.06 + 0.1;
    svg.setAttribute('viewBox', `${x0 - pd} ${y0 - pd} ${x1 - x0 + 2 * pd} ${y1 - y0 + 2 * pd}`);
    svg.style.aspectRatio = String((x1 - x0 + 2 * pd) / (y1 - y0 + 2 * pd));
    el('rect', { x: x0 - 50, y: y0 - 50, width: x1 - x0 + 100, height: y1 - y0 + 100, class: 'pa-land' }, svg);
    const wd = waterD(); if (wd) el('path', { d: wd, class: 'pa-water', 'fill-rule': 'evenodd' }, svg);
    legs.forEach(l => el('polyline', { points: l.p.map(q => q.join(',')).join(' '), class: 'pa-course' }, svg));
    // track in stukjes per prestatieklasse
    let cur = null, pts = [];
    const flush = () => { if (pts.length > 1) el('polyline', { points: pts.join(' '), class: 'pa-trk', stroke: PF_COL(cur) }, svg); };
    const cl = r => (r == null ? null : r < 0.85 ? 0.8 : r < 0.95 ? 0.9 : r <= 1.05 ? 1 : 1.1);
    P.forEach(p => { const [x, y] = ll2(p); const c = cl(p.ratio); if (c !== cur && pts.length) { pts.push(x + ',' + y); flush(); pts = [pts[pts.length - 1]]; } cur = c; pts.push(x + ',' + y); });
    flush();
    legs.forEach((l, i) => { const q = l.p[l.p.length - 1]; const g = el('g', {}, svg); el('circle', { cx: q[0], cy: q[1], r: 0.045, class: 'pa-mk' + (rounds[i] && rounds[i].ok ? '' : ' miss') }, g); const t = el('text', { x: q[0] + 0.07, y: q[1] + 0.03, class: 'pa-mkl' }, g); t.textContent = i + 1; });
  }

  function smooth(P, key, win = 60e3) {
    const out = []; let a = 0, s = 0, n = 0, b = 0;
    for (let i = 0; i < P.length; i++) {
      while (b < P.length && P[b].t <= P[i].t + win / 2) { if (P[b][key] != null) { s += P[b][key]; n++; } b++; }
      while (P[a].t < P[i].t - win / 2) { if (P[a][key] != null) { s -= P[a][key]; n--; } a++; }
      out.push(n ? s / n : null);
    }
    return out;
  }
  function renderCharts(P, L, start, ideal, pre) {
    const fin = L.filter(Boolean).pop(); const t1 = fin ? fin.t1 : P[P.length - 1].t;
    const Q = P.filter(p => p.t >= start && p.t <= t1); if (Q.length < 5) { $('paCharts').hidden = true; return; } $('paCharts').hidden = false;
    const sog = smooth(Q, 'sog'), tgt = smooth(Q, 'target');
    const ratio = Q.map((p, i) => (sog[i] != null && tgt[i] > 0.8 && p.tws >= 3 ? sog[i] / tgt[i] : null));
    const marks = L.map((x, i) => (x ? { t: x.t1, lab: String(i + 1) } : null)).filter(Boolean);
    const T = Q.map(p => p.t);
    chart($('paChSpd'), T, [{ v: sog, cls: 'c-sog', lab: 'Bootsnelheid (SOG)' }, { v: tgt, cls: 'c-pol', lab: 'Polar bij actuele wind' }], { unit: 'kn', marks, yMin: 0, start });
    chart($('paChPf'), T, [{ v: ratio.map(r => (r == null ? null : r * 100)), cls: 'c-pf', lab: 'Prestatie' }], { unit: '%', marks, ref: 100, yMin: 50, yMax: 130, start });
    // voor/achter op de simulatie per merkteken
    const D = $('paDelta'); const items = [];
    L.forEach((x, i) => { if (!x) return; const p = pre && pre.legs[i], d = ideal && ideal.legs[i];
      items.push(`<li><b>${i + 1}</b><span class="${p && x.t1 > p.end ? 'neg' : 'pos'}">${p ? fmtD((x.t1 - p.end) / 3600e3) : '–'}</span><span class="${d && x.t1 > d.end ? 'neg' : 'pos'}">${d ? fmtD((x.t1 - d.end) / 3600e3) : '–'}</span></li>`); });
    D.innerHTML = `<li class="h"><b>Merk</b><span>t.o.v. simulatie vooraf</span><span>t.o.v. polar (actuele wind)</span></li>` + items.join('');
  }
  function chart(svg, T, S, { unit, marks, ref, yMin, yMax, start }) {
    const W = 640, H = 170, m = { l: 34, r: 8, t: 10, b: 20 }; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = '';
    const t0 = T[0], t1 = T[T.length - 1]; const vals = S.flatMap(s => s.v.filter(v => v != null));
    let lo = yMin != null ? yMin : Math.min(...vals), hi = yMax != null ? yMax : Math.max(...vals);
    if (yMax == null) hi = Math.ceil(Math.max(hi, (ref || 0) + 1) / 2) * 2; if (!(hi > lo)) hi = lo + 1;
    const X = t => m.l + (t - t0) / (t1 - t0) * (W - m.l - m.r), Y = v => m.t + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (H - m.t - m.b);
    const g = el('g', { class: 'ax' }, svg);
    const step = (hi - lo) / 4; for (let k = 0; k <= 4; k++) { const v = lo + step * k; el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' }, g); const t = el('text', { x: m.l - 4, y: Y(v) + 3, class: 'yl' }, g); t.textContent = Math.round(v) + (k === 4 ? ' ' + unit : ''); }
    for (let h = Math.ceil(t0 / 1800e3) * 1800e3; h <= t1; h += 1800e3) { const t = el('text', { x: X(h), y: H - 5, class: 'xl' }, g); t.textContent = hm(h); }
    if (ref != null) el('line', { x1: m.l, x2: W - m.r, y1: Y(ref), y2: Y(ref), class: 'ref' }, g);
    marks.forEach(k => { if (k.t < t0 || k.t > t1) return; el('line', { x1: X(k.t), x2: X(k.t), y1: m.t, y2: H - m.b, class: 'mkl' }, g); const t = el('text', { x: X(k.t) + 2, y: m.t + 8, class: 'mkt' }, g); t.textContent = k.lab; });
    S.forEach(s => { let d = '', pen = false; s.v.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(T[i]).toFixed(1) + ',' + Y(v).toFixed(1); pen = true; }); el('path', { d, class: 'ln ' + s.cls }, svg); });
    // hover: lijn + waarden
    const hl = el('line', { y1: m.t, y2: H - m.b, class: 'hov', visibility: 'hidden' }, svg);
    const tip = svg.parentElement.querySelector('.pa-tip');
    const hit = el('rect', { x: m.l, y: 0, width: W - m.l - m.r, height: H, fill: 'transparent' }, svg);
    const move = e => {
      const r = svg.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * W; const t = t0 + (x - m.l) / (W - m.l - m.r) * (t1 - t0);
      let i = 0; while (i < T.length - 1 && T[i + 1] < t) i++;
      hl.setAttribute('x1', X(T[i])); hl.setAttribute('x2', X(T[i])); hl.setAttribute('visibility', 'visible');
      tip.hidden = false; tip.style.left = Math.min(r.width - 150, Math.max(0, (X(T[i]) / W) * r.width + 8)) + 'px';
      tip.innerHTML = `<b>${hm(T[i])}</b>` + S.map(s => `<span><i class="sw ${s.cls}"></i>${esc(s.lab)}: ${s.v[i] == null ? '–' : s.v[i].toFixed(unit === '%' ? 0 : 1) + ' ' + unit}</span>`).join('');
    };
    hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => { hl.setAttribute('visibility', 'hidden'); tip.hidden = true; });
  }

  // ---------- bediening ----------
  $('paDay').onchange = () => { A.day = $('paDay').value; load(); analyse(); };
  $('paStart').onchange = () => { const m = { ...(A.trk && A.trk.meta || {}), start: startMs() }; if (A.trk) { A.trk.meta = m; LS.set(K_TRK + A.day, A.trk); } analyse(); };
  $('paFile').onchange = e => { const f = e.target.files && e.target.files[0]; if (f) onFile(f); e.target.value = ''; };
  $('paProv').onchange = saveAis; ['paMmsi', 'paKey', 'paTpl'].forEach(id => $(id).onchange = saveAis);
  $('paAis').onclick = fetchAis;
  $('paWx').onclick = async () => { if (await fetchActual()) analyse(); };
  $('paRun').onclick = analyse;
  function manualSim() {
    const baan = Math.round(+$('paManBaan').value), twd = ((Math.round(+$('paManTwd').value) % 360) + 360) % 360, tws = +$('paManTws').value;
    if (!(tws >= 2 && tws <= 35)) { $('paMsg').textContent = 'Vul een windsnelheid tussen 2 en 35 kn in.'; return; }
    const run = () => {
      const legs = getLegs(); if (!legs || !legs.length) { $('paMsg').textContent = 'Geen baan beschikbaar.'; return; }
      const start = startMs(); const ctx = { ...getCtx(), polar: getPolar(getMeta().boat), twd, tws };
      const series = [{ t: start - 6 * 3600e3, h: 0, twd, tws }, { t: start + 12 * 3600e3, h: 0, twd, tws }];
      const sim = simulate(legs, ctx, series, start);
      const M = getMeta();
      LS.set(K_SIM + A.day, { day: A.day, saved: Date.now(), baan: M.baan, area: M.area, boat: M.boat, start: sim.start, finish: sim.finish, field: false, manual: { twd, tws },
        legs: sim.legs.map(l => ({ to: l.to, start: l.start, end: l.end, twd: l.twd, tws: l.tws, twa: Math.round(l.twa), side: l.side, kn: +l.kn.toFixed(2) })) });
      $('paMsg').textContent = `Simulatie vooraf gemaakt voor baan ${M.baan}: ${String(twd).padStart(3, '0')}° ${tws} kn, zeiltijd ${fmtH(sim.hours)}.`;
      load(); analyse();
    };
    if (baan && baan !== +getMeta().baan) { setCourse({ ...getMeta(), baan }); setTimeout(run, 80); } else run();
  }
  $('paMan').onclick = manualSim;
  $('paDel').onclick = () => { if (!confirm(`Track van ${dlabel(A.day)} verwijderen van dit toestel?`)) return; LS.del(K_TRK + A.day); fillDays(); load(); $('paOut').hidden = true; };
  $('paUseCourse').onclick = () => { setCourse(A.meta); setTimeout(() => { load(); analyse(); }, 60); };

  return {
    render() { recFlush(); fillDays(); fillAis(); load(); analyse(); },
  };
}
