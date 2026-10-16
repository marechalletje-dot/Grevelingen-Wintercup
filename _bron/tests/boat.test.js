import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parsePolar, polarToText, validPolar, buildPolar } from '../src/core/polarfile.js';
import { POLAR_DM, POLAR_XP } from '../src/data/boats.js';
import { perf } from '../src/core/polar.js';
import { parseSailChart, sailsToCsv, setCustomSails, sailsFor, aboardList, normSails, defaultSails } from '../src/core/sails.js';
import { safetyList, safetyProgress, SAFETY } from '../src/core/safety.js';
const near = (a, b, e = 0.02) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

test('polar: eigen export (ORC-opbouw, decimale komma) leest terug als dezelfde polar', () => {
  const r = parsePolar(polarToText(POLAR_DM));
  assert.deepEqual(r.polar, POLAR_DM); assert.ok(validPolar(r.polar));
});
test('polar: OpenCPN/CSV-tabel met puntkomma en zonder opt-rijen → kruis/gijphoek berekend', () => {
  const t = 'TWA\\TWS;6;8;10;12\n' + [[40, 4.6, 5.6, 6.2, 6.5], [52, 5.3, 6.2, 6.8, 7.1], [90, 5.9, 6.9, 7.3, 7.5], [120, 5.9, 7, 7.5, 8], [150, 4.5, 5.6, 6.5, 7.1], [180, 3.6, 4.6, 5.6, 6.4]].map(r => r.join(';').replace(/\./g, ',')).join('\n');
  const r = parsePolar(t);
  assert.deepEqual(r.polar.tws, [6, 8, 10, 12]); assert.equal(r.polar.ang.length, 6);
  r.polar.beatAng.forEach(a => assert.ok(a >= 40 && a <= 52)); r.polar.gybeAng.forEach(a => assert.ok(a >= 140 && a <= 180));
  assert.ok(validPolar(r.polar)); assert.ok(r.warn.length);
  const p = perf(r.polar, 90, 10); near(p.bs, 7.3);
});
test('polar: CSV met komma als scheiding en punt-decimalen, omgekeerde tabel (rijen = TWS)', () => {
  const t = 'tws,45,60,90,120,150,180\n6,4.9,5.4,5.9,5.9,4.5,3.6\n10,6.4,7,7.3,7.5,6.5,5.6\n14,6.9,7.4,7.8,8.5,7.5,6.6';
  const r = parsePolar(t); assert.deepEqual(r.polar.tws, [6, 10, 14]); assert.deepEqual(r.polar.ang, [45, 60, 90, 120, 150, 180]);
  near(r.polar.v[2][1], 7.3);
});
test('polar: Expedition-formaat (TWS + paren TWA/BSP)', () => {
  const t = '6 42 4.5 60 5.4 90 5.9 135 5.3 170 3.9\n10 40 6.0 60 7.0 90 7.3 135 7.2 175 5.6';
  const r = parsePolar(t); assert.deepEqual(r.polar.tws, [6, 10]); assert.ok(r.polar.ang.includes(42) && r.polar.ang.includes(40));
  assert.ok(validPolar(r.polar));
});
test('polar: JSON van de app en foutmeldingen', () => {
  assert.deepEqual(parsePolar(JSON.stringify(POLAR_XP)).polar, POLAR_XP);
  assert.throws(() => parsePolar(''), /Leeg/);
  assert.throws(() => parsePolar('hallo wereld'), /tabel/);
  assert.throws(() => buildPolar([{ tws: 6, pts: [[50, 5], [90, 6]] }]), /windsnelheden/);
});
test('sail chart: inlezen van de crossover-chart (HTML) geeft dezelfde bereiken als de standaard', () => {
  const html = `<script>var S=[\n['J3 L/M|≈31 m²',0,13,38,95,1,'#eb6834',5.5,58,'J3 L/M'],\n['J3 M/H|31,05 m²',10,22,38,105,0,'#2a78d6',16.5,70,'J3 M/H'],\n['',7,25,100,148,1,'#e87ba4',0,0,'A3/A5'],\n['S2|103 m²',8,18,115,180,0,'#008300',12,155,'S2']];</script>`;
  const L = parseSailChart(html, 'dm');
  assert.deepEqual(L.map(s => s.id), ['J3LM', 'J3MH', 'A3', 'A5', 'S2']);
  assert.deepEqual(L.find(s => s.id === 'A3').tws, [7, 17]); assert.deepEqual(L.find(s => s.id === 'A5').tws, [17, 25]);
  assert.equal(L.find(s => s.id === 'J3MH').aboard, true); assert.equal(L.find(s => s.id === 'J3LM').aboard, false);
  assert.equal(L.find(s => s.id === 'J3MH').area, '31,05 m²');
});
test('sail chart: CSV heen en terug; eigen chart overschrijft standaard; aan boord blijft per boot', () => {
  const L = parseSailChart(sailsToCsv(defaultSails('dm')), 'dm');
  assert.deepEqual(L.map(s => [s.id, s.tws, s.twa, s.aboard]), defaultSails('dm').map(s => [s.id, s.tws, s.twa, s.aboard]));
  setCustomSails({ xp: normSails([{ name: 'Fok', tws: [0, 25], twa: [38, 110], aboard: true }, { name: 'Spi', tws: [5, 22], twa: [110, 180] }]) });
  assert.deepEqual(sailsFor('xp').map(s => s.id), ['FOK', 'SPI']);
  assert.deepEqual(aboardList('xp', ['J3MH', 'S2']).map(s => s.id), ['FOK'], 'keuze van een andere boot → standaard aan boord');
  assert.deepEqual(aboardList('xp', ['J3MH', 'SPI']).map(s => s.id), ['SPI']);
  assert.equal(sailsFor('dm').length, 9); setCustomSails({});
  const bad = normSails([{ name: '', tws: [0, 10], twa: [40, 90] }, { name: 'X', tws: [12, 12], twa: [40, 90] }, { name: 'Y', tws: [20, 10], twa: [120, 60] }]);
  assert.deepEqual(bad.map(s => [s.name, s.tws, s.twa]), [['Y', [10, 20], [60, 120]]]);
});
test('sail chart: geüploade crossover-chart van Stefan (als aanwezig)', () => {
  const f = process.env.WC_CHART; if (!f || !existsSync(f)) return;
  const L = parseSailChart(readFileSync(f, 'utf8'), 'dm');
  assert.deepEqual(L.map(s => [s.id, s.tws, s.twa, s.aboard]), defaultSails('dm').map(s => [s.id, s.tws, s.twa, s.aboard]));
});
test('veiligheid: lijst, eigen items en voortgang', () => {
  const st = { checks: { emmer: true, kompas: true, x1: true }, extra: [{ id: 'x1', txt: 'EHBO-doos' }] };
  assert.equal(safetyList(st).length, SAFETY.length + 1);
  const p = safetyProgress(st); assert.equal(p.done, 3); assert.equal(p.reqDone, 2); assert.equal(p.reqTotal, 9);
  assert.equal(safetyProgress(null).done, 0);
});
