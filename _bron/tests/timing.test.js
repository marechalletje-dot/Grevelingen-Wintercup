import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segTime, countManoeuvres, legTime, fmtT, fmtMS, hms } from '../src/core/timing.js';
import { POLAR_DM } from '../src/data/boats.js';
const ctx = { polar: POLAR_DM, twd: 270, tws: 10, eff: 100, tackS: 12, gybeS: 15 };
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('deelrak halve wind: 7,31 nm bij 7,31 kn = 1 uur', () => { near(segTime({ nm: 7.31, tw: 0 }, ctx), 1); });
test('kruisrak van 1 nm: 2 overstagen en tijdverlies 24 s', () => {
  const legs = [{ s: [{ nm: 1, tw: 270 }] }]; countManoeuvres(legs, ctx);
  assert.equal(legs[0]._man.t, 2); assert.equal(legs[0]._man.g, 0); near(legs[0]._man.loss, 24 / 3600);
  near(legTime(legs[0], ctx), 1 / 4.70 + 24 / 3600);
});
test('voor de wind 1,5 nm: 2 gijpen', () => {
  const legs = [{ s: [{ nm: 1.5, tw: 90 }] }]; countManoeuvres(legs, ctx); assert.equal(legs[0]._man.g, 2);
});
test('kantwissel in een ruim rak telt als gijp', () => {
  const legs = [{ s: [{ nm: 1, tw: 120 }, { nm: 1, tw: 60 }] }]; countManoeuvres(legs, ctx);
  assert.equal(legs[0]._man.g, 1); assert.equal(legs[0]._man.t, 0);
});
test('tijdnotatie', () => {
  assert.equal(fmtT(0.5), '30:00'); assert.equal(fmtT(2 + 4 / 60 + 22 / 3600), '2:04:22');
  assert.equal(fmtMS(-90.5), '1:30:30'); assert.equal(hms(3723000), '1:02:03'); assert.equal(hms(-5), '0:00:00');
});
