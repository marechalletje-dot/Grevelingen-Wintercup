import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGpx, parseCsv, parseAisJson, parseTrackFile, cleanTrack, addMotion, matchMarks, perfSeries, legStats, overall, distNm, packTrack, unpackTrack, aisUrl } from '../src/core/analysis.js';

const T0 = Date.UTC(2026, 9, 11, 9, 0, 0);
// boot vaart 6 kn naar het oosten, daarna naar het noorden
function synth() {
  const out = []; let lat = 51.74, lon = 3.90;
  for (let s = 0; s <= 3600; s += 10) {
    const kn = 6, d = kn * 10 / 3600;               // nm per 10 s
    if (s < 1800) lon += d / (60 * Math.cos(lat * Math.PI / 180)); else lat += d / 60;
    out.push({ t: T0 + s * 1000, lat, lon });
  }
  return out;
}

test('GPX inlezen met tijden', () => {
  const g = `<gpx><trk><trkseg><trkpt lat="51.74" lon="3.9"><time>2026-10-11T09:00:00Z</time></trkpt><trkpt lat='51.741' lon='3.901'><ele>0</ele><time>2026-10-11T09:00:10Z</time></trkpt></trkseg></trk></gpx>`;
  const p = parseGpx(g); assert.equal(p.length, 2); assert.equal(p[1].t, T0 + 10000); assert.equal(p[1].lon, 3.901);
  assert.equal(parseTrackFile(g, 'a.gpx').length, 2);
});
test('CSV met puntkomma en komma-decimalen', () => {
  const c = 'Tijd;Latitude;Longitude\n2026-10-11 09:00:00;51,74;3,9\n2026-10-11 09:00:10;51,741;3,901\n';
  const p = parseCsv(c); assert.equal(p.length, 2); assert.equal(p[0].t, T0); assert.equal(p[1].lat, 51.741);
});
test('AIS-JSON (Datalastic-achtig) herkennen', () => {
  const j = { data: { name: 'DREAM MACHINE', mmsi: '244000000', positions: [{ lat: 51.74, lon: 3.9, speed: 5.1, last_position_epoch: T0 / 1000 }, { lat: 51.75, lon: 3.91, speed: 5.3, last_position_UTC: '2026-10-11T09:01:00Z' }] } };
  const p = parseAisJson(j); assert.equal(p.length, 2); assert.equal(p[0].t, T0); assert.equal(p[1].t, T0 + 60000);
  assert.equal(parseTrackFile(JSON.stringify(j)).length, 2);
});
test('AIS-URL: Datalastic en eigen sjabloon', () => {
  assert.match(aisUrl({ provider: 'datalastic', mmsi: '244', key: 'k' }, '2026-10-11'), /vessel_history\?api-key=k&mmsi=244&from=2026-10-11&to=2026-10-12/);
  assert.equal(aisUrl({ provider: 'custom', mmsi: '244', key: 'k', tpl: 'https://x/{mmsi}?d={day}&k={key}' }, '2026-10-11'), 'https://x/244?d=2026-10-11&k=k');
});
test('opschonen: sprongen en dubbelen weg, venster', () => {
  const p = synth(); const bad = [...p, { t: T0 + 15000, lat: 52.5, lon: 3.9 }, { ...p[3] }];
  const c = cleanTrack(bad, { t0: T0 + 60e3 }); assert.equal(c.length, p.length - 6); assert.ok(c.every(q => q.lat < 52));
});
test('snelheid en koers', () => {
  const m = addMotion(cleanTrack(synth()));
  assert.ok(Math.abs(m[50].sog - 6) < 0.15, 'sog ' + m[50].sog); assert.ok(Math.abs(m[50].cog - 90) < 2, 'cog ' + m[50].cog);
  assert.ok(Math.abs(m[300].cog - 0) < 2 || Math.abs(m[300].cog - 360) < 2);
});
test('rondingen herkennen en statistiek per rak', () => {
  const P0 = addMotion(cleanTrack(synth()));
  const mid = P0[180], end = P0[P0.length - 1];
  const r = matchMarks(P0, [[mid.lat, mid.lon + 0.0005], [end.lat, end.lon]]);
  assert.ok(Math.abs(r[0].i - 180) <= 2, 'ronding 1 bij ' + r[0].i); assert.equal(r[1].i, P0.length - 1);
  // wind uit het noorden 12 kn: rak 1 halve wind (TWA 90), rak 2 recht tegen de wind in
  const polar = { tws: [6, 12, 20], beatAng: [45, 42, 40], beatVmg: [3.5, 5, 5.6], gybeAng: [150, 160, 170], runVmg: [3.5, 5.5, 7], ang: [60, 90, 120], v: [[5, 6.5, 7], [5.5, 7, 7.8], [5, 6.8, 8]] };
  const P = perfSeries(P0, () => ({ twd: 0, tws: 12 }), polar);
  assert.ok(Math.abs(P[50].target - 7) < 0.05, 'polar bij TWA 90/12 kn = 7 kn'); assert.ok(Math.abs(P[50].ratio - 6 / 7) < 0.03);
  const L = legStats(P, r, T0);
  assert.equal(L.length, 2); assert.ok(Math.abs(L[0].dur - 0.5) < 0.02); assert.ok(Math.abs(L[0].sog - 6) < 0.2);
  const o = overall(L); assert.ok(o.dur > 0.95 && o.dur < 1.01); assert.ok(o.ratio > 0.5 && o.ratio < 1.3);
});
test('track compact opslaan', () => {
  const p = cleanTrack(synth()).slice(0, 5); const u = unpackTrack(packTrack(p));
  assert.equal(u.length, 5); assert.ok(distNm([u[4].lat, u[4].lon], [p[4].lat, p[4].lon]) < 0.001); assert.equal(u[4].t, p[4].t);
});
