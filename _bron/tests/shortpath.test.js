import test from 'node:test';
import assert from 'node:assert/strict';
import { shortestLeg, parseRings } from '../src/core/shortpath.js';

// eiland (blok) tussen A en B: de route mag er niet door; knopen links en rechts van het eiland
const island = (a, b) => { for (let k = 0; k <= 50; k++) { const x = a[0] + (b[0] - a[0]) * k / 50, y = a[1] + (b[1] - a[1]) * k / 50; if (x > 0.4 && x < 0.6 && y > -0.2 && y < 0.3) return false; } return true; };
test('kortste weg om een eiland via een extra knoop', () => {
  const P = [[0, 0], [0.5, 0.6], [1, 0]]; // lange omweg zuid
  const r = shortestLeg(P, ['A', 'w', 'B'], [{ p: [0.5, -0.32], name: 'N1', buoy: [0.5, -0.36] }], { clear: island });
  assert.deepEqual(r.names, ['A', 'N1', 'B']); assert.ok(r.nm < r.orig);
});
test('boei aan de verkeerde kant mag niet', () => {
  const P = [[0, 0], [0.5, 0.6], [1, 0]];
  const r = shortestLeg(P, null, [{ p: [0.5, -0.32], name: 'N1' }], { clear: island, obst: [{ p: [0.5, -0.36], inward: [0, -1] }] });
  assert.equal(r.p.length, 3); assert.deepEqual(r.p[1], [0.5, 0.6]); // geen kortere geldige weg: oorspronkelijke route
});
test('nooit langer dan de oorspronkelijke route', () => {
  const P = [[0, 0], [0.3, 0.1], [1, 0]]; const r = shortestLeg(P, null, [], { clear: () => true });
  assert.equal(r.p.length, 2); assert.ok(r.nm <= r.orig);
});
test('vaarwaterpolygoon inlezen', () => { assert.deepEqual(parseRings('M0,0L1,0L1,1Z M2,2L3,3'), [[[0, 0], [1, 0], [1, 1]], [[2, 2], [3, 3]]]); });
