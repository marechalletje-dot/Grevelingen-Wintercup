import test from 'node:test';
import assert from 'node:assert/strict';
import { laylines, perpToLine, bearingXY, gateFromLine, beatAngle } from '../src/core/layline.js';
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

test('laylines bij wind uit het noorden, kruishoek 45°', () => {
  const L = laylines([0, 0], 0, 45, 1);
  near(L.sb.hdg, 315); near(L.bb.hdg, 45);
  // stuurboordslag (koers 315) komt van zuidoost: punt rechtsonder het merk
  near(L.sb.from[0], Math.SQRT1_2); near(L.sb.from[1], Math.SQRT1_2);
  near(L.bb.from[0], -Math.SQRT1_2); near(L.bb.from[1], Math.SQRT1_2);
});
test('laylines bij wind uit 290°', () => { const L = laylines([1, 1], 290, 42); near(L.sb.hdg, 248); near(L.bb.hdg, 332); });
test('peiling in kaarteenheden (y naar het zuiden)', () => { near(bearingXY([0, 0], [0, -1]), 0); near(bearingXY([0, 0], [1, 0]), 90); near(bearingXY([0, 0], [0, 1]), 180); near(bearingXY([0, 0], [-1, 0]), 270); });
test('loodrechte afstand tot de startlijn', () => { const r = perpToLine([0, 0], [1, 0], [0.3, -0.5]); near(r.d, 0.5); near(r.foot[0], 0.3); });
test('bovenboei t.o.v. startlijn: met en zonder pings', () => {
  const g = gateFromLine([0, 0], [0.1, -0.5]); near(g.perp, Math.hypot(0.1, 0.5)); near(g.crs, bearingXY([0, 0], [0.1, -0.5]));
  const h = gateFromLine([0, 0], [0.1, -0.5], [[-0.1, 0], [0.1, 0]]); near(h.perp, 0.5); near(h.dist, Math.hypot(0.1, 0.5));
});
test('kruishoek uit de polar', () => { const p = { tws: [6, 12], beatAng: [44, 40] }; near(beatAngle(p, 9), 42); });
test('voor de wind: gijplaylines met de gijphoek', async () => {
  const { gybeAngle } = await import('../src/core/layline.js');
  near(gybeAngle({ tws: [6, 12], gybeAng: [150, 170] }, 9), 160);
  // wind uit 270°, gijphoek 150°: stuurboordgijp koers 120°, bakboordgijp koers 060°; lijnen liggen bovenwinds (west) van het merk
  const L = laylines([0, 0], 270, 150, 1); near(L.sb.hdg, 120); near(L.bb.hdg, 60);
  assert.ok(L.sb.from[0] < 0 && L.bb.from[0] < 0);
});
