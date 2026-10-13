// End-to-end test: passeermerken (alleen aan een kant laten liggen) → rechte lijn naar het volgende rondingsmerk.
const { chromium } = require('playwright');
const BASE = process.argv[2]; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }); await ctx.route(/service\.pdok|fonts\.|open-meteo/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForSelector('#lpBody tr', { state: 'attached' });
  await p.evaluate(() => { window.__store.set({ allC: true, twd: 270, area: 'B' }); document.getElementById('c54').click(); }); await p.waitForTimeout(300);
  ok((await p.evaluate(() => window.__pass())).includes('SP 40'), 'baan 54: SP 40 is passeermerk');
  const row = await p.locator('#lpBody tr[data-i="1"]:not(.subrow)').innerText(); ok(/HG 1/.test(row) && !/SP 40/.test(row.split('\n')[1] || ''), 'rak 2 loopt direct naar HG 1 (SP 40 samengevoegd): ' + row.replace(/\s+/g, ' '));
  const sub = await p.locator('#lpBody tr.subrow[data-p="1"]').allInnerTexts(); ok(sub.some(t => /SP 40 \(pass\. SB\)/.test(t)), 'deelrak: langs SP 40 (pass. SB)');
  ok(await p.evaluate(() => !!document.querySelector('.rbadge.pass')), 'SP 40 op de kaart met label pass. SB');
  const n54 = await p.locator('#lpBody tr:not(.subrow)').count(); ok(n54 === 9, `baan 54: 9 rakken (was 10) → ${n54}`);
  // baan 64: gate → SP 40 → HG 1 → G60/RB13 wordt één rak; laylines alleen bij rondingsmerk
  await p.evaluate(() => { document.getElementById('c64').click(); }); await p.waitForTimeout(300);
  const r64 = await p.locator('#lpBody tr[data-i="1"]:not(.subrow)').innerText(); ok(/G60\/RB13/.test(r64), 'baan 64: rak 2 naar G60/RB13: ' + r64.replace(/\s+/g, ' '));
  ok(errs.length === 0, 'geen JS-fouten ' + errs.join(';'));
  await b.close(); console.log(fails ? fails + ' FOUT(EN)' : 'alles ok'); process.exit(fails ? 1 : 0);
})();
