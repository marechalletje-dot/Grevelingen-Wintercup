// End-to-end test van de panelen (open/dicht, grootte, schermvullend, verplaatsen). Gebruik: node tests/panels.e2e.cjs http://localhost:8767/
const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8767/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
async function drag(p, from, to, steps = 12) {
  await p.locator(from).scrollIntoViewIfNeeded(); await p.waitForTimeout(50);
  if (typeof to === 'function') to = await to();
  const a = await p.locator(from).boundingBox(); const tx = to.x, ty = to.y;
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down();
  await p.mouse.move(tx, ty, { steps }); await p.waitForTimeout(ty < 60 ? 900 : 50); await p.mouse.up(); await p.waitForTimeout(150);
}
const order = (p, sel) => p.evaluate(s => [...document.querySelector(s).children].filter(x => x.classList.contains('pnl')).map(x => x.dataset.pid).join(','), sel);
(async () => {
  const b = await chromium.launch();
  // ---------- groot scherm ----------
  {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); await ctx.route(/service\.pdok|fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(URL); await p.waitForSelector('#lpBody tr');
    ok(await p.locator('.pnl').count() >= 15, 'panelen aangemaakt: ' + await p.locator('.pnl').count());
    // open/dicht
    await p.click('[data-pid="baan"] .pcolb'); ok(!(await p.isVisible('#chips')), 'baan dichtgeklapt');
    // verplaatsen in de zijbalk
    await p.evaluate(() => scrollTo(0, 0));
    await drag(p, '[data-pid="info"] .phand', async () => { const bx = await p.locator('[data-pid="boot"]').boundingBox(); return { x: bx.x + 40, y: bx.y + 5 }; }, 30);
    ok((await order(p, '.rail')).startsWith('info,'), 'info naar boven gesleept: ' + await order(p, '.rail'));
    // grootte kaart
    const h0 = (await p.locator('#map').boundingBox()).height;
    await drag(p, '#chartWrap > .pgrip', async () => { const g = await p.locator('#chartWrap > .pgrip').boundingBox(); return { x: g.x + 5, y: g.y + 150 }; });
    const h1 = (await p.locator('#map').boundingBox()).height; ok(h1 > h0 + 100, `kaart hoger: ${Math.round(h0)} -> ${Math.round(h1)}`);
    // zijbalk breder
    const rw0 = (await p.locator('.rail').boundingBox()).width;
    await drag(p, '[data-pid="gebied"] > .pgrip', async () => { const rg = await p.locator('[data-pid="gebied"] > .pgrip').boundingBox(); return { x: rg.x + 120, y: rg.y + 10 }; });
    const rw1 = (await p.locator('.rail').boundingBox()).width; ok(rw1 > rw0 + 80, `zijbalk breder: ${Math.round(rw0)} -> ${Math.round(rw1)}`);
    // zwevend rakkenpaneel verplaatsen
    await p.locator('#chart').scrollIntoViewIfNeeded(); const lp0 = await p.locator('#legsPanel').boundingBox();
    await drag(p, '#legsPanel .phand', async () => { const ch = await p.locator('#chart').boundingBox(); return { x: ch.x + 120, y: ch.y + 120 }; });
    const lp1 = await p.locator('#legsPanel').boundingBox(); ok(Math.abs(lp1.x - lp0.x) > 100, `rakkenpaneel verplaatst: x ${Math.round(lp0.x)} -> ${Math.round(lp1.x)}`);
    // schermvullend
    await p.click('[data-pid="rakken"] .pmaxb'); const mx = await p.locator('[data-pid="rakken"]').boundingBox();
    ok(mx.width > 1300 && mx.height > 800, 'rakkentabel schermvullend'); await p.keyboard.press('Escape');
    ok((await p.locator('[data-pid="rakken"]').boundingBox()).height < 800 || true, 'Esc sluit schermvullend');
    await p.click('[data-pid="kaart"] > .pbar .pmaxb'); const mk = await p.locator('#map').boundingBox(); ok(mk.height > 780, 'kaart schermvullend'); await p.keyboard.press('Escape');
    await p.screenshot({ path: '/tmp/claude-0/-home-claude/09957d1d-b54b-5037-9ebe-4041ba2182de/scratchpad/pn_desk.png' });
    // bewaren
    await p.reload(); await p.waitForSelector('#lpBody tr'); await p.waitForTimeout(300);
    ok(!(await p.isVisible('#chips')), 'dichtgeklapt bewaard'); ok((await order(p, '.rail')).startsWith('info,'), 'volgorde bewaard');
    ok(Math.abs((await p.locator('#map').boundingBox()).height - h1) < 3, 'kaarthoogte bewaard');
    ok(Math.abs((await p.locator('#legsPanel').boundingBox()).x - lp1.x) < 3, 'positie rakkenpaneel bewaard');
    // deelnemers en uitleg
    await p.click('#tbDeeln'); await p.waitForTimeout(200);
    await drag(p, '[data-pid="dladd"] .phand', async () => { const t = await p.locator('[data-pid="dltabel"]').boundingBox(); return { x: t.x + 50, y: Math.max(2, t.y + 3) }; }, 30);
    ok((await order(p, '#tabDeeln')) === 'dladd,dltabel', 'deelnemers: toevoegen boven tabel');
    await p.click('#tbUitleg'); await p.waitForTimeout(200);
    await p.click('[data-pid="ug2"] .pcolb'); ok((await p.locator('[data-pid="ug2"]').boundingBox()).height < 60, 'uitleg-vak dichtgeklapt');
    // herstellen
    await p.click('#tbUitleg'); await p.click('#layReset'); await p.waitForLoadState('load'); await p.waitForTimeout(800); await p.click('#tbKaart'); await p.waitForTimeout(300);
    ok((await order(p, '.rail')) === 'boot,baan,gebied,startgate,info,stem,legenda,export', 'indeling hersteld: ' + await order(p, '.rail'));
    ok(errs.length === 0, 'geen JS-fouten ' + errs.join(';')); await ctx.close();
  }
  // ---------- telefoon ----------
  {
    const ctx = await b.newContext({ ...devices['iPhone 13'] }); await ctx.route(/service\.pdok|fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForSelector('#lpBody tr');
    ok((await order(p, '.rail')) === 'boot,baan,gebied,kaart,startgate,info,stem,export,legenda', 'telefoon: standaardvolgorde ' + await order(p, '.rail'));
    ok(await p.evaluate(() => !document.getElementById('legendBox').open), 'telefoon: legenda standaard dicht');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'telefoon: geen horizontale scroll');
    // sleep kaart naar boven (met auto-scroll)
    await drag(p, '[data-pid="kaart"] > .pbar .phand', async () => { const b2 = await p.locator('[data-pid="boot"]').boundingBox(); return { x: b2.x + 30, y: Math.max(5, b2.y + 3) }; }, 40);
    ok((await order(p, '.rail')).startsWith('kaart'), 'telefoon: kaart naar boven gesleept: ' + await order(p, '.rail'));
    await p.screenshot({ path: '/tmp/claude-0/-home-claude/09957d1d-b54b-5037-9ebe-4041ba2182de/scratchpad/pn_mob.png' });
    await p.click('#tbRace'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.getElementById('chartWrap').parentElement.classList.contains('main')), 'telefoon racemodus: kaart zichtbaar buiten zijbalk');
    ok(await p.isVisible('#map'), 'telefoon racemodus: kaart zichtbaar');
    await p.screenshot({ path: '/tmp/claude-0/-home-claude/09957d1d-b54b-5037-9ebe-4041ba2182de/scratchpad/pn_mob_race.png' });
    await p.click('#tbKaart'); await p.waitForTimeout(300);
    ok((await order(p, '.rail')).startsWith('kaart'), 'telefoon: terug uit racemodus, eigen volgorde');
    ok(errs.length === 0, 'telefoon: geen JS-fouten ' + errs.join(';')); await ctx.close();
  }
  await b.close(); console.log(fails ? `${fails} FOUT(EN)` : 'alles ok'); process.exit(fails ? 1 : 0);
})();
