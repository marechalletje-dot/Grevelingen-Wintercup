import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tieTime, lagMin, lagMeters, margins, corrected } from '../src/core/rating.js';
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('gelijke stand: gecorrigeerde tijden zijn gelijk', () => {
  const T = 120, myf = 0.9894, f = 1.0322; const t = tieTime(T, myf, f);
  near(corrected(t, f), corrected(T, myf));
});
test('snellere boot (hogere factor) moet eerder binnen zijn: positieve marge', () => {
  assert.ok(lagMin(120, 0.9894, 1.0322) > 0); assert.ok(lagMin(120, 0.9894, 0.97) < 0);
});
test('marge in meters: 1 minuut bij 6 kn = 185,2 m', () => { near(lagMeters(1, 6), 185.2); });
test('kritische boten vóór en achter, uitgezette boten tellen niet', () => {
  const rows = [{ boat: 'A', f: 1.05, on: true }, { boat: 'B', f: 1.02, on: true }, { boat: 'C', f: 0.96, on: true }, { boat: 'D', f: 0.90, on: false }, { boat: 'E', f: null, on: false }];
  const r = margins(rows, 120, 0.99, 6);
  assert.equal(r.behind.x.boat, 'B'); assert.equal(r.ahead.x.boat, 'C'); assert.equal(r.rows[4].tie, null);
});
