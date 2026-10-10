// End-to-end test van de gebouwde app (dist/github via http). Gebruik: node tests/e2e.cjs http://localhost:8767/
const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8767/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [nm, opt] of [['desktop', { viewport: { width: 1400, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext({ ...opt, acceptDownloads: true, geolocation: { latitude: 51.7634, longitude: 3.876, accuracy: 5 }, permissions: ['geolocation'] });
    await ctx.route(/service\.pdok|fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__said = []; if (window.speechSynthesis) speechSynthesis.speak = u => window.__said.push(u.text); });
    const req = []; p.on('request', r => req.push(r.url()));
    await p.goto(URL); await p.waitForSelector('#lpBody tr');
    ok(!req.some(u => u.includes('jspdf')), `${nm}: PDF-module niet geladen bij start`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nm}: geen horizontale scroll`);
    // instellingen bewaren via de store
    await p.evaluate(() => { const t = document.getElementById('twdIn'); t.value = 250; t.dispatchEvent(new Event('change')); });
    await p.reload(); await p.waitForSelector('#lpBody tr');
    ok(await p.inputValue('#twdIn') === '250', `${nm}: windrichting bewaard na herladen`);
    ok(await p.evaluate(() => window.__store.state.twd) === 250, `${nm}: store kent de waarde`);
    await p.evaluate(() => { const t = document.getElementById('twdIn'); t.value = 270; t.dispatchEvent(new Event('change')); });
    if (nm === 'desktop') {
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('#pdfBtn')]); ok(/\.pdf$/.test(dl.suggestedFilename()), 'PDF gemaakt');
      const [dg] = await Promise.all([p.waitForEvent('download'), p.click('#gpxBtn')]); ok(/\.gpx$/.test(dg.suggestedFilename()), 'GPX gemaakt');
    }
    // racemodus
    await p.click('#tbRace'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.body.classList.contains('race')), `${nm}: racemodus actief`);
    const tools = await p.evaluate(() => [...document.querySelectorAll('.tools button')].filter(e => e.offsetParent).map(e => e.innerText).join(','));
    ok(tools === 'baan,start,finish,legenda,alleen kaart', `${nm}: knoppen rechts (${tools})`);
    await p.evaluate(() => { const r = document.getElementById('rbEffR'); r.value = 90; r.dispatchEvent(new Event('change')); });
    ok(await p.evaluate(() => window.__store.state.eff) === 90, `${nm}: polar-slider zet rendement`);
    await p.evaluate(() => { const r = document.getElementById('rbEffR'); r.value = 100; r.dispatchEvent(new Event('change')); });
    await p.evaluate(() => window.__store.set({ race: { start: Date.now() + 12000, fin: null } })); await p.waitForTimeout(13500);
    const said = await p.evaluate(() => window.__said.filter(t => t.trim()).join('|'));
    ok(said.endsWith('10|9|8|7|6|5|4|3|2|1|start'), `${nm}: gesproken countdown (${said})`);
    ok((await p.innerText('#rbClkLab')).match(/START!|RACE/), `${nm}: klok na de start`);
    await p.click('#rbFin'); await p.waitForTimeout(500);
    ok(await p.innerText('#rbClkLab') === 'GEZEILD', `${nm}: finish gestopt`);
    ok(+(await p.inputValue('#dlOver')) > 0, `${nm}: zeiltijd naar Deelnemers`);
    await p.reload(); await p.waitForSelector('#lpBody tr'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.body.classList.contains('race')) && await p.innerText('#rbClkLab') === 'GEZEILD', `${nm}: tab en race bewaard na herladen`);
    await p.click('#rbSigClr'); await p.click('#tbUitleg'); ok(await p.isVisible('#tabUitleg'), `${nm}: Uitleg`);
    await p.click('#tbKaart');
    ok(errs.length === 0, `${nm}: geen JS-fouten ${errs.join(';')}`);
    await ctx.close();
  }
  await b.close(); console.log(fails ? `${fails} FOUT(EN)` : 'alles ok'); process.exit(fails ? 1 : 0);
})();
