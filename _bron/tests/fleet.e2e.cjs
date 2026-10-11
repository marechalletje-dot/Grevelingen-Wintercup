// End-to-end test: deelnemers per groep (Toer-S 1, ORC 1) en per klasse, eigen boot, ratings. Gebruik: node tests/fleet.e2e.cjs http://localhost:8776/
const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8776/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const rows = p => p.$$eval('#dlBody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
(async () => {
  const b = await chromium.launch();
  for (const [nm, opt] of [['desktop', { viewport: { width: 1400, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opt); await ctx.route(/service\.pdok|fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const fv = async bt => +(await p.locator('#dlBody tr', { hasText: bt }).first().locator('input.dlF').inputValue());
    await p.goto(URL); await p.waitForSelector('#lpBody tr'); await p.click('#tbDeeln'); await p.waitForTimeout(300);
    let r = await rows(p);
    ok(await p.inputValue('#dlCls') === 'TS1' && r.length === 15, `${nm}: Dream Machine → Toer-S groep 1, 14 + eigen rij (${r.length})`);
    ok(r.filter(x => /Dream Machine/i.test(x)).length === 1, `${nm}: Dream Machine één keer (eigen rij)`);
    ok(await p.inputValue('#dlMy') === '1.0029', `${nm}: eigen factor 1,0029 (${await p.inputValue('#dlMy')})`);
    ok(Math.abs(await fv('BRUISER') - 0.98) < 1e-4 && Math.abs(await fv('CAMELOT') - 1.021) < 1e-4, `${nm}: BRUISER 0,98 en CAMELOT 1,0210 uit startlijst`);
    await p.selectOption('#dlCls', 'TS'); await p.waitForTimeout(200); r = await rows(p);
    ok(r.length === 46, `${nm}: Toer-S alle groepen 46 rijen (${r.length})`);
    ok(r.filter(x => /vul een factor in/.test(x)).length === 9, `${nm}: 9 Toer-S-boten zonder rating`);
    await p.selectOption('#dlCls', 'ORC'); await p.waitForTimeout(200); r = await rows(p);
    ok(r.length === 12 && r.some(x => /VINDIO/.test(x)), `${nm}: ORC alle 11 + eigen rij (${r.length})`);
    await p.selectOption('#dlCls', 'T'); await p.waitForTimeout(200); r = await rows(p); ok(r.length === 40, `${nm}: Toer 39 + eigen rij (${r.length})`);
    await p.selectOption('#dlCls', 'MH'); await p.waitForTimeout(200); r = await rows(p); ok(r.length === 5 && r.some(x => /TRI4FIVE/.test(x)), `${nm}: Multihull 4 + eigen rij`);
    // X-C Pole → ORC groep 1
    await p.click('#tbKaart'); await p.waitForTimeout(100); await p.selectOption('#boatSel', 'xp'); await p.click('#tbDeeln'); await p.waitForTimeout(300);
    r = await rows(p); ok(await p.inputValue('#dlCls') === 'ORC1' && r.length === 8 && r.some(x => /X-C Pole/.test(x)), `${nm}: X-C Pole → ORC groep 1, 7 + eigen rij (${r.length})`);
    ok(await p.inputValue('#dlMy') === '1.0924', `${nm}: X-C Pole ORC 1,0924`);
    ok(Math.abs(await fv('BOERDERIJ') - 1.1168) < 1e-4 && r.some(x => /BOERDERIJ/.test(x) && /afgeleid uit uitslag/.test(x)), `${nm}: BOERDERIJ 1,1168 afgeleid uit uitslag`);
    // handmatige rating bewaren
    await p.selectOption('#dlCls', 'ORC1'); await p.waitForTimeout(200);
    const inp = p.locator('#dlBody tr', { hasText: 'SOULMATE' }).locator('input.dlF'); await inp.fill('1.1000'); await inp.press('Enter'); await p.waitForTimeout(200);
    r = await rows(p); ok(r.some(x => /SOULMATE/.test(x) && /handmatig/.test(x)), `${nm}: SOULMATE handmatig 1,10`);
    await p.reload(); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.click('#tbDeeln').catch(() => {}); await p.waitForTimeout(300);
    r = await rows(p); ok(r.some(x => /SOULMATE/.test(x) && /handmatig/.test(x)), `${nm}: handmatige rating bewaard`);
    await p.click('#dlReset'); await p.waitForTimeout(200);
    await p.click('#tbKaart'); await p.selectOption('#boatSel', 'dm');
    ok(errs.length === 0, `${nm}: geen JS-fouten ${errs.join(';')}`); await ctx.close();
  }
  await b.close(); console.log(fails ? `${fails} FOUT(EN)` : 'alles ok'); process.exit(fails ? 1 : 0);
})();
