import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discards, standings } from '../src/core/standings.js';
import { GROUPS, RACES } from '../src/data/results.js';

test('aftrek volgens WB 17.6', () => {
  assert.deepEqual([1, 5, 6, 9, 10, 14, 15, 20].map(discards), [0, 0, 1, 1, 2, 2, 3, 3]);
});
test('na race 1: Toer-S groep 1, Dream Machine 2e', () => {
  const s = standings(GROUPS.TS1, RACES.map(r => r.id));
  assert.equal(s.sailed.length, 1); assert.equal(s.discards, 0);
  assert.equal(s.rows[0].boat, 'A Boen!!');
  const dm = s.rows.find(r => r.boat === 'Dream Machine'); assert.equal(dm.rank, 2); assert.equal(dm.net, 2);
  assert.equal(s.rows.length, 15);
});
test('ORC 1: X-C Pole DNF = 9 punten', () => {
  const s = standings(GROUPS.ORC1, RACES.map(r => r.id));
  const x = s.rows.find(r => r.boat === 'X-C Pole'); assert.equal(x.net, 9); assert.equal(x.pts.r1.code, 'DNF');
});
test('ontbrekende boot krijgt DNC en aftrek bij 6 races', () => {
  const mk = (a, b) => [{ pl: 1, boat: 'A', pts: a }, { pl: 2, boat: 'B', pts: b }];
  const g = { races: { r1: mk(1, 2), r2: mk(2, 1), r3: [{ pl: 1, boat: 'A', pts: 1 }, { pl: 2, boat: 'C', pts: 2 }], r4: mk(1, 2), r5: mk(1, 2), r6: mk(1, 2) } };
  const s = standings(g, ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
  assert.equal(s.discards, 1);
  const b = s.rows.find(r => r.boat === 'B'); assert.equal(b.pts.r3.code, 'DNC'); assert.equal(b.pts.r3.p, 2); assert.equal(b.gross, 11); assert.equal(b.net, 9);
  assert.equal(s.rows[0].boat, 'A'); assert.equal(s.rows[0].net, 5);
});
