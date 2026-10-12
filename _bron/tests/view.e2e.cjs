// End-to-end test: racemodus alleen kaart / alleen rakken, GPS-vak BTW/DTW/TTG, spi-plan inklapbaar, spi-meldingen optioneel.
const { chromium, devices } = require('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [nm, opt] of [['desktop', { viewport: { width: 1300, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opt); await ctx.route(/service\.pdok|fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.waitForTimeout(300);
    // spi-plan inklapbaar en onthouden
    ok(await p.evaluate(() => document.getElementById('spiPlanBox').open), `${nm}: spi-plan standaard open`);
    await p.evaluate(() => { document.getElementById('spiPlanBox').open = false; }); await p.waitForTimeout(100);
    await p.reload(); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.waitForTimeout(300);
    ok(!(await p.evaluate(() => document.getElementById('spiPlanBox').open)), `${nm}: spi-plan dicht onthouden`);
    // windverwachting zit in Boot & wind en is optioneel
    ok(await p.evaluate(() => !!document.querySelector('.r-wind #rWx') && !document.getElementById('rWx').open), `${nm}: windverwachting in Boot & wind, dichtgeklapt`);
    // spi-meldingen uit
    await p.evaluate(() => { const c = document.getElementById('spiAnnIn'); c.checked = false; c.dispatchEvent(new Event('change')); });
    ok(await p.evaluate(() => document.getElementById('spiLeadIn').disabled && window.__store.state.spiAnn === false), `${nm}: spi-meldingen uit`);
    // racemodus + proefvaart: geen spi-pop als meldingen uit
    await p.click('#tbRace'); await p.waitForTimeout(400); await p.selectOption('#gDemoSpd', '60'); await p.click('#gDemo'); await p.waitForTimeout(4000);
    ok(/^\d/.test(await p.textContent('#gBtw')) && /^\d/.test(await p.textContent('#gDtw')) && /\d:\d\d/.test(await p.textContent('#gTtg')), `${nm}: BTW ${await p.textContent('#gBtw')} · DTW ${await p.textContent('#gDtw')} · TTG ${await p.textContent('#gTtg')}`);
    ok(/BTW/.test(await p.textContent('.gpshud .nav3')) && /DTW/.test(await p.textContent('.gpshud .nav3')) && /TTG/.test(await p.textContent('.gpshud .nav3')), `${nm}: labels BTW/DTW/TTG`);
    const fs = await p.$eval('#gDtw', e => parseFloat(getComputedStyle(e).fontSize)); ok(fs >= 20, `${nm}: grote cijfers (${fs}px)`);
    // alleen kaart → alleen rakken → alle vensters
    await p.click('#mapOnly'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.body.classList.contains('maponly')) && !(await p.isVisible('#legsPanel')) && !(await p.isVisible('#gpsHud')), `${nm}: alleen kaart, geen rakkenvenster`);
    ok(await p.isVisible('#legsOnly'), `${nm}: knop alleen rakken zichtbaar in kaartmodus`);
    await p.click('#legsOnly'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.body.classList.contains('legsonly') && !document.body.classList.contains('maponly')) && await p.isVisible('#lpBody'), `${nm}: alleen rakken`);
    const box = await p.locator('#legsPanel').boundingBox(); const vp = p.viewportSize();
    ok(box.width >= vp.width - 2, `${nm}: rakken schermvullend (${Math.round(box.width)}/${vp.width})`);
    ok(await p.isVisible('#mapOnly') && await p.isVisible('#legsOnly'), `${nm}: schakelknoppen zichtbaar`);
    await p.click('#mapOnly'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.body.classList.contains('maponly') && !document.body.classList.contains('legsonly')), `${nm}: terug naar alleen kaart`);
    await p.click('#mapOnly'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => !document.body.classList.contains('maponly') && !document.body.classList.contains('legsonly')), `${nm}: alle vensters terug`);
    ok(await p.isHidden('#spiPop'), `${nm}: geen spi-melding als uitgezet`);
    await p.click('#gDemo'); await p.waitForTimeout(200);
    ok(errs.length === 0, `${nm}: geen JS-fouten ${errs.join(';')}`); await ctx.close();
  }
  await b.close(); console.log(fails ? `${fails} FOUT(EN)` : 'alles ok'); process.exit(fails ? 1 : 0);
})();
