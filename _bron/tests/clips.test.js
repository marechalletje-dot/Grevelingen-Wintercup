import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIPS, CLIP_KEYS, numKeys, courseKeys, countdownKeys, nextLegKeys, spiKeys, complete, trimSilence, normalize } from '../src/core/clips.js';
test('alle sleutels uniek en alle gebruikte sleutels bestaan', () => {
  assert.equal(CLIP_KEYS.size, CLIPS.length);
  const used = [...countdownKeys(300), ...countdownKeys(240), ...countdownKeys(60), ...[50, 40, 30, 20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].flatMap(countdownKeys),
    ...nextLegKeys(14, 88, 166, 'SB'), ...nextLegKeys(2, 270, 5, 'BB'), ...spiKeys('HIJSEN', 'BB'), ...spiKeys('STRIJKEN', 'SB'), 'fin2', 'stemaan'];
  for (const k of used) assert.ok(CLIP_KEYS.has(k), k);
});
test('getallen', () => {
  assert.deepEqual(numKeys(7), ['d7']); assert.deepEqual(numKeys(12), ['n12']); assert.deepEqual(numKeys(17), ['d1', 'd7']); assert.deepEqual(numKeys(166), ['d1', 'd6', 'd6']);
});
test('koers altijd drie cijfers', () => { assert.deepEqual(courseKeys(88), ['d0', 'd8', 'd8']); assert.deepEqual(courseKeys(360), ['d0', 'd0', 'd0']); });
test('volgend rak', () => {
  assert.deepEqual(nextLegKeys(3, 88, 180, 'BB'), ['over2', 'rak', 'd3', 'koers', 'd0', 'd8', 'd8', 'twa', 'd1', 'd8', 'd0', 'bb']);
});
test('countdown', () => { assert.deepEqual(countdownKeys(300), ['m5']); assert.deepEqual(countdownKeys(30), ['n30']); assert.deepEqual(countdownKeys(0), ['start']); });
test('compleet alleen als alle fragmenten er zijn', () => { assert.equal(complete(['a', 'b'], new Set(['a'])), false); assert.equal(complete(['a'], new Set(['a', 'b'])), true); });
test('stilte weghalen en normaliseren', () => {
  const sr = 1000, x = new Float32Array(1000); for (let i = 400; i < 600; i++) x[i] = 0.5 * Math.sin(i);
  const y = trimSilence(x, sr); assert.ok(y.length < 300 && y.length >= 150, String(y.length));
  assert.equal(trimSilence(new Float32Array(100), sr).length, 0);
  const z = normalize(Float32Array.from([0.1, -0.2])); assert.ok(Math.abs(Math.max(...z.map(Math.abs)) - 0.9) < 1e-6);
});
