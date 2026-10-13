// End-to-end test: kortste weg. Baan 64 rak 9 (G38/GB1 → G 57) langs de groene boeien van Geul van Bommenede / Rede Brouwershaven.
const { chromium } = require('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }); await ctx.route(/service\.pdok|fonts\.|open-meteo/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForSelector('#lpBody tr', { state: 'attached' });
  await p.evaluate(() => { window.__store.set({ allC: true, twd: 270 }); const b = document.getElementById('c64'); b.disabled = false; b.click(); }); await p.waitForTimeout(400);
  const L = await p.evaluate(() => window.__legs()); const l = L.find(x => /G38/.test(x.f) && /G 57/.test(x.t));
  ok(!!l, 'rak G38/GB1 → G 57 gevonden');
  if (l) {
    ok(!l.wp.includes('GB 11-RB 2'), 'niet meer via GB 11-RB 2: ' + l.wp.join(' → '));
    ok(l.wp.includes('GB 7') || l.wp.includes('GB 9'), 'langs de groene boeien van de Geul van Bommenede');
    ok(l.short > 0.03, `korter dan de oude route (−${l.short} nm, nu ${l.nm} nm)`);
  }
  // nooit langer dan de oorspronkelijke route, voor alle banen
  const ids = await p.evaluate(() => [...document.querySelectorAll('#chips button')].map(x => x.id)); let neg = 0, n = 0;
  for (const id of ids) { await p.evaluate(id => { const b = document.getElementById(id); b.disabled = false; b.click(); }, id); await p.waitForTimeout(60);
    const S = await p.evaluate(() => window.__legs().map(x => x.short || 0)); S.forEach(v => { if (v < 0) neg++; if (v > 0) n++; }); }
  ok(neg === 0, `${n} rakken ingekort in ${ids.length} banen, geen enkel rak langer`);
  ok(errs.length === 0, 'geen JS-fouten ' + errs.join(';'));
  await b.close(); console.log(fails ? fails + ' FOUT(EN)' : 'alles ok'); process.exit(fails ? 1 : 0);
})();
