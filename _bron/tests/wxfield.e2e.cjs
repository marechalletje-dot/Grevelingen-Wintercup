// End-to-end test: windveld op de kaart (Open-Meteo nagebootst met een raster), tijdschuif, pijlen, stroming, simulatie met windveld.
const { chromium, devices } = require('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [nm, opt] of [['desktop', { viewport: { width: 1300, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opt); await ctx.route(/service\.pdok|fonts\./, r => r.abort());
    let nField = 0;
    await ctx.route(/api\.open-meteo\.com/, r => {
      const u = new URL(r.request().url()); const d = u.searchParams.get('start_date');
      const lats = u.searchParams.get('latitude').split(','), lons = u.searchParams.get('longitude').split(',').map(Number);
      const time = [...Array(24).keys()].map(h => `${d}T${String(h).padStart(2, '0')}:00`);
      const mk = lon => ({ hourly: { time, wind_speed_10m: time.map(() => 10 + (lon - 3.80) / 0.32 * 10), wind_direction_10m: time.map((_, h) => h <= 10 ? 250 : h >= 15 ? 300 : 250 + (h - 10) * 10), wind_gusts_10m: time.map(() => 25) } });
      if (lats.length > 1) nField++;
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(lats.length > 1 ? lons.map(mk) : mk(3.92)) });
    });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.waitForTimeout(300);
    await p.click('#wfBtn'); await p.waitForTimeout(200);
    ok(await p.isVisible('#wfBar') && await p.isVisible('#wfGet') && !(await p.isVisible('#wfCtl')), `${nm}: windveld-balk met ophaalknop`);
    await p.click('#wfGet'); await p.waitForTimeout(900);
    ok(nField === 1 && await p.isVisible('#wfCtl'), `${nm}: windveld opgehaald (${nField})`);
    const href = await p.getAttribute('#wfImg', 'href'); ok(/^data:image\/png/.test(href || ''), `${nm}: kleurlaag`);
    const nA = await p.locator('#wfArr .wfa').count(); ok(nA > 15, `${nm}: ${nA} windpijlen op het water`);
    const setT = async m => p.evaluate(v => { const r = document.getElementById('wfRange'); r.value = String(v); r.dispatchEvent(new Event('input')); }, m);
    await setT(600); await p.waitForTimeout(150);
    const a10 = await p.getAttribute('#wfArr .wfa', 'data-a'); const t10 = await p.textContent('#wfTime');
    await setT(900); await p.waitForTimeout(150);
    const a15 = await p.getAttribute('#wfArr .wfa', 'data-a');
    ok(Math.round(+a10) === 70 && Math.round(+a15) === 120 && t10 === '10:00', `${nm}: pijlen draaien met de tijd (${a10}° → ${a15}°, ${t10})`);
    const nums = await p.$$eval('#wfArr .wfn text', es => es.map(e => +e.textContent)); ok(Math.min(...nums) >= 10 && Math.max(...nums) <= 20 && Math.max(...nums) - Math.min(...nums) >= 5, `${nm}: snelheden west→oost ${Math.min(...nums)}–${Math.max(...nums)} kn`);
    await p.waitForTimeout(800);
    const lit = await p.evaluate(() => { const c = document.getElementById('wfCv'); if (c.hidden || !c.width) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 20) n++; return n; });
    ok(lit > 50, `${nm}: stroming zichtbaar (${lit} px)`);
    await p.click('#wfPart'); await p.waitForTimeout(150); ok(await p.isHidden('#wfCv'), `${nm}: stroming uit`); await p.click('#wfPart');
    await p.click('#wfPlay'); await p.waitForTimeout(1000); const tp = await p.textContent('#wfTime'); await p.click('#wfPlay');
    ok(tp !== '15:00', `${nm}: afspelen (${tp})`);
    // simulatie gebruikt het windveld
    await p.evaluate(() => { document.getElementById('rWx').open = true; }); await p.click('#wxSim'); await p.waitForTimeout(300);
    ok(/windveld/.test(await p.textContent('#wxSimHead')), `${nm}: simulatie met windveld (${(await p.textContent('#wxSimHead')).trim()})`);
    // bewaard na herladen, ook in racemodus / alleen kaart
    await p.reload(); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.waitForTimeout(400);
    ok(await p.isVisible('#wfBar') && (await p.locator('#wfArr .wfa').count()) === nA, `${nm}: windveld bewaard na herladen`);
    await p.click('#tbRace'); await p.waitForTimeout(300); await p.click('#mapOnly'); await p.waitForTimeout(300);
    ok(await p.isVisible('#wfBtn') && await p.isVisible('#wfBar'), `${nm}: windveld in alleen-kaart`);
    const bar = await p.locator('#wfBar').boundingBox(), wi = await p.locator('#windInd').boundingBox();
    ok(bar.x + bar.width <= wi.x + 2 || wi.y + wi.height <= bar.y + 2, `${nm}: balk niet over de windpijl (${[bar.x,bar.y,bar.width,bar.height].map(Math.round)} · ${[wi.x,wi.y,wi.width,wi.height].map(Math.round)})`);
    await p.click('#mapOnly'); await p.waitForTimeout(200);
    await p.click('#wfX'); await p.waitForTimeout(150); ok(await p.isHidden('#wfBar') && await p.isHidden('#wfCv'), `${nm}: windveld uit`);
    ok(errs.length === 0, `${nm}: geen JS-fouten ${errs.join(';')}`); await ctx.close();
  }
  await b.close(); console.log(fails ? `${fails} FOUT(EN)` : 'alles ok'); process.exit(fails ? 1 : 0);
})();
