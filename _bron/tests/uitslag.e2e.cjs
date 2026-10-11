// End-to-end test: tab Uitslagen (tussenstand + daguitslag). Gebruik: node tests/uitslag.e2e.cjs http://localhost:8791/
const { chromium, devices } = require('playwright');
const URL = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [nm, opt] of [['desktop', { viewport: { width: 1300, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opt); await ctx.route(/service\.pdok|fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.click('#tbUitslag'); await p.waitForTimeout(300);
    ok(await p.isVisible('#tabUitslag'), `${nm}: tab zichtbaar`);
    ok((await p.locator('#uCal .ucal').count()) === 7 && (await p.locator('#uCal .ucal.done').count()) === 1, `${nm}: kalender 7 dagen, 1 gevaren`);
    let me = await p.textContent('#uStandBody tr.me'); ok(/Dream Machine/.test(me) && /^\s*2/.test(me), `${nm}: Dream Machine 2e in Toer-S 1 (${me.trim().slice(0, 30)})`);
    ok((await p.locator('#uStandBody tr').count()) === 15, `${nm}: 15 boten in groep 1`);
    ok((await p.locator('#uRaceBody tr').count()) === 15 && /2:56:09/.test(await p.textContent('#uRaceBody')), `${nm}: daguitslag met gecorrigeerde tijd`);
    await p.click('#uGrp button[data-g="ORC1"]'); await p.waitForTimeout(200);
    me = await p.textContent('#uStandBody tr.me'); ok(/X-C Pole/.test(me) && /DNF/.test(me), `${nm}: X-C Pole DNF in ORC 1`);
    await p.reload(); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.waitForTimeout(300);
    ok(await p.isVisible('#tabUitslag') && (await p.getAttribute('#uGrp button[data-g="ORC1"]', 'aria-pressed')) === 'true', `${nm}: tab en groep onthouden`);
    ok(errs.length === 0, `${nm}: geen JS-fouten ${errs.join(';')}`);
    await ctx.close();
  }
  await b.close(); console.log(fails ? `${fails} FOUT(EN)` : 'alles ok'); process.exit(fails ? 1 : 0);
})();
