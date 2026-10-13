// Windveld als kaartlaag: kleurvlak windsnelheid, windpijlen, bewegende "stroming" (zoals Windy) en een tijdschuif.
import { fieldAt, sampleGrid, speedColor, SPEED_STOPS } from '../core/wxfield.js';

const NS = 'http://www.w3.org/2000/svg';
const pad = n => String(n).padStart(2, '0');
const hm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const DAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const dlabel = s => { const [y, m, d] = s.split('-').map(Number); const D = new Date(y, m - 1, d); return `${DAG[D.getDay()]} ${d} ${MND[m - 1]}`; };
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const T0 = 7 * 60, T1 = 19 * 60;  // tijdschuif 07:00–19:00

export function initWxField({ store, svg, llXY, xyLL, getK, getDay, getStart, isWater = () => true }) {
  const $ = id => document.getElementById(id);
  const el = (tag, at, par) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (par) par.appendChild(e); return e; };
  if (!$('wfBar')) return { setData() {}, windFn: () => null, setTime() {}, redraw() {}, has: () => false };
  let D = store.state.wfData && store.state.wfData.field ? store.state.wfData : null;
  let T = null, follow = false, play = null, fetcher = null, G = null;

  // ---- svg-laag onder de vaarwaters en de baan
  const defs = svg.querySelector('defs');
  const clip = el('clipPath', { id: 'wfClip' }, defs); const cp = el('path', { 'clip-rule': 'evenodd' }, clip);
  const L = el('g', { id: 'wfL' }); svg.insertBefore(L, $('corr'));
  const img = el('image', { id: 'wfImg', preserveAspectRatio: 'none', 'clip-path': 'url(#wfClip)' }, L);
  const arr = el('g', { id: 'wfArr' }, L);
  const cv = $('wfCv'); const ctx = cv.getContext('2d');

  const day = () => getDay() || isoToday();
  const ok = () => !!(D && D.day === day());
  const F = () => D.field;
  const box = () => { const b = F().box; const [x0, y0] = llXY(b.n, b.w), [x1, y1] = llXY(b.s, b.e); return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; };
  const at = (x, y) => { const [la, lo] = xyLL(x, y); return sampleGrid(F(), G, la, lo); };

  function defaultTime() {
    const d = day(); const [y, m, dd] = d.split('-').map(Number);
    if (d === isoToday()) { const n = new Date(); const mins = n.getHours() * 60 + n.getMinutes(); if (mins >= T0 && mins <= T1) return Date.now(); }
    const s = getStart(d); return s || new Date(y, m - 1, dd, 11, 0).getTime();
  }
  function clampT(t) {
    const [y, m, dd] = day().split('-').map(Number); const a = new Date(y, m - 1, dd, 0, 0).getTime();
    return Math.min(a + T1 * 60e3, Math.max(a + T0 * 60e3, t));
  }

  function drawRaster() {
    const B = box(); const W = 150, H = Math.max(20, Math.round(W * B.h / B.w));
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const im = g.createImageData(W, H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const w = at(B.x0 + (i + 0.5) / W * B.w, B.y0 + (j + 0.5) / H * B.h); const [r, gg, b] = speedColor(w.tws); const o = (j * W + i) * 4;
      im.data[o] = r; im.data[o + 1] = gg; im.data[o + 2] = b; im.data[o + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    img.setAttribute('href', c.toDataURL('image/png')); img.setAttribute('x', B.x0); img.setAttribute('y', B.y0); img.setAttribute('width', B.w); img.setAttribute('height', B.h);
  }
  let ARR = null;  // pijlposities (alleen op het water)
  function arrowPts() {
    const B = box(), step = 0.85, out = [];
    for (let y = B.y0 + step / 2; y < B.y1; y += step) for (let x = B.x0 + step / 2; x < B.x1; x += step) if (isWater(x, y)) out.push([x, y]);
    return out;
  }
  function drawArrows() {
    if (!ARR) ARR = arrowPts();
    const k = getK(); arr.innerHTML = '';
    ARR.forEach(([x, y], n) => {
      const w = at(x, y); const a = (w.twd + 180) % 360;
      const g = el('g', { class: 'wfa', 'data-x': x, 'data-y': y, 'data-a': a, 'data-s': 1, transform: `translate(${x},${y}) rotate(${a}) scale(${k})` }, arr);
      el('path', { d: 'M0,10 L0,-8 M-4.5,-3 L0,-10 L4.5,-3' }, g);
      if (n % 2 === 0) { const tg = el('g', { class: 'wfn', 'data-x': x, 'data-y': y, 'data-a': 0, 'data-s': 1, transform: `translate(${x},${y}) scale(${k})` }, arr); const t = el('text', { x: 9, y: 4 }, tg); t.textContent = Math.round(w.tws); }
    });
  }
  function render() {
    const on = !!store.state.wfOn;
    $('wfBtn').setAttribute('aria-pressed', on ? 'true' : 'false'); $('wfBar').hidden = !on;
    document.getElementById('chart').classList.toggle('wf-on', on);
    const have = on && ok();
    L.style.display = have ? '' : 'none';
    $('wfGet').hidden = !on || ok(); $('wfCtl').hidden = !have;
    $('wfDay').textContent = dlabel(day());
    if (on && !ok()) $('wfMsg').textContent = fetcher ? `Nog geen windveld voor ${dlabel(day())}. Ophalen kan thuis of in de haven; daarna werkt het ook zonder internet.` : '';
    else if (have) $('wfMsg').textContent = `Model ${D.model.replace('_seamless', '').replace('_ifs025', '').toUpperCase()} · opgehaald ${new Date(D.fetched).toLocaleString('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · 10 m hoogte, modelverwachting`;
    if (!have) { stopAnim(); setH(); return; }
    if (T == null) T = clampT(defaultTime());
    cp.setAttribute('d', $('water').getAttribute('d') || '');
    G = fieldAt(F(), T);
    const mins = Math.round((T - new Date(T).setHours(0, 0, 0, 0)) / 60e3); $('wfRange').value = String(Math.round(mins / 10) * 10);
    $('wfTime').textContent = hm(T);
    drawRaster(); drawArrows(); setH();
    if (store.state.wfPart) startAnim(); else stopAnim();
  }
  function setH() { const h = $('wfBar').hidden ? 0 : $('wfBar').offsetHeight + 10; document.getElementById('chart').style.setProperty('--wfh', h + 'px'); }

  // ---- stroming (deeltjes) op een canvas boven de kaart
  let P = [], raf = 0, lastCTM = '';
  function spawn(p) {
    const B = box(); const r = svg.getBoundingClientRect(), m = svg.getScreenCTM(); if (!m) return;
    // zichtbaar deel ∩ veld
    const vx0 = Math.max(B.x0, (r.left - m.e) / m.a), vx1 = Math.min(B.x1, (r.right - m.e) / m.a), vy0 = Math.max(B.y0, (r.top - m.f) / m.d), vy1 = Math.min(B.y1, (r.bottom - m.f) / m.d);
    for (let tries = 0; tries < 6; tries++) {
      const x = vx0 + Math.random() * Math.max(0, vx1 - vx0), y = vy0 + Math.random() * Math.max(0, vy1 - vy0);
      if (isWater(x, y) || tries === 5) { p.x = x; p.y = y; p.age = Math.floor(Math.random() * 60); return; }
    }
  }
  function frame() {
    raf = requestAnimationFrame(frame);
    const r = svg.getBoundingClientRect(); const m = svg.getScreenCTM(); if (!m || !G) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px'; P = []; }
    const key = [m.a, m.e, m.f, r.left, r.top].map(v => v.toFixed(2)).join();
    if (key !== lastCTM) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); lastCTM = key; P.forEach(spawn); }
    const n = Math.round(Math.min(900, Math.max(250, r.width * r.height / 900)));
    while (P.length < n) { const p = {}; spawn(p); P.push(p); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.3; ctx.beginPath();
    const ox = m.e - r.left, oy = m.f - r.top, B = box();
    for (const p of P) {
      const w = at(p.x, p.y); const to = (w.twd + 180) * Math.PI / 180; const px = w.tws * 0.09 / m.a;  // ~0,09 px per kn per frame
      const nx = p.x + Math.sin(to) * px, ny = p.y - Math.cos(to) * px;
      ctx.moveTo(p.x * m.a + ox, p.y * m.d + oy); ctx.lineTo(nx * m.a + ox, ny * m.d + oy);
      p.x = nx; p.y = ny; p.age++;
      if (p.age > 90 || p.x < B.x0 || p.x > B.x1 || p.y < B.y0 || p.y > B.y1 || (p.age % 8 === 0 && !isWater(p.x, p.y))) spawn(p);
    }
    ctx.stroke();
  }
  function startAnim() { cv.hidden = false; if (!raf && !document.hidden) { lastCTM = ''; raf = requestAnimationFrame(frame); } }
  function stopAnim() { if (raf) cancelAnimationFrame(raf); raf = 0; cv.hidden = true; P = []; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; } else if (store.state.wfOn && store.state.wfPart && ok()) startAnim(); });

  // ---- bediening
  function setTime(t, opt = {}) { if (!ok()) return; T = clampT(t); if (!opt.keepFollow) follow = false; render(); }
  $('wfBtn').onclick = () => { store.set({ wfOn: !store.state.wfOn }); render(); };
  $('wfX').onclick = () => { store.set({ wfOn: false }); stopPlay(); render(); };
  $('wfRange').oninput = () => { const [y, m, d] = day().split('-').map(Number); stopPlay(); setTime(new Date(y, m - 1, d, 0, +$('wfRange').value).getTime()); };
  $('wfNow').onclick = () => { follow = true; setTime(Date.now(), { keepFollow: true }); };
  function stopPlay() { if (play) clearInterval(play); play = null; $('wfPlay').setAttribute('aria-pressed', 'false'); $('wfPlay').textContent = '▶'; }
  $('wfPlay').onclick = () => {
    if (play) return stopPlay();
    follow = false; $('wfPlay').setAttribute('aria-pressed', 'true'); $('wfPlay').textContent = '❚❚';
    play = setInterval(() => { const [y, m, d] = day().split('-').map(Number); const end = new Date(y, m - 1, d, 0, T1).getTime(); setTime(T >= end ? new Date(y, m - 1, d, 0, T0).getTime() : T + 15 * 60e3); }, 450);
  };
  $('wfPart').checked = !!store.state.wfPart;
  $('wfPart').onchange = () => { store.set({ wfPart: $('wfPart').checked }); render(); };
  $('wfGet').onclick = () => { if (fetcher) fetcher(); };
  $('wfLeg').innerHTML = `<span class="wf-grad" style="background:linear-gradient(90deg,${SPEED_STOPS.filter(s => s[0] <= 30).map(([k, c]) => `rgb(${c}) ${k / 30 * 100}%`).join(',')})"></span><span class="wf-ticks"><i>0</i><i>10</i><i>20</i><i>30 kn</i></span>`;
  setInterval(() => { if (follow && ok() && store.state.wfOn) setTime(Date.now(), { keepFollow: true }); }, 60e3);
  store.on(['wxDay'], () => { T = null; ARR = null; render(); });
  window.addEventListener('resize', setH);

  return {
    setData(d) { D = d; store.set({ wfData: d }); T = null; ARR = null; render(); },
    has: d => !!(D && D.day === d),
    /** windFn voor de simulatie: (t, [x,y]) → {twd,tws} */
    windFn: d => (D && D.day === d ? (t, xy) => { const [la, lo] = xyLL(xy[0], xy[1]); return sampleGrid(D.field, fieldAt(D.field, t), la, lo); } : null),
    setTime: (t, follow2) => { if (store.state.wfOn && ok()) { stopPlay(); setTime(t, { keepFollow: !!follow2 }); } },
    setFetcher(fn) { fetcher = fn; render(); },
    redraw: render,
  };
}
