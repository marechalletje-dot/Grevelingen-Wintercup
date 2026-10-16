// Veiligheidsmiddelen aan boord (alleen data + puur rekenwerk).
// Bron: wedstrijdbepalingen Grevelingencup 2026/2027 (banenboekje), art. 1.2: "alle boten moeten voldoen aan
// World Sailing Offshore Special Regulations Appendix B" (Inshore racing); verder art. 18.1, 27.2, 30 en Deel 2 art. 1.1.
// OSR-nummers volgens World Sailing OSR 2026–2027, Appendix B.
export const SAFETY_SRC = 'Wedstrijdbepalingen Grevelingencup 2026/2027 (banenboekje) art. 1.2 → World Sailing Offshore Special Regulations 2026–2027, Appendix B (inshore racing); WB art. 18.1, 27.2, 30; Deel 2 art. 1.1.';
export const SAFETY = [
  { id: 'emmer', grp: 'osr', txt: 'Stevige emmer met lijn, minimaal 9 liter', ref: 'OSR 3.23' },
  { id: 'kompas', grp: 'osr', txt: 'Kompas (handkompas is toegestaan)', ref: 'OSR 3.24' },
  { id: 'blusser', grp: 'osr', txt: 'Brandblusser (verplicht bij elektra, motor of kooktoestel aan boord)', ref: 'OSR 4.05' },
  { id: 'anker', grp: 'osr', txt: 'Anker aan boord, niet op de boeg tijdens de wedstrijd', ref: 'OSR 4.06 · WB 18.1' },
  { id: 'boei', grp: 'osr', txt: 'Reddingsboei met drijfanker (drogue)', ref: 'OSR 4.22.3' },
  { id: 'werplijn', grp: 'osr', txt: 'Werplijn ≥ 6 mm, 15–25 m lang, bereikbaar vanuit de kuip', ref: 'OSR 4.22.4' },
  { id: 'mes', grp: 'osr', txt: 'Scherp mes in een vastgezette schede, bereikbaar vanaf dek of kuip', ref: 'OSR 4.25' },
  { id: 'vesten', grp: 'osr', txt: 'Reddingsvest voor elk bemanningslid: opblaasbaar, ISO 12402-3 (niveau 150), gemaakt na 2011, met kruisbanden, passend en gemerkt met naam van boot of eigenaar', ref: 'OSR 5.01.1' },
  { id: 'vestcheck', grp: 'osr', txt: 'Servicedatum van de reddingsvesten zelf gecontroleerd', ref: 'OSR 5.01.4' },
  { id: 'verzek', grp: 'wb', txt: 'Geldige WA-verzekering, dekking minimaal € 1.500.000 per gebeurtenis', ref: 'WB 30' },
  { id: 'marifoon', grp: 'wb', txt: 'Marifoon aan boord; uitluisteren VHF 88 (baan A+B, finish) of 76 (baan C+D); nood/MOB melden', ref: 'WB 27.2 · 18.3 (aanbevolen)' },
  { id: 'dragen', grp: 'wb', txt: 'Zwemvesten dragen tijdens de wedstrijd (advies van het comité)', ref: 'Deel 2 art. 1.1 (advies)' },
];
export const GROUPS = { osr: 'Verplicht: OSR Appendix B (wedstrijdbepaling 1.2)', wb: 'Wedstrijdbepalingen en advies', eigen: 'Eigen aanvullingen' };

/** Lijst voor een boot: standaard + eigen items. st = { checks:{id:true}, extra:[{id,txt}] } */
export function safetyList(st) {
  const extra = (st && Array.isArray(st.extra) ? st.extra : []).filter(x => x && x.id && x.txt).map(x => ({ id: x.id, grp: 'eigen', txt: x.txt, ref: '' }));
  return SAFETY.concat(extra);
}
/** Voortgang: aantal afgevinkt / totaal, en verplicht (OSR) apart. */
export function safetyProgress(st) {
  const L = safetyList(st), c = (st && st.checks) || {};
  const req = L.filter(x => x.grp === 'osr');
  return { done: L.filter(x => c[x.id]).length, total: L.length, reqDone: req.filter(x => c[x.id]).length, reqTotal: req.length };
}
