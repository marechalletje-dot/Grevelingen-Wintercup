// End-to-end test: tabnamen, Post Race Analyses met een GPX-track langs de baan en nagebootste actuele wind (Open-Meteo).
const { chromium, devices } = require('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [nm, opt] of [['desktop', { viewport: { width: 1300, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opt); await ctx.route(/service\.pdok|fonts\./, r => r.abort());
    let hist = 0;
    await ctx.route(/open-meteo\.com/, r => {
      const u = new URL(r.request().url()); if (u.host.startsWith('historical')) hist++;
      const d = u.searchParams.get('start_date'); const time = [...Array(24).keys()].map(h => `${d}T${String(h).padStart(2, '0')}:00`);
      const one = { hourly: { time, wind_speed_10m: time.map(() => 12), wind_direction_10m: time.map(() => 250), wind_gusts_10m: time.map(() => 18) } };
      const n = u.searchParams.get('latitude').split(',').length;
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(n > 1 ? Array(n).fill(one) : one) });
    });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(BASE); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.waitForTimeout(300);
    const tabs = await p.$$eval('nav.tabs button', bs => bs.map(b => b.textContent.trim()));
    ok(tabs[0] === 'Race preparation' && tabs[1] === 'Race' && tabs[2] === 'Post Race Analyses', `${nm}: tabs ${tabs.slice(0, 3).join(' | ')}`);
    // GPX langs de baan: 5,5 kn, start 11:00 op 11 okt 2026 (lokale tijd)
    const gpx = await p.evaluate(() => {
      const legs = window.__course(); const pts = legs.flatMap((l, i) => (i ? l.slice(1) : l));
      const R = Math.PI / 180, dist = (a, b) => Math.hypot((b[1] - a[1]) * Math.cos(a[0] * R) * 60, (b[0] - a[0]) * 60);
      let t = new Date(2026, 9, 11, 11, 0, 0).getTime() - 120e3; const out = [];
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b2 = pts[i]; const d = dist(a, b2); const n = Math.max(1, Math.round(d / 5.5 * 3600 / 10));
        for (let k = 0; k < n; k++) { const f = k / n; out.push([a[0] + (b2[0] - a[0]) * f, a[1] + (b2[1] - a[1]) * f, t]); t += d / 5.5 * 3600e3 / n; } }
      out.push([...pts[pts.length - 1], t]);
      return '<gpx><trk><trkseg>' + out.map(([la, lo, tt]) => `<trkpt lat="${la.toFixed(6)}" lon="${lo.toFixed(6)}"><time>${new Date(tt).toISOString()}</time></trkpt>`).join('') + '</trkseg></trk></gpx>';
    });
    await p.click('#tbAnalyse'); await p.waitForTimeout(300);
    ok(await p.isVisible('#tabAnalyse') && !(await p.isVisible('#tabKaart')), `${nm}: tab Post Race Analyses zichtbaar`);
    await p.fill('#paStart', '11:00:00').catch(() => {}); 
    await p.setInputFiles('#paFile', { name: 'race.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx) }); await p.waitForTimeout(1200);
    ok(await p.inputValue('#paDay') === '2026-10-11', `${nm}: racedag uit de track (${await p.inputValue('#paDay')})`);
    await p.evaluate(() => { const s = document.getElementById('paStart'); s.value = '11:00:00'; s.dispatchEvent(new Event('change')); }); await p.waitForTimeout(800);
    ok(hist > 0, `${nm}: actuele wind via historical-forecast API`);
    ok(await p.isVisible('#paOut'), `${nm}: analyse getoond`);
    const legs = await p.locator('#paLegs tr').count(); const lp = await p.locator('#lpBody tr:not(.subrow)').count();
    ok(legs === lp, `${nm}: ${legs} rakken (baan heeft ${lp})`);
    const sum = await p.textContent('#paSum'); ok(/Zeiltijd werkelijk\d:\d\d:\d\d/.test(sum) && /\d+%/.test(sum), `${nm}: samenvatting (${sum.replace(/\s+/g, ' ').slice(0, 120)})`);
    const miss = await p.textContent('#paMsg'); ok(!/niet duidelijk gerond/.test(miss), `${nm}: alle merktekens gerond ${miss}`);
    ok(await p.locator('#paMap polyline.pa-trk').count() > 0 && await p.locator('#paChSpd path.ln').count() === 2, `${nm}: kaart en grafieken`);
    // track opgeslagen en na herladen terug
    await p.reload(); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.waitForTimeout(800);
    ok(await p.isVisible('#tabAnalyse') && /✓ Track/.test(await p.textContent('#paTrk')), `${nm}: track bewaard na herladen`);
    ok(await p.inputValue('#paMmsi') === '244001631', `${nm}: MMSI Dream Machine ingevuld`);
    ok(errs.length === 0, `${nm}: geen JS-fouten ${errs.join(';')}`);
    await p.screenshot({ path: `/tmp/pa_${nm}.png`, fullPage: true });
    await ctx.close();
  }
  await b.close(); console.log(fails ? fails + ' FOUT(EN)' : 'alles ok'); process.exit(fails ? 1 : 0);
})();
