import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridPts, fieldUrl, parseField, fieldAt, sampleGrid, fieldWind, speedColor, FIELD_BOX, FIELD_NX, FIELD_NY } from '../src/core/wxfield.js';

const N = FIELD_NX * FIELD_NY;
const resp = (fn) => gridPts().map(p => ({ hourly: { time: ['2026-10-11T10:00', '2026-10-11T11:00'], wind_speed_10m: [fn(p, 0).tws, fn(p, 1).tws], wind_direction_10m: [fn(p, 0).twd, fn(p, 1).twd] } }));
const T = h => new Date(2026, 9, 11, h, 0).getTime();

test('raster: 28 punten, hoeken op de rand van het gebied', () => {
  const g = gridPts(); assert.equal(g.length, N);
  assert.deepEqual([g[0].lat, g[0].lon], [FIELD_BOX.n, FIELD_BOX.w]); assert.deepEqual([g[N - 1].lat, g[N - 1].lon], [FIELD_BOX.s, FIELD_BOX.e]);
});
test('URL met lijst van coördinaten', () => {
  const u = new URL(fieldUrl('knmi_seamless', '2026-10-11'));
  assert.equal(u.searchParams.get('latitude').split(',').length, N); assert.equal(u.searchParams.get('models'), 'knmi_seamless');
});
test('parseField: verkeerd aantal punten of foutmelding', () => {
  assert.throws(() => parseField([{ hourly: { time: [], wind_speed_10m: [], wind_direction_10m: [] } }]), /rasterpunten/);
  assert.throws(() => parseField({ error: true, reason: 'Invalid model' }), /Invalid model/);
});
test('interpolatie: west 10 kn, oost 20 kn → midden 15 kn; tijd tussen de uren', () => {
  const F = parseField(resp(p => ({ twd: 270, tws: p.i === 0 ? 10 : p.i === FIELD_NX - 1 ? 20 : 10 + 10 * p.i / (FIELD_NX - 1) })));
  const mid = (FIELD_BOX.w + FIELD_BOX.e) / 2, la = (FIELD_BOX.n + FIELD_BOX.s) / 2;
  const w = fieldWind(F, T(10), la, mid); assert.equal(w.twd, 270); assert.ok(Math.abs(w.tws - 15) < 0.05, String(w.tws));
  assert.equal(fieldWind(F, T(10), la, 3.0).tws, 10); // buiten het raster: rand
});
test('richting over noord wordt via vectoren gemiddeld', () => {
  const F = parseField(resp(p => ({ twd: p.i < 3 ? 350 : 10, tws: 12 })));
  const G = fieldAt(F, T(10)); const lon = FIELD_BOX.w + (FIELD_BOX.e - FIELD_BOX.w) * 2.5 / (FIELD_NX - 1);
  const w = sampleGrid(F, G, FIELD_BOX.n, lon); assert.ok(w.twd === 0 || w.twd === 359, String(w.twd));
});
test('kleurschaal oplopend en begrensd', () => {
  assert.deepEqual(speedColor(-5), speedColor(0)); assert.deepEqual(speedColor(99), speedColor(32)); assert.equal(speedColor(11.5).length, 3);
});
