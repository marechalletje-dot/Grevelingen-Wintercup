// End-to-end test: start/gate via invoervelden en via slepen op de kaart. Gebruik: node tests/startgate.e2e.cjs http://localhost:8770/
const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8770/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const row1 = p => p.evaluate(() => { const r = document.querySelector('#lpBody tr'); return r.innerText.replace(/\s+/g, ' '); });
(async () => {
  const b = await chromium.launch();
  for (const [nm, opt] of [['desktop', { viewport: { width: 1400, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opt); await ctx.route(/service\.pdok|fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForSelector('#lpBody tr');
    ok(await p.inputValue('#sgDist') === '0.50', `${nm}: standaard afstand 0.50 nm (${await p.inputValue('#sgDist')})`);
    const c0 = await p.inputValue('#sgCrs'); ok(Math.abs(+c0 - 268) <= 1, `${nm}: standaard koers ${c0}°M`);
    const t0 = await p.innerText('#lpTotT');
    // invoervelden
    await p.fill('#sgDist', '0.8'); await p.press('#sgDist', 'Enter'); await p.fill('#sgCrs', '250'); await p.press('#sgCrs', 'Enter'); await p.waitForTimeout(200);
    const r1 = await row1(p); ok(/250°/.test(r1) && (nm === 'iphone' || /0\.80/.test(r1)) && await p.inputValue('#sgDist') === '0.80', `${nm}: eerste rak = 250° 0.80 nm (${r1})`);
    ok(await p.innerText('#lpTotT') !== t0, `${nm}: totale tijd rekent mee (${t0} -> ${await p.innerText('#lpTotT')})`);
    ok(await p.isVisible('#sgReset'), `${nm}: knop terug naar berekend zichtbaar`);
    // slepen van de gate op de kaart
    await p.evaluate(() => document.getElementById('fitS').click()); await p.waitForTimeout(300);
    const h = p.locator('.sgh[data-k="gate"]'); await h.scrollIntoViewIfNeeded(); const bb = await h.boundingBox();
    const d1 = await p.inputValue('#sgDist');
    await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.move(bb.x + bb.width / 2 + 60, bb.y + bb.height / 2 + 40, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
    const d2 = await p.inputValue('#sgDist'), c2 = await p.inputValue('#sgCrs');
    ok(d2 !== d1 || c2 !== '250', `${nm}: gate versleept -> ${d2} nm ${c2}°M`);
    // kaart mag niet mee-pannen tijdens slepen: de start blijft op dezelfde plek op het scherm
    const s0 = await p.locator('.sgh[data-k="start"]').boundingBox();
    // start slepen
    await p.mouse.move(s0.x + s0.width / 2, s0.y + s0.height / 2); await p.mouse.down(); await p.mouse.move(s0.x + s0.width / 2 - 30, s0.y + s0.height / 2, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
    const s1 = await p.locator('.sgh[data-k="start"]').boundingBox(); ok(Math.abs((s1.x - s0.x) + 30) < 4, `${nm}: start versleept (${Math.round(s1.x - s0.x)} px)`);
    const g1 = await p.locator('.sgh[data-k="gate"]').boundingBox(); ok(Math.abs(g1.x - (bb.x + 60)) < 6, `${nm}: gate bleef staan bij slepen van de start`);
    // bewaren
    const before = await row1(p); await p.reload(); await p.waitForSelector('#lpBody tr'); ok(await row1(p) === before, `${nm}: aanpassing bewaard na herladen`);
    // racemodus: geen sleepcirkels
    await p.click('#tbRace'); await p.waitForTimeout(300); ok(!(await p.locator('.sgh').first().isVisible()), `${nm}: racemodus zonder sleepcirkels`);
    ok(await row1(p) === before, `${nm}: racemodus gebruikt dezelfde start/gate`);
    await p.click('#tbKaart'); await p.waitForTimeout(200);
    await p.locator('#sgReset').scrollIntoViewIfNeeded(); await p.click('#sgReset'); await p.waitForTimeout(200);
    ok(await p.inputValue('#sgDist') === '0.50' && await p.innerText('#lpTotT') === t0, `${nm}: terug naar berekend`);
    ok(errs.length === 0, `${nm}: geen JS-fouten ${errs.join(';')}`); await ctx.close();
  }
  await b.close(); console.log(fails ? `${fails} FOUT(EN)` : 'alles ok'); process.exit(fails ? 1 : 0);
})();
