import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perf, interpTws } from '../src/core/polar.js';
import { POLAR_DM, POLAR_XP } from '../src/data/boats.js';
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('interpolatie: exact op een tabelpunt en lineair ertussen', () => {
  near(interpTws(POLAR_DM, POLAR_DM.beatVmg, 10), 4.70);
  near(interpTws(POLAR_DM, POLAR_DM.beatVmg, 11), (4.70 + 5.01) / 2);
});
test('interpolatie: buiten de tabel wordt afgekapt', () => {
  near(interpTws(POLAR_DM, POLAR_DM.beatVmg, 2), 2.44);
  near(interpTws(POLAR_DM, POLAR_DM.beatVmg, 40), 5.25);
});
test('perf: pal tegen de wind -> kruisen, vmc = beat-VMG', () => {
  const p = perf(POLAR_DM, 0, 12, 100);
  assert.equal(p.mode, 'kruisen'); near(p.vmc, 5.01);
});
test('perf: pal voor de wind -> gijpend, vmc = run-VMG', () => {
  const p = perf(POLAR_DM, 180, 16, 100);
  assert.equal(p.mode, 'gijpend'); near(p.vmc, 7.39);
});
test('perf: halve wind 90° bij 10 kn = polarwaarde', () => {
  const p = perf(POLAR_DM, 90, 10, 100);
  assert.equal(p.mode, 'direct'); near(p.vmc, 7.31);
});
test('perf: rendement schaalt lineair', () => {
  near(perf(POLAR_DM, 90, 10, 90).vmc, 7.31 * 0.9);
});
test('perf: XP-33 halve wind 12 kn', () => { near(perf(POLAR_XP, 90, 12, 100).vmc, 7.49); });
test('perf: snelheid altijd positief en eindig over alle hoeken en windsterktes', () => {
  for (const P of [POLAR_DM, POLAR_XP]) for (let tws = 4; tws <= 24; tws += 2) for (let a = 0; a <= 180; a += 5) {
    const v = perf(P, a, tws, 100).vmc; assert.ok(v > 0 && isFinite(v), `${a}° ${tws} kn`);
  }
});
