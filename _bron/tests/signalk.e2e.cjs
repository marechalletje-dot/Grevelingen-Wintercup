// End-to-end test v52: zeilkolom, zeilen aan boord, Signal K-koppeling (live instrumenten, opname, GPS van de boot) en zeilknoppen.
// Vereist een draaiende Signal K-server met voorbeelddata, bv.: signalk-server --sample-nmea0183-data
// Gebruik: node tests/signalk.e2e.cjs http://localhost:8768/ localhost:3000
const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8768/', SKA = process.argv[3] || 'localhost:3000';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [nm, opt] of [['desktop', { viewport: { width: 1400, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext({ ...opt, geolocation: { latitude: 51.7634, longitude: 3.876, accuracy: 5 }, permissions: ['geolocation'] });
    await ctx.route(/service\.pdok|fonts\.|open-meteo/, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForSelector('#lpBody tr');
    // zeilkolom in het rakkenpaneel
    const pills = await p.$$eval('#lpBody tr:not(.subrow) td.sl .spill', a => a.map(x => x.textContent));
    ok(pills.length >= 3 && pills.every(t => /^(J3 M\/H|J4|S2)\??$/.test(t)), `${nm}: zeiladvies per rak: ${pills.join(', ')}`);
    // zeilen aan boord: J3 L/M erbij
    if (nm === 'desktop') {
      await p.click('#sailChips button[data-s="J3LM"]');
      ok(JSON.stringify(await p.evaluate(() => __store.state.sailsAboard)) === '["J3LM","J3MH","J4","S2"]', `${nm}: J3 L/M aan boord gezet`);
      await p.click('#sailChips button[data-s="J3LM"]');
      ok(!(await p.evaluate(() => __store.state.sailsAboard)).includes('J3LM'), `${nm}: J3 L/M weer van boord`);
    }
    // Race + Signal K
    await p.evaluate(a => { __store.S.skAddr = a; }, SKA);
    await p.click('#tbRace'); await p.waitForTimeout(500);
    ok(await p.isVisible('#sailBar'), `${nm}: zeilbalk zichtbaar in Race`);
    await p.evaluate(() => { document.getElementById('skBox').open = true; document.getElementById('spiPop').hidden = true; });
    await p.click('#skConn');
    await p.waitForSelector('#gIns:not([hidden])', { timeout: 15000 }).catch(() => {});
    ok(await p.isVisible('#gIns'), `${nm}: instrumentregel zichtbaar`);
    const tws = await p.innerText('#iTws'), stw = await p.innerText('#iStw'), twa = await p.innerText('#iTwa');
    ok(/^\d+\.\d$/.test(tws) && /^\d+\.\d$/.test(stw) && /^\d+$/.test(twa), `${nm}: TWS ${tws} kn, TWA ${twa}°, STW ${stw} kn`);
    ok((await p.getAttribute('#skDot', 'class')).includes('ok'), `${nm}: statusbolletje groen`);
    ok(/\d/.test(await p.innerText('#iPf')), `${nm}: prestatie t.o.v. polar: ${await p.innerText('#iPf')}%`);
    ok(/advies: /.test(await p.innerText('#sailAdv')) && /gemeten wind/.test(await p.innerText('#sailAdv')), `${nm}: zeiladvies met gemeten wind: ${await p.innerText('#sailAdv')}`);
    // zeil vastleggen
    await p.click('#sailBtns button[data-s="S2"]');
    ok(await p.getAttribute('#sailBtns button[data-s="S2"]', 'aria-pressed') === 'true', `${nm}: S2 actief na tik`);
    const log = await p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.startsWith('wc_sails_')); return k && JSON.parse(localStorage.getItem(k)); });
    ok(log && log.length && log[log.length - 1].s === 'S2', `${nm}: zeilwissel opgeslagen (${log && log.length})`);
    // opname instrumentdata
    await p.waitForTimeout(11500);
    const rows = await p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.startsWith('wc_ins_')); return k ? JSON.parse(localStorage.getItem(k)).rows : []; });
    ok(rows.length >= 8 && rows[rows.length - 1][1] != null && rows[rows.length - 1][3] != null, `${nm}: instrumentdata opgenomen (${rows.length} rijen, laatste ${JSON.stringify(rows[rows.length - 1])})`);
    // gemeten wind overnemen
    const twd0 = await p.inputValue('#twdIn');
    await p.click('#skWind'); const msg = await p.innerText('#skMsg');
    ok(/overgenomen/.test(msg), `${nm}: ${msg} (TWD was ${twd0}, nu ${await p.inputValue('#twdIn')})`);
    // GPS van de boot
    await p.check('#skGps'); await p.waitForTimeout(300);
    await p.click('#gStop').catch(() => {}); await p.waitForTimeout(300);
    await p.click('#tbRace'); await p.waitForTimeout(3500);
    const pos = await p.innerText('#gPos');
    ok(/°/.test(pos) && /N/.test(pos), `${nm}: positie van de boot: ${pos}`);
    ok(/buiten de Grevelingen/.test(await p.innerText('#gMsg')), `${nm}: voorbeelddata ligt buiten de Grevelingen (verwacht)`);
    ok(!errs.length, `${nm}: geen scriptfouten ${errs.join(' | ')}`);
    if (nm === 'iphone') await p.screenshot({ path: process.env.SHOT || '/tmp/sk_iphone.png' });
    await ctx.close();
  }
  // https-pagina met ws://: duidelijke melding (alleen de functie, geen echte https-server nodig)
  await b.close(); console.log(fails ? `${fails} FOUT(EN)` : 'alles ok'); process.exit(fails ? 1 : 0);
})();
