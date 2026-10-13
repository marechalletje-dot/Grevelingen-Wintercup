// End-to-end test: passeermerken (alleen aan een kant laten liggen) → rechte lijn naar het volgende rondingsmerk.
const { chromium } = require('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }); await ctx.route(/service\.pdok|fonts\.|open-meteo/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForSelector('#lpBody tr', { state: 'attached' });
  await p.evaluate(() => { window.__store.set({ allC: true, twd: 270, area: 'B' }); document.getElementById('c54').click(); }); await p.waitForTimeout(300);
  ok((await p.evaluate(() => window.__pass())).includes('SP 40'), 'baan 54: SP 40 is passeermerk');
  const row = await p.locator('#lpBody tr[data-i="1"]:not(.subrow)').innerText(); ok(/passeren SB/.test(row) && /niet ronden/.test(row), 'rakkentabel: passeren SB, niet ronden');
  const geo = await p.evaluate(() => { const L = window.__course(); const R = Math.PI / 180;
    const brg = (a, b) => ((Math.atan2((b[1] - a[1]) * Math.cos(a[0] * R), b[0] - a[0]) / R) + 360) % 360;
    const l2 = L[1], l3 = L[2]; return { n2: l2.length, b2: brg(l2[0], l2[l2.length - 1]), b3: brg(l3[0], l3[l3.length - 1]) }; });
  ok(geo.n2 === 2 && Math.abs(geo.b2 - geo.b3) < 3, `rak 2 en 3 in één rechte lijn (${geo.b2.toFixed(0)}° / ${geo.b3.toFixed(0)}°)`);
  // een echt rondingsmerk blijft gerond (G37/PG2 op baan 54)
  const row5 = await p.locator('#lpBody tr[data-i="3"]:not(.subrow)').innerText(); ok(!/passeren/.test(row5), 'G37/PG2 blijft rondingsmerk');
  ok(errs.length === 0, 'geen JS-fouten ' + errs.join(';'));
  await b.close(); console.log(fails ? fails + ' FOUT(EN)' : 'alles ok'); process.exit(fails ? 1 : 0);
})();
