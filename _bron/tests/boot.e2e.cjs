// End-to-end test: tab Boot (boot kiezen, polar uploaden, sail chart bewerken/inlezen, zeilen aan boord, veiligheid). Gebruik: node tests/boot.e2e.cjs http://localhost:8790/ [chart.html]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const os = require('os');
const URL = process.argv[2], CHART = process.argv[3]; let fails = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FOUT ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wcb-'));
  const pol = path.join(tmp, 'polar.csv');
  fs.writeFileSync(pol, 'TWA\\TWS;6;10;14\n45;4,0;5,2;5,6\n60;4,6;6,0;6,4\n90;5,0;6,4;6,9\n120;5,0;6,6;7,4\n150;4,0;5,6;6,6\n180;3,2;4,8;6,0\n');
  for (const vp of [{ width: 1300, height: 900, nm: 'groot' }, { width: 390, height: 844, nm: 'telefoon' }]) {
    const p = await b.newPage({ viewport: vp }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(URL); await p.waitForSelector('#lpBody tr', { state: 'attached' });
    await p.evaluate(() => { ['wc_polarc', 'wc_sailchart', 'wc_sailimg', 'wc_safety', 'wc_sailsaboard', 'wc_boat'].forEach(k => localStorage.removeItem(k)); }); await p.reload(); await p.waitForSelector('#lpBody tr', { state: 'attached' });
    const time0 = await p.textContent('#lpBody tr:nth-child(2) .tm');
    await p.click('#tbBoot'); await p.waitForTimeout(200);
    ok(await p.isVisible('#tabBoot') && !(await p.isVisible('#tabKaart')), `${vp.nm}: tab Boot zichtbaar`);
    ok((await p.locator('#btChips button').count()) === 9, `${vp.nm}: 9 zeilen in de chart`);
    ok((await p.locator('#btChips button[aria-pressed="true"]').count()) === 3, `${vp.nm}: standaard 3 aan boord`);
    ok((await p.locator('#btChart svg path').count()) > 9, `${vp.nm}: chart getekend`);
    ok((await p.locator('#btSafeList input').count()) === 12, `${vp.nm}: 12 veiligheidsitems`);
    ok((await p.locator('#btPolTab tbody tr').count()) === 12, `${vp.nm}: polar-tabel standaard (8 hoeken + 4)`);
    // zeil aan boord zetten → ook in Race preparation
    await p.click('#btChips button[data-s="C0"]'); ok((await p.locator('#btChips button[aria-pressed="true"]').count()) === 4, `${vp.nm}: Code 0 aan boord`);
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem('wc_sailsaboard')).includes('C0')), `${vp.nm}: keuze bewaard`);
    ok(await p.locator('#sailChips button[data-s="C0"][aria-pressed="true"]').count() === 1, `${vp.nm}: chip in Race preparation mee`);
    // chart bewerken
    await p.fill('#btSailBody tr[data-id="S2"] input[data-k="t1"]', '20'); await p.dispatchEvent('#btSailBody tr[data-id="S2"] input[data-k="t1"]', 'change');
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem('wc_sailchart')).dm.find(s => s.id === 'S2').tws[1] === 20), `${vp.nm}: bereik S2 aangepast en bewaard`);
    await p.fill('#btSailBody tr[data-id="S2"] input[data-k="name"]', ''); await p.dispatchEvent('#btSailBody tr[data-id="S2"] input[data-k="name"]', 'change');
    ok((await p.textContent('#btChartMsg')).includes('rood') && await p.locator('#btSailBody tr.bad').count() === 1, `${vp.nm}: lege naam geweigerd`);
    await p.fill('#btSailBody tr.bad input[data-k="name"]', 'S2'); await p.dispatchEvent('#btSailBody tr.bad input[data-k="name"]', 'change');
    await p.click('#btSailAdd'); ok((await p.locator('#btChips button').count()) === 10, `${vp.nm}: zeil toegevoegd`);
    await p.click('#btSailBody tr:last-child button.xdel'); ok((await p.locator('#btChips button').count()) === 9, `${vp.nm}: zeil verwijderd`);
    if (CHART) { await p.setInputFiles('#btChartFile', CHART); await p.waitForTimeout(200); ok((await p.textContent('#btChartMsg')).includes('ingelezen') && (await p.locator('#btChips button').count()) === 9, `${vp.nm}: crossover chart ingelezen`); }
    await p.click('#btChartReset'); await p.waitForTimeout(100); ok(!(await p.evaluate(() => JSON.parse(localStorage.getItem('wc_sailchart') || '{}').dm)), `${vp.nm}: standaardchart hersteld`);
    // polar uploaden → zeiltijd verandert
    await p.setInputFiles('#btPolFile', pol); await p.waitForTimeout(300);
    ok((await p.textContent('#btPolMsg')).includes('3 windsnelheden') && (await p.locator('#btPolTab thead th').count()) === 4, `${vp.nm}: polar ingelezen`);
    ok((await p.textContent('#btInfo')).includes('polar.csv'), `${vp.nm}: bootinfo toont eigen polar`);
    await p.click('#tbKaart'); await p.waitForTimeout(300); const time1 = await p.textContent('#lpBody tr:nth-child(2) .tm');
    ok(time1 !== time0, `${vp.nm}: zeiltijd volgt eigen polar (${time0} → ${time1})`);
    await p.click('#toBoot'); await p.waitForTimeout(100); ok(await p.isVisible('#tabBoot'), `${vp.nm}: link naar tab Boot`);
    await p.click('#btPolReset'); await p.waitForTimeout(200); ok((await p.locator('#btPolTab tbody tr').count()) === 12, `${vp.nm}: standaardpolar terug`);
    // veiligheid
    await p.check('#btSafeList input[data-sid="emmer"]'); await p.check('#btSafeList input[data-sid="vesten"]');
    await p.fill('#btSafeNew', 'EHBO-doos'); await p.click('#btSafeAdd');
    ok((await p.textContent('#btSafeProg')).includes('2 van 13'), `${vp.nm}: voortgang 2 van 13`);
    // boot wisselen
    const nOn = await p.locator('#btChips button[aria-pressed="true"]').count();
    await p.selectOption('#btSel', 'xp'); await p.waitForTimeout(200);
    ok((await p.inputValue('#boatSel')) === 'xp' && (await p.textContent('#btInfo')).includes('XP-33'), `${vp.nm}: boot gewisseld (ook Race preparation)`);
    ok((await p.textContent('#btSafeProg')).includes('0 van 12'), `${vp.nm}: veiligheid per boot`);
    ok((await p.locator('#btChips button').count()) === 0, `${vp.nm}: XP zonder chart`);
    await p.click('#btSailAdd'); ok((await p.locator('#btChips button').count()) === 1, `${vp.nm}: chart voor XP begonnen`);
    await p.selectOption('#btSel', 'dm'); await p.waitForTimeout(150);
    ok((await p.locator('#btChips button[aria-pressed="true"]').count()) === nOn, `${vp.nm}: keuze aan boord DM behouden na wissel (${nOn})`);
    await p.reload(); await p.waitForSelector('#lpBody tr', { state: 'attached' }); await p.waitForTimeout(300);
    ok(await p.isVisible('#tabBoot'), `${vp.nm}: tab onthouden`); ok((await p.textContent('#btSafeProg')).includes('2 van 13'), `${vp.nm}: vinkjes onthouden`);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); ok(sw, `${vp.nm}: geen horizontale scroll`);
    await p.screenshot({ path: path.join(process.env.SHOT || tmp, `boot-${vp.nm}.png`), fullPage: true });
    ok(errs.length === 0, `${vp.nm}: geen JS-fouten ${errs.join('; ')}`);
    await p.close();
  }
  await b.close(); console.log(fails ? `${fails} FOUT` : 'ALLES OK'); process.exit(fails ? 1 : 0);
})();
