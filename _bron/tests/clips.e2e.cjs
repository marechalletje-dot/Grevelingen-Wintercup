// End-to-end test: meldingen inspreken (nep-microfoon), bewaren, afspelen als reeks, export/import. Gebruik: node tests/clips.e2e.cjs http://localhost:8775/
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8775/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, permissions: ['microphone'] }); await ctx.route(/service\.pdok|fonts\./, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(() => { window.__said = []; window.__starts = 0; if (window.speechSynthesis) speechSynthesis.speak = u => window.__said.push(u.text);
    const o = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { window.__starts++; return o.apply(this, a); }; });
  await p.goto(URL); await p.waitForSelector('#lpBody tr'); await p.waitForTimeout(300);
  ok((await p.innerText('#recInfo')).includes('Nog geen eigen opnames'), 'start: nog geen opnames');
  // zonder opnames: telefoonstem
  await p.click('#voiceTest'); await p.waitForTimeout(200); ok(await p.evaluate(() => window.__said.some(t => /rak 3/.test(t))), 'zonder opnames spreekt de telefoonstem');
  // opnemen met nep-microfoon
  await p.locator('#recOpen').scrollIntoViewIfNeeded(); await p.click('#recOpen'); await p.waitForSelector('#recOv');
  ok((await p.innerText('#recCnt')) === '0 van 34', 'opnamescherm: 0 van 34');
  await p.click('.recrow[data-k="d3"] .rec'); await p.waitForTimeout(1200); await p.click('.recrow[data-k="d3"] .rec'); await p.waitForTimeout(1500);
  ok((await p.innerText('#recCnt')) === '1 van 34', 'één fragment opgenomen: ' + await p.innerText('#recCnt') + ' ' + await p.innerText('#recMsg'));
  ok(await p.isVisible('.recrow[data-k="d3"].done'), 'fragment gemarkeerd ✓');
  const s0 = await p.evaluate(() => window.__starts); await p.click('.recrow[data-k="d3"] .play'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => window.__starts) > s0, 'afspelen van het fragment');
  await p.screenshot({ path: '/tmp/claude-0/-home-claude/09957d1d-b54b-5037-9ebe-4041ba2182de/scratchpad/rec.png' });
  await p.click('#recClose');
  // alle overige fragmenten kunstmatig vullen
  await p.evaluate(async () => { const keys = ['d0','d1','d2','d4','d5','d6','d7','d8','d9','n10','n11','n12','n13','n14','n15','n20','n30','n40','n50','m5','m4','m1','start','over2','rak','koers','twa','sb','bb','fin2','spih','spis','stemaan'];
    for (const k of keys) { const sr = 16000, x = new Float32Array(3200); for (let i = 0; i < x.length; i++) x[i] = 0.5 * Math.sin(i / 8); await window.__clips.put(k, sr, x); } });
  ok((await p.innerText('#recInfo')).includes('34 van 34'), 'alle 34 fragmenten: ' + await p.innerText('#recInfo'));
  // met opnames: geen telefoonstem, wel 12 fragmenten afgespeeld
  await p.evaluate(() => { window.__said = []; window.__starts = 0; }); await p.click('#voiceTest'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => window.__said.length) === 0 && await p.evaluate(() => window.__starts) === 12, `met opnames: eigen stem (${await p.evaluate(() => window.__starts)} fragmenten, ${await p.evaluate(() => window.__said.length)} telefoonzinnen)`);
  // bewaren na herladen
  await p.reload(); await p.waitForSelector('#lpBody tr'); await p.waitForTimeout(500);
  ok((await p.innerText('#recInfo')).includes('34 van 34'), 'opnames bewaard na herladen');
  // export/import
  const n = await p.evaluate(async () => { const j = window.__clips.exportJson(); return await window.__clips.importJson(j); }); ok(n === 34, 'export → import: ' + n);
  // countdown gebruikt opnames
  await p.click('#tbRace'); await p.waitForTimeout(300); await p.evaluate(() => { window.__said = []; window.__starts = 0; window.__store.set({ race: { start: Date.now() + 12000, fin: null } }); });
  await p.waitForTimeout(13500); ok(await p.evaluate(() => window.__said.length) === 0 && await p.evaluate(() => window.__starts) >= 11, `countdown met eigen stem (${await p.evaluate(() => window.__starts)} fragmenten)`);
  await p.evaluate(() => window.__store.set({ race: { start: null, fin: null } }));
  ok(errs.length === 0, 'geen JS-fouten ' + errs.join(';'));
  await b.close(); console.log(fails ? `${fails} FOUT(EN)` : 'alles ok'); process.exit(fails ? 1 : 0);
})();
