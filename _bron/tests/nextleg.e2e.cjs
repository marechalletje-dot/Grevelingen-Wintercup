// End-to-end test: melding volgend rak (pop-up + stem), windpijl en 'alleen kaart'. Gebruik: node tests/nextleg.e2e.cjs http://localhost:8771/
const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8771/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [nm, opt] of [['desktop', { viewport: { width: 1400, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext({ ...opt, geolocation: { latitude: 51.7634, longitude: 3.876, accuracy: 5 }, permissions: ['geolocation'] });
    await ctx.route(/service\.pdok|fonts\./, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__said = []; if (window.speechSynthesis) { speechSynthesis.speak = u => window.__said.push(u.text); const vs = [{ name: 'Ellen', lang: 'nl-BE' }, { name: 'Xander', lang: 'nl-NL' }, { name: 'Claire', lang: 'nl-NL' }, { name: 'Samantha', lang: 'en-US' }]; speechSynthesis.getVoices = () => vs; } });
    await p.goto(URL); await p.waitForSelector('#lpBody tr');
    ok(await p.inputValue('#voiceSel') === 'Claire', `${nm}: Claire (nl-NL, vrouw) automatisch gekozen (${await p.inputValue('#voiceSel')})`);
    ok((await p.$$eval('#voiceSel option', o => o.map(x => x.value))).join() === 'Claire,Xander,Ellen', `${nm}: volgorde stemmen`);
    // windpijl
    ok(await p.isVisible('#windInd'), `${nm}: windpijl zichtbaar op banenkaart`);
    ok(await p.getAttribute('#wiArrow', 'transform') === 'rotate(270)', `${nm}: pijl gedraaid naar 270`);
    await p.evaluate(() => { const t = document.getElementById('twdIn'); t.value = 200; t.dispatchEvent(new Event('change')); });
    ok(await p.getAttribute('#wiArrow', 'transform') === 'rotate(200)' && (await p.innerText('#wiTxt')).startsWith('200°'), `${nm}: pijl volgt windrichting (${await p.innerText('#wiTxt')})`);
    await p.evaluate(() => { const t = document.getElementById('twdIn'); t.value = 270; t.dispatchEvent(new Event('change')); });
    // racemodus + proefvaart 60x: melding volgend rak
    await p.click('#tbRace'); await p.waitForTimeout(400);
    ok(await p.isVisible('#windInd'), `${nm}: windpijl zichtbaar in racemodus`);
    await p.selectOption('#gDemoSpd', '60'); await p.click('#gDemo');
    await p.waitForSelector('#nxtPop:not([hidden])', { timeout: 60000 }).catch(() => {});
    const vis = await p.isVisible('#nxtPop'); ok(vis, `${nm}: pop-up volgend rak verschenen`);
    if (vis) { const h = await p.innerText('#nxH'), k = await p.innerText('#nxK'), t = await p.innerText('#nxT');
      ok(/volgend rak 2/i.test(h) && /\d{3}°/.test(k) && /TWA \d+° (SB|BB)/.test(t), `${nm}: inhoud "${h} | ${k} | ${t}"`); }
    const said = await p.evaluate(() => window.__said.filter(x => /rak/.test(x)));
    ok(said.length >= 1 && /Over twee minuten: rak 2\. Koers [a-zé]+, [a-zé]+, [a-zé]+\. T\.W\.A\. \d+, (stuurboord|bakboord)\./.test(said[0]), `${nm}: stem "${said[0]}"`);
    await p.screenshot({ path: `/tmp/claude-0/-home-claude/09957d1d-b54b-5037-9ebe-4041ba2182de/scratchpad/nx_${nm}.png` });
    await p.click('#nxOk'); ok(!(await p.isVisible('#nxtPop')), `${nm}: OK sluit pop-up`);
    // alleen kaart
    await p.click('#mapOnly'); await p.waitForTimeout(300);
    const hidden = await p.evaluate(() => ['nav.tabs', '#raceBar', '#legsPanel', '#gpsHud'].map(s => { const e = document.querySelector(s); return !e || e.offsetParent === null; }));
    ok(hidden.every(Boolean), `${nm}: alleen kaart verbergt tabs, balk, rakken en GPS (${hidden})`);
    const mh = (await p.locator('#map').boundingBox()).height; const vh = await p.evaluate(() => innerHeight);
    ok(mh > vh * 0.85, `${nm}: kaart vult het scherm (${Math.round(mh)} van ${vh})`);
    ok(await p.isVisible('#mapOnly') && await p.isVisible('#windInd'), `${nm}: knop en windpijl blijven zichtbaar`);
    await p.screenshot({ path: `/tmp/claude-0/-home-claude/09957d1d-b54b-5037-9ebe-4041ba2182de/scratchpad/mo_${nm}.png` });
    await p.click('#mapOnly'); await p.waitForTimeout(200); ok(await p.isVisible('#raceBar'), `${nm}: vensters terug`);
    await p.click('#mapOnly'); await p.evaluate(() => document.getElementById('tbKaart').click()).catch(() => {});
    await p.evaluate(() => document.body.classList.remove('maponly')); // (tabs zijn verborgen; terug via code)
    ok(errs.length === 0, `${nm}: geen JS-fouten ${errs.join(';')}`); await ctx.close();
  }
  await b.close(); console.log(fails ? `${fails} FOUT(EN)` : 'alles ok'); process.exit(fails ? 1 : 0);
})();
