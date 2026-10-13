// End-to-end test: in Race de bovenboei verslepen met live afstand loodrecht op de startlijn, koers en laylines uit de polar.
const { chromium, devices } = require('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [nm, opt] of [['desktop', { viewport: { width: 1300, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opt); await ctx.route(/service\.pdok|fonts\.|open-meteo/, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.waitForTimeout(300);
    ok(!(await p.isVisible('#gdBtn')), `${nm}: knop boei niet in Race preparation`);
    await p.click('#tbRace'); await p.waitForTimeout(500);
    await p.evaluate(() => { const s = document.getElementById('spiPop'); if (s) s.hidden = true; });
    ok(await p.locator('line.layl.sb').count() >= 1 && await p.locator('line.layl.bb').count() >= 1 && await p.isVisible('line.layl.sb'), `${nm}: laylines SB/BB getekend`);
    ok(!(await p.isVisible('#gdInfo')), `${nm}: maten verborgen zolang boei uit`);
    await p.click('#gdBtn'); await p.waitForTimeout(300);
    ok(await p.isVisible('#gdInfo') && await p.isVisible('.sgh[data-k="gate"]'), `${nm}: boei-modus: maten en sleepcirkel zichtbaar`);
    const t0 = await p.textContent('#gdInfo');
    ok(/\d\.\d\d nm/.test(t0) && /koers \d{3}°M/.test(t0) && /SB \d{3}°M/.test(t0) && /BB \d{3}°M/.test(t0), `${nm}: ${t0.replace(/\s+/g, ' ').trim()}`);
    const nm0 = +/(\d\.\d\d) nm/.exec(t0)[1];
    const h = await p.locator('.sgh[data-k="gate"]').boundingBox(); const cx = h.x + h.width / 2, cy = h.y + h.height / 2;
    await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + 20, cy - 25, { steps: 4 });
    await p.waitForTimeout(150); const mid = await p.textContent('#gdInfo'); const drag = await p.evaluate(() => document.body.classList.contains('gddrag'));
    await p.mouse.move(cx + 40, cy - 50, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
    const t1 = await p.textContent('#gdInfo'); const nm1 = +/(\d\.\d\d) nm/.exec(t1)[1];
    ok(drag && mid !== t0, `${nm}: maten veranderen tijdens het slepen`);
    ok(Math.abs(nm1 - nm0) > 0.02, `${nm}: afstand veranderd ${nm0} → ${nm1} nm`);
    ok(await p.evaluate(() => { const a = window.__store.state.sgAdj; return Object.values(a).some(x => x && x.g); }), `${nm}: nieuwe boeipositie bewaard`);
    // start-cirkel blijft niet sleepbaar in race
    ok(!(await p.isVisible('.sgh[data-k="start"]')), `${nm}: startcirkel niet sleepbaar in Race`);
    await p.click('#gdBtn'); await p.waitForTimeout(200); ok(!(await p.isVisible('#gdInfo')), `${nm}: boei-modus uit`);
    ok(errs.length === 0, `${nm}: geen JS-fouten ${errs.join(';')}`);
    await ctx.close();
  }
  await b.close(); console.log(fails ? fails + ' FOUT(EN)' : 'alles ok'); process.exit(fails ? 1 : 0);
})();
