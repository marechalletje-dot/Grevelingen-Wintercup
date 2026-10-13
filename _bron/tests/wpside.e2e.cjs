// End-to-end test: GB 11-RB 2 is geen baanmerk; altijd aan de noordkant voorbij (oostwaarts SB, westwaarts BB).
const { chromium } = require('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }); await ctx.route(/service\.pdok|fonts\.|open-meteo/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForSelector('#lpBody tr', { state: 'attached' });
  for (const n of [64, 54, 62, 90]) {
    await p.evaluate(n => { window.__store.set({ allC: true, twd: 270, area: 'B' }); const b = document.getElementById('c' + n); b.disabled = false; b.click(); }, n); await p.waitForTimeout(300);
    const L = await p.evaluate(() => window.__legs()); const G = [-0.453, 0.253]; let near = 0;
    L.forEach((l, li) => { for (let j = 1; j < l.p.length; j++) { const a = l.p[j - 1], b = l.p[j]; const vx = b[0] - a[0], vy = b[1] - a[1]; let t = ((G[0] - a[0]) * vx + (G[1] - a[1]) * vy) / (vx * vx + vy * vy || 1e-12); t = Math.max(0, Math.min(1, t)); const c = [a[0] + vx * t, a[1] + vy * t]; const dd = Math.hypot(c[0] - G[0], c[1] - G[1]);
      if (dd < 0.15) { near++; ok(c[1] < G[1] - 0.015, `baan ${n} rak ${li + 1}: langs GB 11-RB 2 aan de noordkant (${(dd * 1852).toFixed(0)} m)`); } } });
    ok(true, `baan ${n}: ${near} stukken in de buurt van GB 11-RB 2`);
  }
  ok(errs.length === 0, 'geen JS-fouten ' + errs.join(';'));
  await b.close(); console.log(fails ? fails + ' FOUT(EN)' : 'alles ok'); process.exit(fails ? 1 : 0);
})();
