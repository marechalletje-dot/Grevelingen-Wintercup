// End-to-end test: tab Bepalingen (startvolgorde, vlaggen, 5-min sein naar Racemodus). Gebruik: node tests/regels.e2e.cjs http://localhost:8790/
const { chromium } = require('playwright');
const URL = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FOUT ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); 
  for (const vp of [{ width: 1300, height: 900, nm: 'groot' }, { width: 390, height: 844, nm: 'telefoon' }]) {
    const p = await b.newPage({ viewport: vp }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForSelector('#lpBody tr', { state: 'attached' });
    await p.click('#tbRegels'); await p.waitForTimeout(200);
    ok(await p.isVisible('#tabRegels'), `${vp.nm}: tab zichtbaar`); ok(!(await p.isVisible('#tabKaart')), `${vp.nm}: kaart verborgen`);
    ok((await p.locator('#tabRegels svg.sflag').count()) >= 20, `${vp.nm}: vlaggen getekend`);
    ok((await p.textContent('#wbMine')).includes('11:00'), `${vp.nm}: 1e start 11:00`);
    await p.selectOption('#wbPos', '3'); await p.selectOption('#wbGrp', 'TS2');
    const t = await p.textContent('#wbMine'); ok(t.includes('11:05') && t.includes('11:10') && t.includes('Toer-S 2'), `${vp.nm}: 3e start 11:05→11:10`);
    ok((await p.textContent('#wbChain tr.me')).includes('11:10'), `${vp.nm}: eigen regel gemarkeerd`);
    await p.click('#wbToRace'); ok((await p.textContent('#wbSet')).includes('11:05'), `${vp.nm}: sein gezet`);
    await p.reload(); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.waitForTimeout(300);
    ok(await p.isVisible('#tabRegels'), `${vp.nm}: tab onthouden`);
    ok((await p.inputValue('#wbGrp')) === 'TS2' && (await p.inputValue('#wbPos')) === '3', `${vp.nm}: keuze onthouden`);
    await p.click('[data-pid="wb2"] .pcolb'); await p.waitForTimeout(100); ok((await p.locator('[data-pid="wb2"]').boundingBox()).height < 60, `${vp.nm}: paneel klapbaar`);
    await p.click('#tbRace'); await p.waitForTimeout(300); ok((await p.inputValue('#rbSig5')).startsWith('11:05'), `${vp.nm}: Racemodus 5-min sein 11:05`);
    ok(errs.length === 0, `${vp.nm}: geen JS-fouten ${errs.join('; ')}`);
    await p.close();
  }
  await b.close(); console.log(fails ? `${fails} FOUT` : 'ALLES OK'); process.exit(fails ? 1 : 0);
})();
