// End-to-end test: laylines alleen voor het huidige rak; kruisrak = overstag, voor de wind = gijp.
const { chromium } = require('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }); await ctx.route(/service\.pdok|fonts\.|open-meteo/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForSelector('#lpBody tr', { state: 'attached' });
  await p.evaluate(() => { window.__store.set({ allC: true, twd: 270, area: 'B', tws: 12 }); document.getElementById('c54').click(); }); await p.waitForTimeout(200);
  ok(await p.locator('line.layl').count() === 0, 'Race preparation: geen laylines');
  await p.click('#tbRace'); await p.waitForTimeout(400); await p.evaluate(() => { document.getElementById('spiPop').hidden = true; });
  ok(await p.locator('line.layl.up').count() === 2 && await p.locator('line.layl.dn').count() === 0, 'rak 1 (kruisrak naar de gate): 2 overstag-laylines');
  await p.selectOption('#gDemoSpd', '60'); await p.click('#gDemo');
  await p.waitForFunction(() => /Rak 2\//.test(document.getElementById('gTo').textContent), null, { timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(500);
  const to = await p.textContent('#gTo');
  ok(/Rak 2\//.test(to), 'proefvaart in rak 2: ' + to);
  ok(await p.locator('line.layl.dn').count() === 2 && await p.locator('line.layl.up').count() === 0, 'rak 2 (voor de wind): 2 gijp-laylines, geen kruis-laylines');
  ok(/gijp/.test(await p.locator('.laylab').first().textContent()), 'label met gijp');
  ok(errs.length === 0, 'geen JS-fouten ' + errs.join(';'));
  await b.close(); console.log(fails ? fails + ' FOUT(EN)' : 'alles ok'); process.exit(fails ? 1 : 0);
})();
