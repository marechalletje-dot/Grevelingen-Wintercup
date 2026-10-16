// Tab Banenboekje: de originele pagina's met alle banen uit het banenboekje (als afbeelding, ook offline),
// de tabel van de gekozen baan uitgesneden uit het boekje, en een link naar de originele PDF.
// Data: window.__BOEKJE (build.py, uit assets/boekje/index.json). In de Claude-artifact is die er niet (te groot).
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Uitsnede (x, y, w, h als fractie van de pagina) → stijl voor container en afbeelding. Puur, voor tests. */
export function cropStyle(b, ratio) {
  return {
    box: `aspect-ratio:${(b.w * ratio / b.h).toFixed(4)}`,
    img: `width:${(100 / b.w).toFixed(3)}%;left:${(-b.x / b.w * 100).toFixed(3)}%;top:${(-b.y / b.h * 100).toFixed(3)}%`,
  };
}

export function initBoekje(o) {
  const { store } = o; const ST = store.S; const BK = window.__BOEKJE;
  if (!BK) {
    $('bkTop').hidden = true; $('bkPages').innerHTML = '';
    $('bkNone').hidden = false;
    return { refresh() {} };
  }
  const pageOf = n => BK.pages.find(p => p.n === n);
  $('bkSrc').textContent = 'Bron: ' + BK.src + '.';
  $('bkPdf').href = BK.pdf;
  $('bkNav').innerHTML = BK.pages.map(p => `<button type="button" data-p="${p.n}"><b>${p.n}</b> ${esc(p.t)}</button>`).join('');
  $('bkPages').innerHTML = BK.pages.map(p => `<figure class="bk-page" id="bkp${p.n}"><a href="${p.src}" target="_blank" rel="noopener" title="Open pagina ${p.n} groot (inzoomen)">`
    + `<img src="${p.src}" loading="lazy" decoding="async" width="2331" height="1654" alt="Banenboekje pagina ${p.n}: ${esc(p.t)}"></a>`
    + `<figcaption>Pagina ${p.n} · ${esc(p.t)}</figcaption></figure>`).join('');
  const go = n => { const e = $('bkp' + n); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  $('bkNav').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (b) go(+b.dataset.p); });

  // gekozen baan: tabel uit het boekje
  let baan = ST.baan;
  function renderBaan() {
    $('bkBaan').value = baan;
    const b = BK.banen[String(baan)];
    if (!b) { $('bkCrop').innerHTML = `<p class="hint">Baan ${esc(baan)} staat niet in het banenboekje (banen 2–5 en 51–90).</p>`; $('bkGo').hidden = true; return; }
    const pg = pageOf(b.p), st = cropStyle(b, BK.ratio);
    $('bkCrop').innerHTML = `<div class="bk-crop" style="${st.box}"><img src="${pg.src}" style="${st.img}" alt="Baan ${baan} uit het banenboekje"></div>`;
    $('bkGo').hidden = false; $('bkGo').textContent = `Hele pagina ${b.p} tonen`; $('bkGo').onclick = () => go(b.p);
  }
  $('bkBaan').onchange = () => { const v = Math.round(+$('bkBaan').value); if (v > 0) { baan = v; renderBaan(); } };
  $('bkCur').onclick = () => { baan = ST.baan; renderBaan(); };
  store.on(['baan'], () => { baan = ST.baan; renderBaan(); $('bkCur').textContent = `Baan uit Race preparation (${ST.baan})`; });
  $('bkCur').textContent = `Baan uit Race preparation (${ST.baan})`;

  // offline bewaren: alle pagina's en de PDF ophalen (de service worker bewaart ze)
  const files = [BK.pdf, ...BK.pages.map(p => p.src)];
  async function offlineState() {
    try {
      if (!window.caches) return null;
      const c = await caches.open('wintercup-assets'); let n = 0;
      for (const f of files) if (await c.match(new URL(f, location.href).pathname)) n++;
      return n;
    } catch (e) { return null; }
  }
  async function showOffline() {
    const n = await offlineState();
    $('bkOffMsg').textContent = n == null ? 'Offline bewaren werkt alleen in de online versie (https).' : n === files.length ? 'Alle pagina\'s en de PDF staan op dit toestel (ook zonder bereik).' : `${n} van ${files.length} bestanden op dit toestel.`;
  }
  $('bkOff').onclick = async () => {
    $('bkOff').disabled = true; let ok = 0;
    for (const f of files) { try { const r = await fetch(f); if (r.ok) { await r.blob(); ok++; } } catch (e) {} $('bkOffMsg').textContent = `Ophalen… ${ok}/${files.length}`; }
    $('bkOff').disabled = false; setTimeout(showOffline, 300);
  };
  renderBaan(); showOffline();
  return { refresh: renderBaan };
}
