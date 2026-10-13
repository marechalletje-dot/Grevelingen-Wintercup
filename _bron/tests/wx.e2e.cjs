// End-to-end test: windverwachting (Open-Meteo nagebootst), gemiddelde, racesimulatie en proefvaart met verwachte wind.
const { chromium, devices } = require('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [nm, opt] of [['desktop', { viewport: { width: 1300, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opt); await ctx.route(/service\.pdok|fonts\./, r => r.abort());
    let asked = null, fieldAsked = false;
    await ctx.route(/api\.open-meteo\.com/, r => {
      asked = r.request().url(); const u = new URL(asked); const d = u.searchParams.get('start_date');
      const time = [...Array(24).keys()].map(h => `${d}T${String(h).padStart(2, '0')}:00`);
      const one = { hourly: { time, wind_speed_10m: time.map((_, h) => h < 13 ? 16 : 12), wind_direction_10m: time.map(() => 290), wind_gusts_10m: time.map(() => 24) } };
      const n = u.searchParams.get('latitude').split(',').length; if (n > 1) fieldAsked = true;
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(n > 1 ? Array(n).fill(one) : one) });
    });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.waitForTimeout(300);
    ok((await p.locator('#wxDay option').count()) >= 4, `${nm}: dagkeuze`);
    await p.evaluate(() => { document.getElementById('rWx').open = true; }); await p.click('#wxGet'); await p.waitForTimeout(500);
    ok(fieldAsked, `${nm}: windveld meegehaald`);
    ok(asked && /models=(knmi_seamless|ecmwf_ifs025)/.test(asked) && /wind_speed_unit=kn/.test(asked), `${nm}: API-aanvraag met model en knopen`);
    ok(await p.isVisible('#wxOut') && (await p.locator('#wxBody tr').count()) === 9, `${nm}: uurtabel 09–17 (${await p.locator('#wxBody tr').count()})`);
    ok((await p.locator('#wxBody tr.race').count()) >= 2, `${nm}: race-uren gemarkeerd`);
    ok(/290°/.test(await p.textContent('#wxAvg')), `${nm}: gemiddelde 290° (${(await p.textContent('#wxAvg')).trim()})`);
    await p.click('#wxUse'); await p.waitForTimeout(300);
    ok(await p.inputValue('#twdIn') === '290', `${nm}: wind toegepast (${await p.inputValue('#twdIn')}° ${await p.inputValue('#twsIn')} kn)`);
    const tws = +(await p.inputValue('#twsIn')); ok(tws >= 12 && tws <= 16, `${nm}: snelheid tussen 12 en 16`);
    await p.click('#wxSim'); await p.waitForTimeout(300);
    const n = await p.locator('#wxSimBody tr').count(); const legs = await p.locator('#lpBody tr').count();
    ok(n > 3 && /finish \d\d:\d\d/.test(await p.textContent('#wxSimHead')), `${nm}: simulatie ${n} rakken, ${(await p.textContent('#wxSimHead')).trim()}`);
    await p.reload(); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.waitForTimeout(300);
    ok(await p.isVisible('#wxOut'), `${nm}: verwachting bewaard na herladen`);
    // proefvaart met verwachte wind
    await p.click('#tbRace'); await p.waitForTimeout(400); await p.selectOption('#gDemoSpd', '60'); await p.click('#gDemo'); await p.waitForTimeout(2500);
    ok(/verwachte wind 290°/.test(await p.textContent('#gMsg')), `${nm}: proefvaart met verwachte wind (${(await p.textContent('#gMsg')).trim().slice(0, 70)})`);
    await p.click('#gDemo'); await p.waitForTimeout(200);
    ok(errs.length === 0, `${nm}: geen JS-fouten ${errs.join(';')}`); await ctx.close();
  }
  await b.close(); console.log(fails ? `${fails} FOUT(EN)` : 'alles ok'); process.exit(fails ? 1 : 0);
})();
