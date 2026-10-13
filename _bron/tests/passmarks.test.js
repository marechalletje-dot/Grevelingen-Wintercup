import test from 'node:test';
import assert from 'node:assert/strict';
import { cutPassMarks, sideOf } from '../src/core/passmarks.js';

// gate (0,0) → SP40 (1,0.4) → HG1 (2,0.4): kaarteenheden y = zuid; SP40 ligt ten zuiden van de lijn gate→HG1
const mk = (s) => [{ l: 'SP 40', b: 'SP 40', s, x: 1, y: 0.4 }, { l: 'HG 1', b: 'HG 1', s: 'BB', x: 2, y: 0.4 }];
const legs = () => [{ p: [[0, 1], [0, 0]] }, { p: [[0, 0], [1, 0.4]] }, { p: [[1, 0.4], [1.5, 0.4], [2, 0.4]] }, { p: [[2, 0.4], [3, 0]] }];

test('kant: punt ten zuiden van een oostwaartse lijn ligt rechts (SB)', () => { assert.ok(sideOf([0, 0], [1, 0], [0.5, 0.2]) < 0); });
test('passeermerk SB (buiten de bocht): hoek afgesneden naar het volgende merk', () => {
  const L = legs(); const p = cutPassMarks(L, mk('SB'));
  assert.deepEqual(p, [0]);
  assert.equal(L[1].p.length, 2); assert.deepEqual(L[1].p[0], [0, 0]);
  const P = L[1].p[1]; assert.ok(P[1] < 0.4, 'passeerpunt ten noorden van SP 40');
  assert.deepEqual(L[2].p[0], P); assert.deepEqual(L[2].p[L[2].p.length - 1], [2, 0.4]);
  assert.ok(L[2].p.length === 2, 'tussenpunt op de rechte lijn overgeslagen');
});
test('rondingsmerk BB (binnen de bocht): route blijft om het merk', () => {
  const L = legs(); const p = cutPassMarks(L, mk('BB')); assert.deepEqual(p, []); assert.deepEqual(L[1].p[1], [1, 0.4]);
});
test('niet afsnijden als het water niet vrij is', () => {
  const L = legs(); const p = cutPassMarks(L, mk('SB'), { clear: () => false }); assert.deepEqual(p, []);
});
test('vaarwaterboeien (wp) blijven staan', () => {
  const L = legs(); L[2].wp = [null, 'G 56', 'HG 1']; const p = cutPassMarks(L, mk('SB'), { freeIn: (i, j) => !(L[i].wp && L[i].wp[j]) });
  assert.deepEqual(p, [0]); assert.deepEqual(L[2].p[1], [1.5, 0.4]);
});
