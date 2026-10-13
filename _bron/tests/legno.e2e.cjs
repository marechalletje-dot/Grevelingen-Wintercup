// End-to-end test: raknummers staan bij geen enkele baan op een boei, merkteken-label of op elkaar.
const { chromium } = require('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  // MAX: bovengrens (v47: 197 / 92 / 455); bij heel ver uitgezoomd is er soms geen vrije plek
  for (const [vp, ZOOM, MAX] of [[{ width: 1300, height: 900 }, 0, 15], [{ width: 1300, height: 900 }, 3, 2], [{ width: 390, height: 844 }, 4, 200]]) {
    const ctx = await b.newContext({ viewport: vp }); await ctx.route(/service\.pdok|fonts\.|open-meteo/, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForSelector('#lpBody tr', { state: 'attached' });
    const ids = await p.evaluate(() => [...document.querySelectorAll('#chips button')].map(x => x.id));
    const bad = []; let n = 0;
    for (const id of ids) {
      await p.evaluate(id => { window.__store.set({ allC: true, twd: 270 }); document.getElementById(id).click(); }, id); await p.waitForTimeout(120);
      if (ZOOM) { const bx = await p.locator('#map').boundingBox(); await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); for (let z = 0; z < ZOOM; z++) { await p.mouse.wheel(0, -300); await p.waitForTimeout(60); } await p.waitForTimeout(250); }
      const r = await p.evaluate(() => {
        const box = document.getElementById('map').getBoundingClientRect(); const out = [];
        const obs = [...document.querySelectorAll('#buoys .bz,#course .mk .ring,#course .rbadge rect,#course .gateb,#course .fbuoy,#course .fship')].map(e => [e, e.getBoundingClientRect()]).filter(([, r]) => r.width || r.height);
        const L = [...document.querySelectorAll('#toplayer .legno circle')].map(c => { const r = c.getBoundingClientRect(); return { li: +c.parentNode.dataset.li + 1, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, rad: r.width / 2 }; });
        L.forEach((a, i) => {
          if (a.cx < box.left || a.cx > box.right || a.cy < box.top || a.cy > box.bottom) return;
          for (const [e, r] of obs) { const dx = Math.max(r.left - a.cx, 0, a.cx - r.right), dy = Math.max(r.top - a.cy, 0, a.cy - r.bottom); if (dx * dx + dy * dy < (a.rad - 1) ** 2) { out.push(`rak ${a.li} op ${e.closest('g[data-n]') ? e.closest('g[data-n]').dataset.n : e.getAttribute('class')}`); break; } }
          L.slice(i + 1).forEach(b2 => { if (Math.hypot(a.cx - b2.cx, a.cy - b2.cy) < a.rad + b2.rad - 2) out.push(`rak ${a.li} op rak ${b2.li}`); });
        });
        return { out, n: L.length };
      });
      n += r.n; r.out.forEach(x => bad.push(id.slice(1) + ': ' + x));
    }
    ok(bad.length <= MAX, `${vp.width}px zoom ${ZOOM}: ${n} raknummers in ${ids.length} banen, overlappend: ${bad.length} (max ${MAX})${bad.length ? ' → ' + bad.slice(0, 15).join('; ') : ''}`);
    ok(errs.length === 0, 'geen JS-fouten ' + errs.join(';'));
    await ctx.close();
  }
  await b.close(); console.log(fails ? fails + ' FOUT(EN)' : 'alles ok'); process.exit(fails ? 1 : 0);
})();
