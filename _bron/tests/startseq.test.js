import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotTimes, chain, hhmm, warnMs, GROUPS } from '../src/core/startseq.js';

test('eerste start: waarschuwing 10:55, start 11:00, oranje 10:50', () => {
  const t = slotTimes(1);
  assert.equal(hhmm(t.orange), '10:50'); assert.equal(hhmm(t.warn), '10:55');
  assert.equal(hhmm(t.prep), '10:56'); assert.equal(hhmm(t.oneMin), '10:59'); assert.equal(hhmm(t.start), '11:00');
});
test('kettingstart: volgende waarschuwing = vorige start', () => {
  const c = chain(4);
  for (let i = 1; i < c.length; i++) assert.equal(c[i].warn, c[i - 1].start);
  assert.equal(hhmm(c[3].start), '11:15');
});
test('ongeldige positie valt terug op 1', () => { assert.equal(slotTimes(0).warn, slotTimes(1).warn); assert.equal(slotTimes('x').warn, slotTimes(1).warn); });
test('warnMs geeft de tijd op de gekozen dag', () => {
  const d = new Date(warnMs(3, new Date(2026, 9, 11, 8, 0)));
  assert.equal(d.getHours(), 11); assert.equal(d.getMinutes(), 5); assert.equal(d.getDate(), 11);
});
test('9 startgroepen met unieke vlag', () => { assert.equal(new Set(GROUPS.map(g => g.flag)).size, 9); });
