// v52: boordinstrumenten via Signal K (live TWS/TWA/STW/koers, GPS van de boot) en zeilvoering (knoppen + advies uit de sail selection chart).
import { skUrl, mixedBlocked, applyDelta, snapshot, subscribeMsg, packIns, meanWind } from '../core/signalk.js';
import { sailsFor, aboardList, advise, sailById, sailAt } from '../core/sails.js';
import { recordIns, logSail, getSailLog, setRecInterval, todayIso } from './analysis.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad3 = v => String(Math.round(((v % 360) + 360) % 360)).padStart(3, '0');

/**
 * o.store, o.perf(twa, tws) → polarsnelheid (kn), o.legTwa(i) → TWA van rak i volgens de baan (of null),
 * o.curLeg() → huidig raknummer (of -1), o.onFix(position) → GPS-punt doorgeven, o.decl → magnetische variatie (°),
 * o.setWind(twd, tws), o.isRace() → staat de tab Race open, o.gpsOn() → staat de GPS aan.
 */
export function initInstruments(o) {
  const $ = id => document.getElementById(id);
  const { store } = o; const ST = store.S;
  const SK = { ws: null, S: {}, want: false, status: 'uit', retry: null, recent: [], lastPos: 0, snap: {}, rx: 0 };
  const hasSails = () => sailsFor(ST.boat).length > 0;
  const aboard = () => aboardList(ST.boat, ST.sailsAboard);

  // ---------- verbinding ----------
  function setStatus(s, msg) {
    SK.status = s; const d = $('skDot'); if (d) { d.className = 'skdot ' + s; d.title = { uit: 'niet verbonden', bezig: 'verbinden…', ok: 'verbonden, data komt binnen', stil: 'verbonden, geen data', fout: 'verbinding mislukt' }[s] || s; }
    if (msg != null && $('skMsg')) $('skMsg').textContent = msg;
    if ($('skConn')) $('skConn').textContent = SK.want ? 'verbreek' : 'verbind';
  }
  function connect() {
    clearTimeout(SK.retry); SK.want = true;
    const url = skUrl(ST.skAddr, location);
    if (mixedBlocked(url, location)) { SK.want = false; setStatus('fout', 'Deze pagina draait via https; de browser blokkeert dan een gewone (ws://) verbinding met de boot. Open de app via de Raspberry Pi (http://…) of geef een beveiligd adres (wss://).'); return; }
    try { SK.ws && SK.ws.close(); } catch (e) {}
    setStatus('bezig', 'Verbinden met ' + url.replace(/\/signalk.*$/, '') + ' …');
    let ws; try { ws = new WebSocket(url); } catch (e) { setStatus('fout', 'Adres niet bruikbaar: ' + e.message); SK.want = false; return; }
    SK.ws = ws;
    ws.onopen = () => { try { ws.send(JSON.stringify(subscribeMsg(1000))); } catch (e) {} setStatus('stil', 'Verbonden; wacht op data…'); };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m && m.self) SK.S.__self = String(m.self).startsWith('vessels.') ? m.self : 'vessels.' + m.self;
      if (applyDelta(SK.S, m)) { SK.rx = Date.now(); if (SK.status !== 'ok') setStatus('ok', 'Data van de boot komt binnen.'); }
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (SK.ws !== ws) return; SK.ws = null;
      if (SK.want) { setStatus('fout', 'Geen verbinding met de boot; opnieuw proberen over 5 s…'); SK.retry = setTimeout(connect, 5000); }
      else setStatus('uit', 'Niet verbonden.');
    };
  }
  function disconnect() { SK.want = false; clearTimeout(SK.retry); try { SK.ws && SK.ws.close(); } catch (e) {} SK.ws = null; setStatus('uit', 'Niet verbonden.'); }

  // ---------- elke seconde ----------
  function tick() {
    const now = Date.now();
    if (SK.ws && SK.status === 'ok' && now - SK.rx > 10e3) setStatus('stil', 'Verbonden, maar al 10 s geen data van de boot.');
    const s = SK.ws ? snapshot(SK.S, now, { decl: o.decl }) : {};
    SK.snap = s;
    const any = s.tws != null || s.stw != null || s.aws != null || s.hdg != null;
    if (any) {
      if (s.twd != null && s.tws != null) { SK.recent.push({ t: now, twd: s.twd, tws: s.tws }); while (SK.recent.length && SK.recent[0].t < now - 600e3) SK.recent.shift(); }
      if (o.isRace()) recordIns(now, packIns(now, s));
    }
    // GPS van de boot
    const useBoatGps = ST.skGps && s.lat != null;
    setRecInterval(useBoatGps ? 1000 : 5000);
    if (useBoatGps && o.gpsOn() && s.posT !== SK.lastPos) {
      SK.lastPos = s.posT;
      o.onFix({ coords: { latitude: s.lat, longitude: s.lon, accuracy: 5, speed: s.sog != null ? s.sog / 1.943844 : null, heading: s.cog }, timestamp: now });
    }
    renderHud(s, any);
    renderSailBar(s);
  }

  function renderHud(s, any) {
    const box = $('gIns'); if (!box) return;
    box.hidden = !any;
    if (!any) return;
    const f1 = v => (v == null ? '–' : v.toFixed(1));
    $('iTws').textContent = f1(s.tws);
    $('iTwa').textContent = s.twa == null ? '–' : Math.round(Math.abs(s.twa));
    $('iTwaS').textContent = s.twa == null ? '°' : '° ' + (s.twa >= 0 ? 'SB' : 'BB');
    $('iStw').textContent = f1(s.stw);
    let pf = null; if (s.stw != null && s.tws >= 3 && s.twa != null) { const tg = o.perf(Math.abs(s.twa), s.tws); if (tg > 0.8) pf = s.stw / tg; }
    $('iPf').textContent = pf == null ? '–' : Math.round(pf * 100);
    $('iPf').className = pf == null ? '' : pf < 0.9 ? 'lo' : pf > 1.03 ? 'hi' : 'ok';
    $('iSub').textContent = [s.aws != null ? `AWS ${f1(s.aws)} kn` : '', s.awa != null ? `AWA ${Math.round(Math.abs(s.awa))}°` : '', s.twd != null ? `TWD ${pad3(s.twd)}°` : '', s.hdg != null ? `koers ${pad3(s.hdg - o.decl)}°M` : '', s.twSrc === 'calc' ? 'ware wind berekend' : ''].filter(Boolean).join(' · ');
  }

  // ---------- zeilvoering ----------
  function curSail() { return sailAt(getSailLog(todayIso()), Date.now()); }
  let lastBar = '';
  function renderSailBar(s = SK.snap || {}) {
    const bar = $('sailBar'); if (!bar) return;
    if (!hasSails()) { bar.hidden = true; return; }
    bar.hidden = false;
    const A = aboard(); const cur = curSail();
    const leg = o.curLeg();
    const tws = s.tws != null ? s.tws : ST.tws;
    const twa = s.twa != null ? Math.abs(s.twa) : o.legTwa(leg >= 0 ? leg : 0);
    const adv = twa != null ? advise(A, tws, twa) : null;
    const nTwa = leg >= 0 ? o.legTwa(leg + 1) : null; const nAdv = nTwa != null ? advise(A, ST.tws, nTwa) : null;
    const key = JSON.stringify([A.map(x => x.id), cur, adv && adv.sail.id, adv && adv.ok, nAdv && nAdv.sail.id, leg, s.tws != null, ST.tws]);
    if (key === lastBar) return; lastBar = key;
    $('sailBtns').innerHTML = A.map(x => `<button type="button" data-s="${x.id}" class="${x.id === cur ? 'on' : ''}${adv && adv.sail.id === x.id && x.id !== cur ? ' adv' : ''}" aria-pressed="${x.id === cur}" style="--sc:${x.col}">${esc(x.name)}</button>`).join('');
    const src = s.tws != null ? 'gemeten wind' : `${ST.tws} kn (instelling)`;
    $('sailAdv').innerHTML = adv ? `advies: <b>${esc(adv.sail.name)}</b>${adv.ok ? '' : ' <span class="warn">buiten bereik</span>'}${nAdv && leg >= 0 ? ` · rak ${leg + 2}: <b>${esc(nAdv.sail.name)}</b>` : ''} <small>(${src})</small>` : '';
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('#sailBtns button[data-s]'); if (!b) return;
    logSail(Date.now(), b.dataset.s); lastBar = ''; renderSailBar();
    const sl = sailById(ST.boat, b.dataset.s); const m = $('gMsg'); if (m && sl) m.textContent = `Zeil ${sl.name} vastgelegd om ${new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}.`;
  });

  // zeilen aan boord kiezen (Race preparation, Boot & polar)
  function renderChips() {
    const box = $('sailChips'), lab = $('sailChipsLab'); if (!box) return;
    const all = sailsFor(ST.boat); box.hidden = lab.hidden = !all.length; if (!all.length) return;
    const on = new Set(aboard().map(x => x.id));
    box.innerHTML = all.map(x => `<button type="button" data-s="${x.id}" aria-pressed="${on.has(x.id)}" style="--sc:${x.col}" title="${esc(x.name)} ${esc(x.area)} · ${x.tws[0]}–${x.tws[1]} kn · TWA ${x.twa[0]}–${x.twa[1]}°">${esc(x.name)}</button>`).join('');
  }
  $('sailChips') && $('sailChips').addEventListener('click', e => {
    const b = e.target.closest('button[data-s]'); if (!b) return;
    const on = new Set(aboard().map(x => x.id)); on.has(b.dataset.s) ? on.delete(b.dataset.s) : on.add(b.dataset.s);
    ST.sailsAboard = sailsFor(ST.boat).filter(x => on.has(x.id)).map(x => x.id); if (!ST.sailsAboard.length) ST.sailsAboard = [b.dataset.s];
  });
  store.on(['boat', 'sailsAboard'], () => { renderChips(); lastBar = ''; renderSailBar(); });

  // ---------- bediening ----------
  if ($('skAddr')) {
    $('skAddr').value = ST.skAddr; $('skGps').checked = ST.skGps; $('skAuto').checked = ST.skAuto;
    $('skAddr').onchange = () => { ST.skAddr = $('skAddr').value; if (SK.want) connect(); };
    $('skConn').onclick = () => (SK.want ? disconnect() : connect());
    $('skGps').onchange = () => { ST.skGps = $('skGps').checked; };
    $('skAuto').onchange = () => { ST.skAuto = $('skAuto').checked; };
    $('skWind').onclick = () => {
      const w = meanWind(SK.recent, Date.now(), 120e3);
      if (!w) { $('skMsg').textContent = 'Nog geen gemeten ware wind ontvangen.'; return; }
      o.setWind(Math.round(w.twd), Math.max(4, Math.min(24, Math.round(w.tws))));
      $('skMsg').textContent = `Gemeten wind (gem. 2 min) overgenomen: ${pad3(w.twd)}° ${Math.round(w.tws)} kn.`;
    };
  }
  setStatus('uit', 'Niet verbonden.');
  renderChips();
  if (ST.skAuto) connect();
  setInterval(tick, 1000);

  return { snap: () => SK.snap, connect, disconnect, curSail, aboard, status: () => SK.status, refresh() { lastBar = ''; renderSailBar(); renderChips(); } };
}
