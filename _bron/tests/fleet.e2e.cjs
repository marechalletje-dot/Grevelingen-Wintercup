// End-to-end test: deelnemerslijst 2026/2027 per klasse, eigen boot, ratings. Gebruik: node tests/fleet.e2e.cjs http://localhost:8776/
const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8776/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const rows = p => p.$$eval('#dlBody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
(async () => {
  const b = await chromium.launch();
  for (const [nm, opt] of [['desktop', { viewport: { width: 1400, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opt); await ctx.route(/service\.pdok|fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForSelector('#lpBody tr'); await p.click('#tbDeeln'); await p.waitForTimeout(300);
    let r = await rows(p);
    ok(await p.inputValue('#dlCls') === 'TS' && r.length === 46, `${nm}: Toer-S, 46 rijen (${r.length})`);
    ok(r.filter(x => /Dream Machine/i.test(x)).length === 1 && r.some(x => /^ 803/.test(x) || /803/.test(x)), `${nm}: Dream Machine één keer (eigen rij)`);
    const ab = r.find(x => /A BOEN/.test(x)); ok(/0\.9989/.test(await p.$eval('#dlBody', e => e.innerHTML.match(/A BOEN[\s\S]*?value="([\d.]+)"/)[1])), `${nm}: A BOEN 0,9989`);
    ok(r.some(x => /X-POLE/.test(x) && /≈ ORC ToT/.test(x)), `${nm}: X-POLE in Toer-S met schatting`);
    ok(r.filter(x => /vul een factor in/.test(x)).length === 13, `${nm}: 13 Toer-S-boten zonder rating (${r.filter(x => /vul een factor in/.test(x)).length})`);
    await p.selectOption('#dlCls', 'ORC'); await p.waitForTimeout(200); r = await rows(p);
    ok(r.length === 12 && r.some(x => /VINDIO/.test(x)), `${nm}: ORC 11 + eigen rij (${r.length})`);
    await p.selectOption('#dlCls', 'T'); await p.waitForTimeout(200); r = await rows(p); ok(r.length === 40, `${nm}: Toer 39 + eigen rij (${r.length})`);
    await p.selectOption('#dlCls', 'MH'); await p.waitForTimeout(200); r = await rows(p); ok(r.length === 5 && r.some(x => /TRI4FIVE/.test(x)), `${nm}: Multihull 4 + eigen rij`);
    // andere boot: X-C Pole
    await p.click('#tbKaart'); await p.waitForTimeout(100); await p.selectOption('#boatSel', 'xp'); await p.click('#tbDeeln'); await p.waitForTimeout(300);
    r = await rows(p); ok(await p.inputValue('#dlCls') === 'TS' && !r.some(x => /X-POLE/.test(x)) && r.some(x => /X-C Pole/.test(x)), `${nm}: X-C Pole eigen rij, X-POLE niet dubbel`);
    ok(await p.inputValue('#dlMy') === '0.9995', `${nm}: factor X-C Pole Toer-S 0.9995 (${await p.inputValue('#dlMy')})`);
    await p.selectOption('#dlCls', 'ORC'); await p.waitForTimeout(200); ok(await p.inputValue('#dlMy') === '1.0924', `${nm}: in ORC 1.0924`);
    // rating invullen voor boot zonder rating
    await p.selectOption('#dlCls', 'TS'); await p.waitForTimeout(200);
    const inp = p.locator('#dlBody tr', { hasText: 'BRUISER' }).locator('input.dlF'); await inp.fill('0.9500'); await inp.press('Enter'); await p.waitForTimeout(200);
    r = await rows(p); ok(r.some(x => /BRUISER/.test(x) && /handmatig/.test(x) && /m$/.test(x.trim())), `${nm}: BRUISER handmatig 0,95 telt mee`);
    await p.reload(); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.click('#tbDeeln').catch(() => {}); await p.waitForTimeout(300);
    r = await rows(p); ok(r.some(x => /BRUISER/.test(x) && /handmatig/.test(x)), `${nm}: handmatige rating bewaard`);
    await p.click('#dlReset'); await p.waitForTimeout(200);
    await p.click('#tbKaart'); await p.selectOption('#boatSel', 'dm');
    ok(errs.length === 0, `${nm}: geen JS-fouten ${errs.join(';')}`); await ctx.close();
  }
  await b.close(); console.log(fails ? `${fails} FOUT(EN)` : 'alles ok'); process.exit(fails ? 1 : 0);
})();
