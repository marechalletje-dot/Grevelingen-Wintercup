import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseForecast, windAt, avgWind, simulate, pickModel, forecastUrl } from '../src/core/wx.js';
import { legTime, countManoeuvres } from '../src/core/timing.js';
import { POLAR_DM } from '../src/data/boats.js';

const J = { hourly_units: { wind_speed_10m: 'kn' }, hourly: { time: ['2026-10-11T10:00', '2026-10-11T11:00', '2026-10-11T12:00', '2026-10-11T13:00'],
  wind_speed_10m: [14, 16, 18, null], wind_direction_10m: [350, 10, 30, 40], wind_gusts_10m: [20, 24, 26, 27] } };
const T = h => new Date(2026, 9, 11, h, 0).getTime();

test('parseForecast: uren zonder data vallen weg, lokale tijd', () => {
  const s = parseForecast(J); assert.equal(s.length, 3); assert.equal(s[0].h, 10); assert.equal(s[1].gust, 24); assert.equal(s[0].t, T(10));
});
test('parseForecast: modelnaam achter de variabele wordt herkend', () => {
  const s = parseForecast({ hourly: { time: ['2026-10-11T10:00'], wind_speed_10m_knmi_seamless: [12], wind_direction_10m_knmi_seamless: [270] } });
  assert.equal(s[0].tws, 12); assert.equal(s[0].twd, 270);
});
test('parseForecast: foutmelding van de API', () => { assert.throws(() => parseForecast({ error: true, reason: 'Invalid model' }), /Invalid model/); });
test('windAt: interpolatie over noord (350° → 10° = 0°)', () => {
  const s = parseForecast(J); const w = windAt(s, T(10) + 1800e3); assert.ok(w.twd === 0 || w.twd === 359 || w.twd === 360 % 360, String(w.twd)); assert.equal(w.tws, 15);
  assert.deepEqual(windAt(s, T(8)), { twd: 350, tws: 14 });
});
test('avgWind: gemiddelde 11–12 uur', () => { const a = avgWind(parseForecast(J), T(11), T(12)); assert.equal(a.twd, 20); assert.equal(a.tws, 17); assert.equal(a.min, 16); assert.equal(a.max, 18); });
test('simulate met constante wind = som van de rak-tijden van de app', () => {
  const legs = [{ t: 'A', s: [{ nm: 1, tw: 270 }] }, { t: 'B', s: [{ nm: 2, tw: 0 }, { nm: 1, tw: 30 }] }, { t: 'C', s: [{ nm: 1.5, tw: 90 }] }];
  const ctx = { polar: POLAR_DM, eff: 100, tackS: 12, gybeS: 15 };
  const series = [{ t: T(10), twd: 270, tws: 12 }, { t: T(16), twd: 270, tws: 12 }];
  const r = simulate(legs, ctx, series, T(11));
  const c = { ...ctx, twd: 270, tws: 12 };
  const ref = legs.reduce((a, l) => { const x = { ...l }; countManoeuvres([x], c); return a + legTime(x, c); }, 0);
  assert.ok(Math.abs(r.hours - ref) < 1e-9, `${r.hours} vs ${ref}`);
  assert.equal(r.legs.length, 3); assert.equal(r.legs[0].mode, 'kruisen'); assert.ok(r.legs[1].start === r.legs[0].end);
});
test('simulate: meer wind = sneller', () => {
  const legs = [{ t: 'A', s: [{ nm: 3, tw: 0 }] }]; const ctx = { polar: POLAR_DM, eff: 100, tackS: 12, gybeS: 15 };
  const slow = simulate(legs, ctx, [{ t: T(10), twd: 270, tws: 6 }], T(11)).hours, fast = simulate(legs, ctx, [{ t: T(10), twd: 270, tws: 14 }], T(11)).hours;
  assert.ok(fast < slow);
});
test('model kiezen en URL', () => {
  const now = new Date(2026, 9, 10, 20, 0).getTime();
  assert.equal(pickModel('auto', '2026-10-11', now), 'knmi_seamless'); assert.equal(pickModel('auto', '2026-10-20', now), 'ecmwf_ifs025'); assert.equal(pickModel('icon_seamless', '2026-10-11', now), 'icon_seamless');
  const u = forecastUrl('knmi_seamless', '2026-10-11'); assert.match(u, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/); assert.match(u, /wind_speed_unit=kn/); assert.match(u, /start_date=2026-10-11/);
});
test('simulate: windveld per plaats wordt gebruikt', () => {
  const legs = [{ t: 'A', p: [[0, 0], [0, -3]], s: [{ nm: 3, tw: 0 }] }]; const ctx = { polar: POLAR_DM, eff: 100, tackS: 12, gybeS: 15 };
  const ser = [{ t: T(10), twd: 270, tws: 6 }];
  const slow = simulate(legs, ctx, ser, T(11)).hours;
  const fast = simulate(legs, ctx, ser, T(11), () => ({ twd: 270, tws: 14 })).hours;
  assert.ok(fast < slow); assert.equal(simulate(legs, ctx, ser, T(11), () => ({ twd: 270, tws: 6 })).hours, slow);
});
