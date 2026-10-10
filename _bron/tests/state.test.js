import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/state.js';
const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };

test('standaardwaarden zonder opslag', () => {
  const s = createStore(mem()); assert.equal(s.state.twd, 270); assert.equal(s.state.tws, 20); assert.equal(s.state.boat, 'dm'); assert.equal(s.state.voice, true);
});
test('laden uit opslag, ongeldige waarden worden genegeerd', () => {
  const s = createStore(mem({ wc_twd: '250', wc_tws: '99', wc_boat: 'zz', wc_voice: '0', wc_area: 'C' }));
  assert.equal(s.state.twd, 250); assert.equal(s.state.tws, 20); assert.equal(s.state.boat, 'dm'); assert.equal(s.state.voice, false); assert.equal(s.state.area, 'C');
});
test('schrijven via de proxy: corrigeren, opslaan en melden', () => {
  const st = mem(); const s = createStore(st); const seen = [];
  s.on(['twd'], ch => seen.push(ch));
  s.S.twd = 370; assert.equal(s.state.twd, 10); assert.equal(st.m.get('wc_twd'), '10'); assert.deepEqual(seen, [['twd']]);
  s.S.twd = 10; assert.equal(seen.length, 1, 'geen melding bij gelijke waarde');
  s.S.tws = 30; assert.equal(s.state.tws, 24);
});
test('onbekende instelling geeft een fout', () => { const s = createStore(mem()); assert.throws(() => { s.S.foo = 1; }); });
test('race vervalt na 12 uur, pings ook', () => {
  const old = Date.now() - 13 * 3600e3;
  const s = createStore(mem({ wc_race: JSON.stringify({ start: old, fin: null }), wc_ping: JSON.stringify({ t: old, p: { ship: { lat: 1, lon: 2 } } }) }));
  assert.equal(s.state.race.start, null); assert.deepEqual(s.state.pings, {});
  const s2 = createStore(mem({ wc_race: JSON.stringify({ start: Date.now(), fin: null }) })); assert.ok(s2.state.race.start);
});
test('touch slaat een binnen-object-wijziging op', () => {
  const st = mem(); const s = createStore(st); s.state.pings.ship = { lat: 1, lon: 2 }; s.touch('pings');
  assert.equal(JSON.parse(st.m.get('wc_ping')).p.ship.lat, 1);
});
test('werkt zonder opslag (privévenster)', () => { const s = createStore(null); s.S.twd = 200; assert.equal(s.state.twd, 200); });
