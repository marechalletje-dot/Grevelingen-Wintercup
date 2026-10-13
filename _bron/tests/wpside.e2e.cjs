// End-to-end test: GB 11-RB 2 is geen baanmerk; altijd aan de noordkant voorbij (oostwaarts SB, westwaarts BB).
const { chromium } = require('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }); await ctx.route(/service\.pdok|fonts\.|open-meteo/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForSelector('#lpBody tr', { state: 'attached' });
  for (const n of [64, 54, 62, 90]) {
    await p.evaluate(n => { window.__store.set({ allC: true, twd: 270, area: 'B' }); document.getElementById('c' + n).click(); }, n); await p.waitForTimeout(300);
    const L = await p.evaluate(() => window.__legs()); const BY = -0.253; // buoy y (nm, zuid positief)
    let hits = 0;
    L.forEach(l => (l.wp || []).forEach((w, j) => { if (w !== 'GB 11-RB 2') return; hits++;
      const y = l.p[j][1], dx = l.p[j + 1][0] - l.p[j - 1][0], side = l.wpf && l.wpf[j];
      ok(y < 0.253 - 0.02, `baan ${n}: punt bij GB 11-RB 2 ligt ten noorden van de boei (y ${y.toFixed(3)})`);
      ok(side === (dx > 0 ? 'SB' : 'BB'), `baan ${n}: ${dx > 0 ? 'oost' : 'west'}waarts aan ${side}`); }));
    ok(hits > 0, `baan ${n}: GB 11-RB 2 in de route`);
    const sub = await p.locator('#lpBody tr.subrow').allInnerTexts(); ok(sub.some(t => /GB 11-RB 2 \(pass\. (SB|BB)\)/.test(t)), `baan ${n}: deelrak toont passeerkant`);
    ok(await p.evaluate(() => [...document.querySelectorAll('.rbadge.pass text')].some(t => /pass\./.test(t.textContent))), `baan ${n}: label op de kaart`);
  }
  ok(errs.length === 0, 'geen JS-fouten ' + errs.join(';'));
  await b.close(); console.log(fails ? fails + ' FOUT(EN)' : 'alles ok'); process.exit(fails ? 1 : 0);
})();
