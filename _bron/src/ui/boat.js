// Tab Boot: boot kiezen, polar inlezen, sail selection chart bekijken en bewerken, zeilen aan boord en veiligheidsmiddelen.
import { parsePolar, polarToText, validPolar } from '../core/polarfile.js';
import { sailsFor, defaultSails, setCustomSails, aboardList, normSail, normSails, newSailId, parseSailChart, sailsToCsv, KINDS } from '../core/sails.js';
import { safetyList, safetyProgress, GROUPS, SAFETY_SRC } from '../core/safety.js';
import { perf } from '../core/polar.js';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f1 = n => (Math.round(n * 10) / 10).toFixed(1);
const fmtD = t => new Date(t).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const nl = x => String(x).replace('.', ',');

/**
 * o = { store, boats, selectBoat(b) }  — boats = BOATS uit data/boats.js; selectBoat zet de boot via Race preparation (vloot, kaart).
 * Geeft { polarOf(b), refresh() }.
 */
export function initBoat(o) {
  const { store, boats } = o; const ST = store.S;
  setCustomSails(ST.sailChart);

  const custom = b => { const c = (ST.polarCustom || {})[b]; return c && validPolar(c.polar) ? c : null; };
  const polarOf = b => { const c = custom(b); return c ? c.polar : (boats[b] || boats[ST.boat]).polar; };
  const download = (name, text, type = 'text/plain') => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  const readText = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('Bestand kan niet gelezen worden.')); r.readAsText(file); });
  const msg = (id, html, bad) => { const e = $(id); if (!e) return; e.innerHTML = html; e.classList.toggle('bad', !!bad); };

  // ---------- boot ----------
  function renderBoat() {
    const B = boats[ST.boat], c = custom(ST.boat);
    $('btSel').value = ST.boat;
    $('btInfo').innerHTML = `<span>Type</span><b>${esc(B.type)}</b><span>Zeilnummer</span><b>${esc(B.sail)}</b><span>GC-nummer</span><b>${esc(B.gc)}</b><span>Klasse</span><b>${esc(B.klasse)}</b>`
      + `<span>Polar</span><b>${c ? esc(c.name) + ' <small>(ingelezen ' + esc(fmtD(c.date)) + ')</small>' : esc(B.polarSrc)}</b>`;
  }
  $('btSel').onchange = e => o.selectBoat(e.target.value);

  // ---------- polar ----------
  function polarSvg(P) {
    const W = 330, H = 330, ox = 26, oy = 165, maxV = Math.ceil(Math.max(...P.v.flat(), ...P.beatVmg.map((v, i) => v / Math.cos(P.beatAng[i] * Math.PI / 180))) + 0.5);
    const s = (H / 2 - 14) / maxV, pt = (v, a) => [ox + v * Math.sin(a * Math.PI / 180) * s, oy - v * Math.cos(a * Math.PI / 180) * s];
    let g = '';
    for (let r = 2; r <= maxV; r += 2) { const [x1, y1] = pt(r, 0), [x2, y2] = pt(r, 180); g += `<path d="M${f1(x1)} ${f1(y1)} A${f1(r * s)} ${f1(r * s)} 0 0 1 ${f1(x2)} ${f1(y2)}" class="pg"/><text x="${ox - 4}" y="${f1(y1 + 4)}" class="pl" text-anchor="end">${r}</text>`; }
    for (let a = 30; a <= 150; a += 30) { const [x, y] = pt(maxV, a), [tx, ty] = pt(maxV + 0.6, a); g += `<line x1="${ox}" y1="${oy}" x2="${f1(x)}" y2="${f1(y)}" class="pg"/><text x="${f1(tx)}" y="${f1(ty + 4)}" class="pl">${a}°</text>`; }
    const n = P.tws.length;
    P.tws.forEach((t, i) => {
      const col = `hsl(212 70% ${Math.round(78 - 50 * i / Math.max(1, n - 1))}%)`;
      const b = P.beatAng[i], gy = P.gybeAng[i]; let d = '';
      for (let a = b; a <= gy + 0.01; a += 2) { const v = perf(P, Math.min(a, gy), t).bs; const [x, y] = pt(v, Math.min(a, gy)); d += (d ? 'L' : 'M') + f1(x) + ' ' + f1(y); }
      const [ex, ey] = pt(perf(P, gy, t).bs, gy), [bx, by] = pt(perf(P, b, t).bs, b);
      g += `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.8"/><circle cx="${f1(bx)}" cy="${f1(by)}" r="2.4" fill="${col}"/><circle cx="${f1(ex)}" cy="${f1(ey)}" r="2.4" fill="${col}"/>`
        + (() => { const [lx, ly] = pt(perf(P, 90, t).bs, 90); return `<text x="${f1(lx + 3)}" y="${f1(ly - 2)}" class="pl" fill="${col}">${t}</text>`; })();
    });
    return `<svg viewBox="0 0 ${W} ${H}" class="polsvg" role="img" aria-label="Polair diagram: bootsnelheid per ware windhoek, één lijn per windsnelheid">${g}<text x="4" y="12" class="pl">kn</text><text x="${W - 4}" y="${H - 4}" class="pl" text-anchor="end">lijn = TWS (kn), stip = kruis-/gijphoek</text></svg>`;
  }
  function polarTable(P) {
    const th = P.tws.map(t => `<th class="num">${t}</th>`).join('');
    const row = (lab, arr, cls = '') => `<tr class="${cls}"><th>${lab}</th>${arr.map(x => `<td class="num">${nl(x)}</td>`).join('')}</tr>`;
    return `<table class="poltab"><thead><tr><th>TWA \\ TWS</th>${th}</tr></thead><tbody>${row('Kruishoek', P.beatAng, 'opt')}${row('Kruis-VMG', P.beatVmg, 'opt')}`
      + P.ang.map((a, i) => row(a + '°', P.v[i])).join('') + `${row('VMG voor de wind', P.runVmg, 'opt')}${row('Gijphoek', P.gybeAng, 'opt')}</tbody></table>`;
  }
  function renderPolar() {
    const P = polarOf(ST.boat), c = custom(ST.boat), B = boats[ST.boat];
    $('btPolSrc').innerHTML = c ? `Eigen polar: <b>${esc(c.name)}</b> (${esc(c.fmt)}, ${esc(fmtD(c.date))}). Wordt gebruikt voor zeiltijden, laylines, simulatie en prestatie.` : `Standaard: ${esc(B.polarSrc)}.`;
    $('btPolReset').hidden = !c;
    $('btPolPlot').innerHTML = polarSvg(P);
    $('btPolTab').innerHTML = polarTable(P);
  }
  function applyPolar(text, name) {
    try {
      const r = parsePolar(text);
      store.set({ polarCustom: Object.assign({}, ST.polarCustom, { [ST.boat]: { polar: r.polar, name: name || 'geplakte tabel', fmt: r.fmt, date: Date.now() } }) });
      msg('btPolMsg', `Ingelezen als ${esc(r.fmt)}: ${r.polar.tws.length} windsnelheden (${r.polar.tws[0]}–${r.polar.tws[r.polar.tws.length - 1]} kn), ${r.polar.ang.length} windhoeken.` + (r.warn.length ? '<br>' + r.warn.map(esc).join('<br>') : ''));
      $('btPolText').value = ''; $('btPolPaste').open = false;
    } catch (e) { msg('btPolMsg', 'Niet ingelezen: ' + esc(e.message), true); }
  }
  $('btPolFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { applyPolar(await readText(f), f.name); } catch (err) { msg('btPolMsg', esc(err.message), true); } };
  $('btPolApply').onclick = () => applyPolar($('btPolText').value, 'geplakte tabel');
  $('btPolReset').onclick = () => { if (!confirm('Terug naar de standaardpolar van ' + boats[ST.boat].name + '?')) return; const m = Object.assign({}, ST.polarCustom); delete m[ST.boat]; ST.polarCustom = m; msg('btPolMsg', 'Standaardpolar hersteld.'); };
  $('btPolDl').onclick = () => download(`polar-${boats[ST.boat].name.replace(/\W+/g, '-')}.txt`, polarToText(polarOf(ST.boat)));

  // ---------- sail selection chart ----------
  const isCustomChart = () => Array.isArray((ST.sailChart || {})[ST.boat]);
  function saveChart(list) {
    const m = Object.assign({}, ST.sailChart, { [ST.boat]: list }); setCustomSails(m); ST.sailChart = m;
  }
  function chartSvg(list, on, P) {
    const R = Math.max(25, Math.min(40, Math.ceil(Math.max(0, ...list.map(x => x.tws[1])) / 5) * 5)), s = 200 / R, ox = 44, oy = 24 + R * s, W = 430, H = oy + R * s + 28;
    const pt = (v, a) => [ox + v * Math.sin(a * Math.PI / 180) * s, oy - v * Math.cos(a * Math.PI / 180) * s];
    const sec = (r1, r2, a1, a2) => { const A = pt(r2, a1), B = pt(r2, a2), C = pt(r1, a2), D = pt(r1, a1); let d = `M${f1(A[0])} ${f1(A[1])} A${f1(r2 * s)} ${f1(r2 * s)} 0 0 1 ${f1(B[0])} ${f1(B[1])}`; d += r1 > 0 ? ` L${f1(C[0])} ${f1(C[1])} A${f1(r1 * s)} ${f1(r1 * s)} 0 0 0 ${f1(D[0])} ${f1(D[1])} Z` : ` L${ox} ${oy} Z`; return d; };
    let g = '';
    for (let r = 5; r <= R; r += 5) { const [x1, y1] = pt(r, 0), [x2, y2] = pt(r, 180); g += `<path d="M${f1(x1)} ${f1(y1)} A${f1(r * s)} ${f1(r * s)} 0 0 1 ${f1(x2)} ${f1(y2)}" class="pg"/><text x="${ox - 5}" y="${f1(y1 + 4)}" class="pl" text-anchor="end">${r}</text><text x="${ox - 5}" y="${f1(y2 + 4)}" class="pl" text-anchor="end">${r}</text>`; }
    for (let a = 0; a <= 180; a += 30) { const [x, y] = pt(R, a), [tx, ty] = pt(R + 1.9 * R / 25, a); g += `<line x1="${ox}" y1="${oy}" x2="${f1(x)}" y2="${f1(y)}" class="pg" stroke-dasharray="3 3"/>${a > 0 && a < 180 ? `<text x="${f1(tx)}" y="${f1(ty + 4)}" class="pl">${a}°</text>` : ''}`; }
    list.forEach(x => { const a = on.has(x.id); g += `<path d="${sec(x.tws[0], x.tws[1], x.twa[0], x.twa[1])}" fill="${x.col}" fill-opacity="${a ? 0.45 : 0.15}" stroke="${x.col}" stroke-width="${a ? 1.8 : 1.3}"${a ? '' : ' stroke-dasharray="5 3"'}><title>${esc(x.name)} ${esc(x.area)} · ${nl(x.tws[0])}–${nl(x.tws[1])} kn · TWA ${x.twa[0]}–${x.twa[1]}°${a ? ' · aan boord' : ''}</title></path>`; });
    const line = arr => P.tws.map((t, i) => { const [x, y] = pt(Math.min(t, R), arr[i]); return (i ? 'L' : 'M') + f1(x) + ' ' + f1(y); }).join(' ');
    g += `<path d="${line(P.beatAng)}" fill="none" class="vmgl"/><path d="${line(P.gybeAng)}" fill="none" class="vmgl"/>`;
    list.forEach(x => { const [cx, cy] = pt((x.tws[0] + x.tws[1]) / 2, (x.twa[0] + x.twa[1]) / 2); const big = (x.tws[1] - x.tws[0]) * s > 34 && (x.twa[1] - x.twa[0]) * Math.PI / 180 * (x.tws[0] + x.tws[1]) / 2 * s > 60;
      g += `<text x="${f1(cx)}" y="${f1(cy)}" class="sl${on.has(x.id) ? '' : ' off'}" text-anchor="middle">${esc(x.name)}</text>${x.area && big ? `<text x="${f1(cx)}" y="${f1(cy + 12)}" class="sa" text-anchor="middle">${esc(x.area)}</text>` : ''}`; });
    g += `<text x="6" y="12" class="pl">TWS (kn)</text><text x="${ox + 18}" y="${f1(oy - R * s - 6)}" class="pl">TWA 0°</text><text x="${ox + 6}" y="${f1(oy + R * s + 16)}" class="pl">TWA 180°</text>`;
    return `<svg viewBox="0 0 ${W} ${f1(H)}" class="chartsvg" role="img" aria-label="Sail selection crossover chart: straal = ware windsnelheid, hoek = ware windhoek">${g}</svg>`;
  }
  function renderSails() {
    const list = sailsFor(ST.boat), on = new Set(aboardList(ST.boat, ST.sailsAboard).map(x => x.id));
    $('btChips').innerHTML = list.length ? list.map(x => `<button type="button" data-s="${esc(x.id)}" aria-pressed="${on.has(x.id)}" style="--sc:${x.col}" title="${esc(x.name)} ${esc(x.area)} · ${nl(x.tws[0])}–${nl(x.tws[1])} kn · TWA ${x.twa[0]}–${x.twa[1]}°">${esc(x.name)}</button>`).join('') : '<span class="hint">Nog geen zeilen. Voeg ze toe in de tabel hieronder of lees een chart in.</span>';
    $('btAboardN').textContent = list.length ? `${on.size} van ${list.length} aan boord` : '';
    $('btChart').innerHTML = list.length ? chartSvg(list, on, polarOf(ST.boat)) : '';
    $('btChartSrc').textContent = isCustomChart() ? 'Eigen chart (bewerkt of ingelezen).' : (defaultSails(ST.boat).length ? 'Standaard: sail selection crossover chart van Dream Machine. Alleen J3 M/H, S2 en de VMG-hoeken komen uit het ORC-certificaat; de andere bereiken zijn schattingen.' : 'Voor deze boot is nog geen chart ingevoerd.');
    $('btChartReset').hidden = !isCustomChart();
    const kinds = Object.entries(KINDS);
    $('btSailBody').innerHTML = list.map(x => `<tr data-id="${esc(x.id)}">
      <td><input type="color" value="${x.col}" data-k="col" aria-label="Kleur ${esc(x.name)}"></td>
      <td><input type="text" value="${esc(x.name)}" data-k="name" maxlength="20" aria-label="Naam" class="nm"></td>
      <td><input type="text" value="${esc(x.area)}" data-k="area" maxlength="16" aria-label="Oppervlak" class="ar"></td>
      <td><input type="number" value="${x.tws[0]}" data-k="t0" min="0" max="40" step="0.5" aria-label="TWS van"></td>
      <td><input type="number" value="${x.tws[1]}" data-k="t1" min="0" max="40" step="0.5" aria-label="TWS tot"></td>
      <td><input type="number" value="${x.twa[0]}" data-k="a0" min="0" max="180" step="1" aria-label="TWA van"></td>
      <td><input type="number" value="${x.twa[1]}" data-k="a1" min="0" max="180" step="1" aria-label="TWA tot"></td>
      <td><select data-k="kind" aria-label="Soort">${kinds.map(([k, l]) => `<option value="${k}"${k === x.kind ? ' selected' : ''}>${esc(l.split(' ')[0])}</option>`).join('')}</select></td>
      <td><button type="button" class="xdel" data-del="${esc(x.id)}" title="Zeil verwijderen" aria-label="Verwijder ${esc(x.name)}">×</button></td></tr>`).join('');
    renderImg();
  }
  function readTable() {
    const old = sailsFor(ST.boat); const out = []; let bad = 0;
    $('btSailBody').querySelectorAll('tr').forEach((tr, i) => {
      const v = k => tr.querySelector(`[data-k="${k}"]`).value; const prev = old.find(x => x.id === tr.dataset.id) || {};
      const s = normSail({ id: tr.dataset.id, name: v('name'), area: v('area'), tws: [+v('t0'), +v('t1')], twa: [+v('a0'), +v('a1')], col: v('col'), kind: v('kind'), aboard: prev.aboard }, i);
      tr.classList.toggle('bad', !s); if (s) out.push(s); else bad++;
    });
    return bad ? null : out;
  }
  $('btSailBody').addEventListener('change', () => {
    const L = readTable(); if (!L) { msg('btChartMsg', 'Controleer de rood gemarkeerde regel: naam nodig, TWS-bereik ≥ 0,5 kn en TWA-bereik ≥ 1°. Nog niet opgeslagen.', true); return; }
    saveChart(L); msg('btChartMsg', 'Chart opgeslagen.');
  });
  $('btSailBody').addEventListener('click', e => {
    const b = e.target.closest('button[data-del]'); if (!b) return;
    const L = sailsFor(ST.boat).filter(x => x.id !== b.dataset.del); saveChart(L); msg('btChartMsg', 'Zeil verwijderd.');
  });
  $('btSailAdd').onclick = () => {
    const L = sailsFor(ST.boat).slice(); const id = newSailId('NIEUW', L.map(x => x.id));
    L.push(normSail({ id, name: 'Nieuw zeil', area: '', tws: [6, 16], twa: [100, 160], aboard: false }, L.length)); saveChart(L);
    ST.sailsAboard = (ST.sailsAboard || []).concat(aboardList(ST.boat, ST.sailsAboard).map(x => x.id), [id]).filter((x, i, a) => a.indexOf(x) === i);
    setTimeout(() => { const r = $('btSailBody').querySelector(`tr[data-id="${id}"] .nm`); r && (r.focus(), r.select()); }, 30);
  };
  $('btChartFile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const L = parseSailChart(await readText(f), ST.boat); saveChart(L);
      const others = (ST.sailsAboard || []).filter(id => !L.some(x => x.id === id)); ST.sailsAboard = others.concat(L.filter(x => x.aboard).map(x => x.id));
      msg('btChartMsg', `${L.length} zeilen ingelezen uit ${esc(f.name)}. Aan boord gezet volgens de chart (doorgetrokken lijn = aan boord).`);
    } catch (err) { msg('btChartMsg', 'Niet ingelezen: ' + esc(err.message), true); }
  };
  $('btChartDl').onclick = () => download(`sail-chart-${boats[ST.boat].name.replace(/\W+/g, '-')}.csv`, sailsToCsv(sailsFor(ST.boat)), 'text/csv');
  $('btChartReset').onclick = () => { if (!confirm('Eigen chart weggooien en terug naar de standaard?')) return; const m = Object.assign({}, ST.sailChart); delete m[ST.boat]; setCustomSails(m); ST.sailChart = m; msg('btChartMsg', 'Standaardchart hersteld.'); };
  $('btChips').addEventListener('click', e => {
    const b = e.target.closest('button[data-s]'); if (!b) return;
    const all = sailsFor(ST.boat), on = new Set(aboardList(ST.boat, ST.sailsAboard).map(x => x.id));
    on.has(b.dataset.s) ? on.delete(b.dataset.s) : on.add(b.dataset.s);
    if (!on.size) { msg('btChartMsg', 'Minimaal één zeil aan boord.', true); return; }
    const others = (ST.sailsAboard || []).filter(id => !all.some(x => x.id === id));
    ST.sailsAboard = others.concat(all.filter(x => on.has(x.id)).map(x => x.id));
  });

  // afbeelding van de chart (bv. van de zeilmaker), verkleind en per boot bewaard
  function renderImg() {
    const im = (ST.sailImg || {})[ST.boat];
    $('btImgBox').hidden = !im; $('btImgDel').hidden = !im;
    if (im) { $('btImg').src = im.src; $('btImgCap').textContent = im.name + ' · ' + fmtD(im.date); }
  }
  $('btImgFile').onchange = e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); const src = c.toDataURL('image/jpeg', 0.82);
      store.set({ sailImg: Object.assign({}, ST.sailImg, { [ST.boat]: { src, name: f.name, date: Date.now() } }) });
      let kept = true; try { kept = (localStorage.getItem('wc_sailimg') || '').includes(src.slice(-40)); } catch (er) { kept = false; }
      msg('btChartMsg', kept ? 'Afbeelding toegevoegd.' : 'Afbeelding getoond, maar niet bewaard: te weinig opslagruimte in de browser.', !kept);
    };
    img.onerror = () => { URL.revokeObjectURL(url); msg('btChartMsg', 'Dit bestand is geen afbeelding die de browser kan openen (gebruik JPG of PNG; een HTML-chart lees je in met "Chart inlezen").', true); };
    img.src = url;
  };
  $('btImgDel').onclick = () => { const m = Object.assign({}, ST.sailImg); delete m[ST.boat]; ST.sailImg = m; };

  // ---------- veiligheidsmiddelen ----------
  const safe = () => (ST.safety || {})[ST.boat] || { checks: {}, extra: [] };
  const saveSafe = st => { ST.safety = Object.assign({}, ST.safety, { [ST.boat]: Object.assign({}, st, { t: Date.now() }) }); };
  function renderSafety() {
    const st = safe(), L = safetyList(st), p = safetyProgress(st), c = st.checks || {};
    $('btSafeProg').innerHTML = `<b>${p.done}</b> van ${p.total} afgevinkt · verplicht <b>${p.reqDone}/${p.reqTotal}</b>${st.t ? ` <small>· bijgewerkt ${esc(fmtD(st.t))}</small>` : ''}`;
    $('btSafeBar').style.setProperty('--p', (p.total ? p.done / p.total * 100 : 0) + '%');
    $('btSafeBar').classList.toggle('ok', p.reqDone === p.reqTotal);
    $('btSafeList').innerHTML = Object.entries(GROUPS).map(([g, title]) => {
      const items = L.filter(x => x.grp === g); if (!items.length) return '';
      return `<h3>${esc(title)}</h3><ul>${items.map(x => `<li><label class="sfchk"><input type="checkbox" data-sid="${esc(x.id)}"${c[x.id] ? ' checked' : ''}><span>${esc(x.txt)}${x.ref ? ` <small>${esc(x.ref)}</small>` : ''}</span></label>${g === 'eigen' ? `<button type="button" class="xdel" data-sdel="${esc(x.id)}" aria-label="Verwijder ${esc(x.txt)}">×</button>` : ''}</li>`).join('')}</ul>`;
    }).join('');
    $('btSafeSrc').textContent = 'Bron: ' + SAFETY_SRC + ' Controleer bij twijfel het banenboekje en de actuele OSR-tekst.';
  }
  $('btSafeList').addEventListener('change', e => {
    const i = e.target.closest('input[data-sid]'); if (!i) return; const st = safe();
    saveSafe(Object.assign({}, st, { checks: Object.assign({}, st.checks, { [i.dataset.sid]: i.checked }) }));
  });
  $('btSafeList').addEventListener('click', e => {
    const b = e.target.closest('button[data-sdel]'); if (!b) return; const st = safe(); const ch = Object.assign({}, st.checks); delete ch[b.dataset.sdel];
    saveSafe(Object.assign({}, st, { extra: (st.extra || []).filter(x => x.id !== b.dataset.sdel), checks: ch }));
  });
  const addItem = () => { const t = $('btSafeNew').value.trim(); if (!t) return; const st = safe(); saveSafe(Object.assign({}, st, { extra: (st.extra || []).concat([{ id: 'e' + Date.now().toString(36), txt: t.slice(0, 120) }]) })); $('btSafeNew').value = ''; };
  $('btSafeAdd').onclick = addItem; $('btSafeNew').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } };
  $('btSafeClear').onclick = () => { if (!confirm('Alle vinkjes weghalen (bijvoorbeeld voor de controle vóór de volgende race)?')) return; saveSafe(Object.assign({}, safe(), { checks: {} })); };
  $('btSafeAll').onclick = () => { const st = safe(); const ch = {}; safetyList(st).forEach(x => ch[x.id] = true); saveSafe(Object.assign({}, st, { checks: ch })); };

  // ---------- verversen ----------
  const all = () => { renderBoat(); renderPolar(); renderSails(); renderSafety(); };
  store.on(['boat'], all);
  store.on(['polarCustom'], () => { renderBoat(); renderPolar(); renderSails(); });
  store.on(['sailChart', 'sailsAboard'], () => { setCustomSails(ST.sailChart); renderSails(); });
  store.on(['sailImg'], renderImg);
  store.on(['safety'], renderSafety);
  all();
  return { polarOf, refresh: all };
}
