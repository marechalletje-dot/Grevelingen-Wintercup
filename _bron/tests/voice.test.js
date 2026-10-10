import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankVoices, scoreVoice, digits } from '../src/core/voice.js';
const V = (name, lang) => ({ name, lang });
test('vrouwelijke nl-NL stem gaat voor Vlaamse en mannelijke', () => {
  const r = rankVoices([V('Ellen', 'nl-BE'), V('Xander', 'nl-NL'), V('Claire', 'nl-NL'), V('Samantha', 'en-US')]);
  assert.deepEqual(r.map(v => v.name), ['Claire', 'Xander', 'Ellen']);
});
test('verbeterde versie gaat voor de gewone', () => {
  const r = rankVoices([V('Claire', 'nl-NL'), V('Claire (Verbeterd)', 'nl-NL')]); assert.equal(r[0].name, 'Claire (Verbeterd)');
});
test('Windows/Edge en Android stemmen', () => {
  const r = rankVoices([V('Microsoft Frank - Dutch (Netherlands)', 'nl-NL'), V('Microsoft Fenna Online (Natural) - Dutch (Netherlands)', 'nl-NL'), V('Google Nederlands', 'nl-NL')]);
  assert.equal(r[0].name, 'Microsoft Fenna Online (Natural) - Dutch (Netherlands)');
});
test('geen Nederlandse stem -> lege lijst', () => { assert.equal(rankVoices([V('Samantha', 'en-US')]).length, 0); assert.equal(scoreVoice(V('x', 'de-DE')), -1); });
test('koers als losse cijfers', () => { assert.equal(digits(88), 'nul, acht, acht'); assert.equal(digits(270), 'twee, zeven, nul'); });
