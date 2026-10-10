// Keuze van de Nederlandse stem. Puur: krijgt een lijst stemmen {name, lang, localService} en geeft ze gesorteerd terug.
// Voorkeur: Nederlands uit Nederland (geen Vlaams accent), vrouwelijk, en de verbeterde/natuurlijke versies.
const FEMALE = /claire|fenna|colette|lotte|laura|anouk|google nederlands|femke|sanne|nl-nl-.*(fenna|colette)/i;
const MALE = /xander|maarten|ronnie|frank|ruben|pim/i;
const BETTER = /enhanced|premium|verbeterd|natural|neural|online/i;
export function scoreVoice(v) {
  const lang = String(v.lang || '').replace('_', '-').toLowerCase(); const n = String(v.name || '');
  if (!lang.startsWith('nl')) return -1;
  let s = lang === 'nl-nl' ? 100 : 20;            // nl-BE (Vlaams) alleen als er niets anders is
  if (FEMALE.test(n)) s += 30; if (MALE.test(n)) s -= 25;
  if (BETTER.test(n)) s += 40;
  if (/compact|eloquence|novelty|bad news|bells|bubbles|zarvox|whisper/i.test(n)) s -= 60;
  return s;
}
export function rankVoices(list) { return list.map(v => ({ v, s: scoreVoice(v) })).filter(x => x.s >= 0).sort((a, b) => b.s - a.s).map(x => x.v); }
/** Getallen zo schrijven dat de stem ze rustig en duidelijk uitspreekt. */
export const digits = n => String(n).padStart(3, '0').split('').map(d => ['nul','één','twee','drie','vier','vijf','zes','zeven','acht','negen'][+d]).join(', ');
