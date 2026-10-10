import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueSignals, clockState, VCALLS } from '../src/core/race.js';

function simulate(voice, from = 301, step = 0.25) {
  const fired = new Set(), said = [], beeps = [];
  for (let left = from; left > -3; left -= step) { const d = dueSignals(left, fired, voice); said.push(...d.calls.map(c => c.txt)); beeps.push(...d.beeps); }
  return { said, beeps };
}
test('gesproken countdown: alle oproepen precies één keer, in volgorde', () => {
  const { said } = simulate(true); assert.deepEqual(said, VCALLS.map(v => v[1]));
});
test('met stem: piep op 4 min (2×), 1 min (3×) en start, niet op 10 s', () => {
  const { beeps } = simulate(true); assert.deepEqual(beeps.map(b => b.n), [2, 3, 1]);
});
test('zonder stem: geen spraak, wel piep op 10 s', () => {
  const r = simulate(false); assert.equal(r.said.length, 0); assert.deepEqual(r.beeps.map(b => b.n), [2, 3, 1, 1]);
});
test('na ontwaken geen oude signalen (alleen binnen het venster)', () => {
  const fired = new Set(); const d = dueSignals(25, fired, true); assert.equal(d.calls.length, 0); assert.equal(d.beeps.length, 0);
});
test('klok: kleuren voor de start, start!, race en gezeild', () => {
  const s = 1e6;
  assert.equal(clockState(s - 120000, s, null).cls, ''); assert.equal(clockState(s - 120000, s, null).text, '2:00');
  assert.equal(clockState(s - 30000, s, null).cls, 'soon'); assert.equal(clockState(s - 5000, s, null).cls, 'now');
  assert.equal(clockState(s + 2000, s, null).label, 'START!'); assert.equal(clockState(s + 60000, s, null).label, 'RACE');
  const f = clockState(s + 99999999, s, s + 3600000); assert.equal(f.label, 'GEZEILD'); assert.equal(f.elapsed, 3600000);
  assert.equal(clockState(s, null, null), null);
});
