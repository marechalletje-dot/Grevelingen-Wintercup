// End-to-end test: tab Banenboekje en tabbalk op de telefoon. Gebruik: node tests/boekje.e2e.cjs http://localhost:8790/
const { chromium } = require('playwright'); const path = require('path');
const URL = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FOUT ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const vp of [{ width: 1300, height: 900, nm: 'groot' }, { width: 390, height: 844, nm: 'telefoon' }]) {
    const p = await b.newPage({ viewport: vp }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForSelector('#lpBody tr', { state: 'attached' });
    for (const t of ['tbKaart', 'tbRace', 'tbBoot', 'tbBoekje', 'tbAnalyse', 'tbDeeln', 'tbUitslag', 'tbRegels', 'tbUitleg']) {
      const bb = await p.locator('#' + t).boundingBox(); ok(bb && bb.x >= 0 && bb.x + bb.width <= vp.width + 1, `${vp.nm}: tab ${t} zichtbaar zonder scrollen`);
    }
    await p.evaluate(() => window.__store.S.baan = 63);
    await p.click('#toBoekje'); await p.waitForTimeout(300);
    ok(await p.isVisible('#tabBoekje'), `${vp.nm}: tab Banenboekje via link`);
    ok((await p.locator('#bkPages img').count()) === 15, `${vp.nm}: 15 pagina's`);
    ok((await p.inputValue('#bkBaan')) === '63' && (await p.textContent('#bkGo')).includes('18'), `${vp.nm}: baan 63 op pagina 18`);
    const ok1 = await p.evaluate(() => new Promise(r => { const i = document.querySelector('#bkCrop img'); if (i.complete) r(i.naturalWidth); else i.onload = () => r(i.naturalWidth); }));
    ok(ok1 > 2000, `${vp.nm}: uitsnede laadt (${ok1}px)`);
    const cb = await p.locator('.bk-crop').boundingBox(); ok(cb.height > 100 && cb.width > 150, `${vp.nm}: uitsnede zichtbaar ${Math.round(cb.width)}×${Math.round(cb.height)}`);
    await p.fill('#bkBaan', '3'); await p.dispatchEvent('#bkBaan', 'change'); ok((await p.textContent('#bkGo')).includes('16'), `${vp.nm}: up/down baan 3 op pagina 16`);
    await p.fill('#bkBaan', '40'); await p.dispatchEvent('#bkBaan', 'change'); ok((await p.textContent('#bkCrop')).includes('niet in het banenboekje'), `${vp.nm}: onbekende baan gemeld`);
    await p.click('#bkNav button[data-p="25"]'); await p.waitForTimeout(800);
    const y = await p.evaluate(() => document.getElementById('bkp25').getBoundingClientRect().top); ok(Math.abs(y) < 60, `${vp.nm}: naar pagina 25 gescrold (${Math.round(y)})`);
    const pdf = await p.getAttribute('#bkPdf', 'href'); const r = await p.request.get(new globalThis.URL(pdf, URL).href); ok(r.ok() && (await r.body()).length === 2912371, `${vp.nm}: originele PDF bereikbaar`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${vp.nm}: geen horizontale scroll`);
    await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: path.join(process.env.SHOT || '/tmp', `boekje-${vp.nm}.png`) });
    ok(errs.length === 0, `${vp.nm}: geen JS-fouten ${errs.join('; ')}`);
    await p.close();
  }
  await b.close(); console.log(fails ? `${fails} FOUT` : 'ALLES OK'); process.exit(fails ? 1 : 0);
})();
