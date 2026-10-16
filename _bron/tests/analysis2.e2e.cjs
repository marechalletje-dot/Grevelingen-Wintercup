// End-to-end test v52: Post Race Analyses met opgenomen boordinstrumenten (STW, gemeten wind) en zeilvoering.
const { chromium, devices } = require('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [nm, opt] of [['desktop', { viewport: { width: 1300, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opt); await ctx.route(/service\.pdok|fonts\./, r => r.abort());
    await ctx.route(/open-meteo\.com/, r => {
      const u = new URL(r.request().url()); const d = u.searchParams.get('start_date'); const time = [...Array(24).keys()].map(h => `${d}T${String(h).padStart(2, '0')}:00`);
      const one = { hourly: { time, wind_speed_10m: time.map(() => 12), wind_direction_10m: time.map(() => 250), wind_gusts_10m: time.map(() => 18) } };
      const n = u.searchParams.get('latitude').split(',').length;
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(n > 1 ? Array(n).fill(one) : one) });
    });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(BASE); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.waitForTimeout(300);
    // GPX langs de baan (5,5 kn, start 11:00 op 11 okt 2026) + instrumentdata + zeilwissels
    const gpx = await p.evaluate(() => {
      const legs = window.__course(); const pts = legs.flatMap((l, i) => (i ? l.slice(1) : l));
      const R = Math.PI / 180, dist = (a, b) => Math.hypot((b[1] - a[1]) * Math.cos(a[0] * R) * 60, (b[0] - a[0]) * 60);
      const T0 = new Date(2026, 9, 11, 11, 0, 0).getTime(); let t = T0 - 120e3; const out = []; const legEnd = [];
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b2 = pts[i]; const d = dist(a, b2); const n = Math.max(1, Math.round(d / 5.5 * 3600 / 10));
        for (let k = 0; k < n; k++) { const f = k / n; out.push([a[0] + (b2[0] - a[0]) * f, a[1] + (b2[1] - a[1]) * f, t]); t += d / 5.5 * 3600e3 / n; } legEnd.push(t); }
      out.push([...pts[pts.length - 1], t]);
      const rows = []; for (let s = T0 - 120e3; s <= t; s += 2000) rows.push([Math.round(s / 1000), 120, (s / 1000) % 600 < 300 ? 60 : -150, 520, null, 160, 40, 250]);
      localStorage.setItem('wc_ins_2026-10-11', JSON.stringify({ day: '2026-10-11', rows }));
      localStorage.setItem('wc_sails_2026-10-11', JSON.stringify([{ t: T0 - 300e3, s: 'J3MH' }, { t: T0 + 1800e3, s: 'S2' }, { t: T0 + 3000e3, s: 'J3MH' }]));
      return '<gpx><trk><trkseg>' + out.map(([la, lo, tt]) => `<trkpt lat="${la.toFixed(6)}" lon="${lo.toFixed(6)}"><time>${new Date(tt).toISOString()}</time></trkpt>`).join('') + '</trkseg></trk></gpx>';
    });
    await p.click('#tbAnalyse'); await p.waitForTimeout(300);
    await p.setInputFiles('#paFile', { name: 'race.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx) }); await p.waitForTimeout(1200);
    await p.evaluate(() => { const s = document.getElementById('paStart'); s.value = '11:00:00'; s.dispatchEvent(new Event('change')); }); await p.waitForTimeout(900);
    ok(/✓ Boordinstrumenten/.test(await p.textContent('#paInsInfo')) && /STW/.test(await p.textContent('#paInsInfo')), `${nm}: instrumentdata gevonden: ${await p.textContent('#paInsInfo')}`);
    const sum = (await p.textContent('#paSum')).replace(/\s+/g, ' ');
    ok(/Wind \(gemeten aan boord\)\s*12 kn/.test(sum), `${nm}: samenvatting met gemeten wind (${sum.slice(-80)})`);
    ok(await p.locator('#paChSpd path.ln').count() === 3 && await p.locator('#paChSpd path.c-stw').count() === 1, `${nm}: grafiek met SOG, STW en polar`);
    const srows = await p.$$eval('#paSails tr', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')));
    ok(srows.length === 2 && /J3 M\/H/.test(srows.join()) && /S2/.test(srows.join()), `${nm}: tabel per zeil: ${srows.join(' | ')}`);
    ok(srows.every(r => /\d+%/.test(r)), `${nm}: prestatie en bereik per zeil gevuld`);
    const legSails = await p.$$eval('#paLegs tr td:last-child', tds => tds.map(t => t.innerText.trim()));
    ok(legSails.some(x => /S2/.test(x)) && legSails.some(x => /J3/.test(x)), `${nm}: zeil per rak: ${legSails.join(' / ')}`);
    // kleur per zeil
    await p.selectOption('#paColor', 'sail'); await p.waitForTimeout(200);
    const strokes = await p.$$eval('#paMap polyline.pa-trk', a => [...new Set(a.map(x => x.getAttribute('stroke')))]);
    ok(strokes.includes('#008300') && strokes.includes('#2a78d6') && /S2/.test(await p.textContent('#paMapLeg')), `${nm}: track gekleurd per zeil (${strokes.join(',')})`);
    // wissels bewerken
    ok(await p.locator('#paSailLog .row').count() === 3, `${nm}: 3 zeilwissels in de lijst`);
    await p.click('#paSailAdd'); await p.waitForTimeout(500);
    ok(await p.locator('#paSailLog .row').count() === 4, `${nm}: wissel toegevoegd`);
    await p.locator('#paSailLog .row').last().locator('.x').click(); await p.waitForTimeout(500);
    ok(await p.locator('#paSailLog .row').count() === 3, `${nm}: wissel verwijderd`);
    await p.locator('#paSailLog .row').nth(1).locator('select').selectOption('J4'); await p.waitForTimeout(600);
    ok(/J4/.test(await p.textContent('#paSails')), `${nm}: zeil gewijzigd naar J4`);
    // alleen modelwind
    await p.selectOption('#paWsrc', 'model'); await p.waitForTimeout(800);
    ok(/Wind \(model, achteraf\)/.test(await p.textContent('#paSum')) && await p.locator('#paChSpd path.ln').count() === 2, `${nm}: terug naar modelwind en SOG`);
    ok(!errs.length, `${nm}: geen scriptfouten ${errs.join(' | ')}`);
    if (nm === 'desktop') { await p.selectOption('#paWsrc', 'auto'); await p.waitForTimeout(800); await p.locator('#paSailCard').screenshot({ path: process.env.SHOT || '/tmp/pa_sails.png' }); }
    await ctx.close();
  }
  await b.close(); console.log(fails ? fails + ' FOUT(EN)' : 'alles ok'); process.exit(fails ? 1 : 0);
})();
