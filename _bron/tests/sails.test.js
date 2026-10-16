import test from 'node:test';
import assert from 'node:assert/strict';
import { sailsFor, aboardList, advise, inZone, normLog, sailAt, segments } from '../src/core/sails.js';
import { skUrl, mixedBlocked, applyDelta, snapshot, trueWind, packIns, unpackIns, insAt, meanWind } from '../src/core/signalk.js';
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

test('zeilen aan boord: standaard uit de chart, of eigen keuze', () => {
  assert.deepEqual(aboardList('dm').map(s => s.id), ['J3MH', 'J4', 'S2']);
  assert.deepEqual(aboardList('dm', ['S2', 'J3LM']).map(s => s.id), ['J3LM', 'S2']);
  assert.equal(aboardList('xp').length, 0);
});
test('zeiladvies binnen de bereiken', () => {
  const A = aboardList('dm');
  assert.equal(advise(A, 14, 42).sail.id, 'J3MH');
  assert.equal(advise(A, 23, 45).sail.id, 'J4');
  assert.equal(advise(A, 12, 160).sail.id, 'S2');
  assert.equal(advise(A, 12, -160).sail.id, 'S2', 'teken van de TWA telt niet');
  assert.ok(advise(A, 12, 160).ok);
});
test('zeiladvies buiten de bereiken: dichtstbijzijnde zeil, ok = false', () => {
  const A = aboardList('dm'); const r = advise(A, 6, 45);
  assert.equal(r.ok, false); assert.equal(r.sail.id, 'J3MH');
  const all = sailsFor('dm'); const r2 = advise(all, 6, 45); assert.ok(r2.ok); assert.equal(r2.sail.id, 'J3LM');
});
test('bij overlap wint het zeil waar je het meest centraal in zit', () => {
  const all = sailsFor('dm');
  assert.ok(inZone(all.find(s => s.id === 'S2'), 17, 170) && inZone(all.find(s => s.id === 'S4'), 17, 170));
  assert.equal(advise(all, 24, 170).sail.id, 'S4');
});
test('zeillog: sorteren, zeil op tijdstip en stukken', () => {
  const ev = [{ t: 300, s: 'S2' }, { t: 100, s: 'J3MH' }, { t: 200, s: 'J3MH' }, { t: 500, s: 'J3MH' }];
  assert.deepEqual(normLog(ev).map(e => e.t), [100, 300, 500]);
  assert.equal(sailAt(ev, 50), null); assert.equal(sailAt(ev, 350), 'S2');
  assert.deepEqual(segments(ev, 0, 600), [{ s: null, t0: 0, t1: 100 }, { s: 'J3MH', t0: 100, t1: 300 }, { s: 'S2', t0: 300, t1: 500 }, { s: 'J3MH', t0: 500, t1: 600 }]);
  assert.deepEqual(segments(ev, 150, 400), [{ s: 'J3MH', t0: 150, t1: 300 }, { s: 'S2', t0: 300, t1: 400 }]);
});

test('Signal K-adres naar WebSocket-URL', () => {
  const http = { protocol: 'http:', hostname: '10.10.10.1' }, https = { protocol: 'https:', hostname: 'x.github.io' };
  assert.equal(skUrl('', http), 'ws://10.10.10.1:3000/signalk/v1/stream?subscribe=none');
  assert.equal(skUrl('auto', http), 'ws://10.10.10.1:3000/signalk/v1/stream?subscribe=none');
  assert.equal(skUrl('pi.local:3000', http), 'ws://pi.local:3000/signalk/v1/stream?subscribe=none');
  assert.equal(skUrl('boot.example.nl:3443', https), 'wss://boot.example.nl:3443/signalk/v1/stream?subscribe=none');
  assert.equal(skUrl('http://10.0.0.5:3000/', http), 'ws://10.0.0.5:3000/signalk/v1/stream?subscribe=none');
  assert.equal(skUrl('ws://a:1/signalk/v1/stream', http), 'ws://a:1/signalk/v1/stream?subscribe=none');
  assert.ok(mixedBlocked('ws://10.10.10.1:3000/x', https)); assert.ok(!mixedBlocked('wss://a/x', https)); assert.ok(!mixedBlocked('ws://a/x', http));
});
test('ware wind uit schijnbare wind', () => {
  // recht voor de wind: schijnbaar 10 kn van achteren bij 6 kn bootsnelheid → waar 16 kn
  let w = trueWind(10, 180, 6); near(w.tws, 16); near(Math.abs(w.twa), 180);
  // aan de wind: AWA 30°, AWS 15, STW 6
  w = trueWind(15, 30, 6); near(w.tws, Math.hypot(15 * Math.cos(Math.PI / 6) - 6, 7.5)); assert.ok(w.twa > 30 && w.twa < 60);
  w = trueWind(15, -30, 6); assert.ok(w.twa < -30);
});
test('delta verwerken en momentopname in knopen en graden', () => {
  const S = { __self: 'vessels.urn:mrn:imo:mmsi:244001631' }; const now = 1e12; const iso = new Date(now).toISOString();
  const n = applyDelta(S, { context: 'vessels.urn:mrn:imo:mmsi:244001631', updates: [{ timestamp: iso, values: [
    { path: 'environment.wind.speedApparent', value: 15 / 1.943844 }, { path: 'environment.wind.angleApparent', value: -30 * Math.PI / 180 },
    { path: 'navigation.speedThroughWater', value: 6 / 1.943844 }, { path: 'navigation.headingMagnetic', value: 100 * Math.PI / 180 },
    { path: 'navigation.position', value: { latitude: 51.74, longitude: 3.95 } }] }] }, now);
  assert.equal(n, 5);
  assert.equal(applyDelta(S, { context: 'vessels.urn:mrn:imo:mmsi:999', updates: [{ values: [{ path: 'navigation.speedThroughWater', value: 1 }] }] }, now), 0, 'ander schip genegeerd');
  const o = snapshot(S, now + 1000, { decl: 2.5 });
  near(o.aws, 15, 1e-9); near(o.awa, -30, 1e-9); near(o.stw, 6, 1e-9); near(o.hdg, 102.5, 1e-9);
  assert.equal(o.twSrc, 'calc'); assert.ok(o.twa < -30); near(o.twd, ((102.5 + o.twa) % 360 + 360) % 360, 1e-9);
  assert.equal(o.lat, 51.74);
  assert.equal(snapshot(S, now + 60e3).stw, null, 'oude waarden vallen weg');
});
test('instrumentrijen compact opslaan en opzoeken', () => {
  const I = unpackIns([packIns(1000e3, { tws: 12.34, twa: -41.6, stw: 6.123, hdg: 200.4, aws: 17.06, awa: -28, twd: 158.8 }), packIns(1002e3, { tws: 12 })]);
  near(I[0].tws, 12.3); assert.equal(I[0].twa, -42); near(I[0].stw, 6.12); assert.equal(I[0].twd, 159); assert.equal(I[1].stw, null);
  assert.equal(insAt(I, 1001.4e3).t, 1002e3); assert.equal(insAt(I, 1500e3), null);
  const W = meanWind([{ t: 0, twd: 350, tws: 10 }, { t: 1000, twd: 10, tws: 14 }], 1000, 5000); near(W.twd, 0, 1e-9); near(W.tws, 12);
});
test('kruisrak: merk recht in de wind telt als aan de wind (TWA 40°)', () => {
  const A = aboardList('dm'); const r = advise(A, 15, 0); assert.ok(r.ok); assert.equal(r.sail.id, 'J3MH');
});
