import { test } from 'node:test';
import assert from 'node:assert/strict';
import { llXY, xyLL, brgT, twaOf, wname, pad3, cmean, fitsWind, pos, offsetNm, distCrs } from '../src/core/nav.js';
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('llXY en xyLL zijn elkaars inverse', () => {
  const [x, y] = llXY(51.76, 3.88); const [lat, lon] = xyLL(x, y); near(lat, 51.76); near(lon, 3.88);
});
test('1 minuut noord = 1 nm', () => { const a = llXY(51.74, 3.95), b = llXY(51.74 + 1 / 60, 3.95); near(Math.hypot(b[0] - a[0], b[1] - a[1]), 1); });
test('peiling: noord 0°, oost 90°, zuid 180°, west 270°', () => {
  near(brgT([0, 0], [0, -1]), 0); near(brgT([0, 0], [1, 0]), 90); near(brgT([0, 0], [0, 1]), 180); near(brgT([0, 0], [-1, 0]), 270);
});
test('TWA en kant: wind 270°, koers 0° -> 90° stuurboord... wind van bakboord', () => {
  assert.deepEqual(twaOf(270, 0), { a: 90, side: 'BB' });
  assert.deepEqual(twaOf(270, 180), { a: 90, side: 'SB' });
  assert.deepEqual(twaOf(270, 270), { a: 0, side: 'SB' });
  assert.equal(twaOf(270, 90).a, 180);
});
test('windnamen en notatie', () => {
  assert.equal(wname(270), 'W'); assert.equal(wname(-90), 'W'); assert.equal(wname(22.5), 'NNO');
  assert.equal(pad3(5), '005°'); assert.equal(pad3(360), '000°'); assert.equal(pad3(-10), '350°');
});
test('gemiddelde hoek rond noord', () => { const m = cmean([[350, 1], [10, 1]]); assert.ok(m < 1e-9 || Math.abs(m - 360) < 1e-9); });
test('baan past bij wind binnen 22,5° van de as', () => {
  assert.equal(fitsWind('Oost / West', 270), true); assert.equal(fitsWind('Oost / West', 292), true);
  assert.equal(fitsWind('Oost / West', 300), false); assert.equal(fitsWind('onbekend', 0), true);
});
test('koerstypes', () => { assert.equal(pos(30), 'kruisen'); assert.equal(pos(90), 'halve wind'); assert.equal(pos(170), 'voor de wind'); });
test('gate op 0,5 nm en 270°M vanaf de start, en terug', () => {
  const st = [1, -2], decl = 2.5; const g = offsetNm(st, 0.5, 270 + decl); const d = distCrs(st, g, decl);
  near(d.nm, 0.5); near(d.mw, 270); near(d.tw, 272.5);
});
test('offsetNm: 1 nm noord is y - 1', () => { const g = offsetNm([0, 0], 1, 0); near(g[0], 0); near(g[1], -1); });
