# Wintercup banenkaart – broncode

Deze map (`_bron/`) bevat de broncode. GitHub Pages publiceert hem niet (mappen met `_` worden overgeslagen).
De bestanden in de hoofdmap van de repo zijn het bouwresultaat.

## Opbouw
- `src/state.js` – centrale toestand: alle instellingen op één plek, met controle, opslag (localStorage) en meldingen.
- `src/core/` – puur rekenwerk, zonder scherm of toestand:
  - `polar.js` – snelheid uit de polar (kruisen, direct, gijpend; rendement)
  - `nav.js` – coördinaten, peiling, TWA en kant, windnamen, baan past bij wind
  - `timing.js` – zeiltijd per rak, overstag/gijp-telling, tijdnotatie
  - `rating.js` – gecorrigeerde tijd, gelijke stand, marges
  - `race.js` – startsignalen, gesproken countdown, klokweergave
- `src/data/boats.js` – polars, boten en vloten (alleen data).
- `src/ui/panels.js` – vakken open/dicht, groter/kleiner, schermvullend en verplaatsen (slepen); indeling per schermtype bewaard in de store.
- `src/app.js` – scherm en interactie; gebruikt core + state.
- `src/page.html` – HTML en CSS; `src/sw_tpl.js` – service worker.
- `assets/` – kaartdata, luchtfoto, PDF-module, iconen.
- `tests/` – unit tests (`*.test.js`, Node) en end-to-end tests (`e2e.cjs`, `panels.e2e.cjs`, Playwright).

## Bouwen
    npm i -g esbuild
    python3 build.py        # draait eerst de unit tests, bouwt dan dist/github en dist/artifact.html

Kopieer daarna de inhoud van `dist/github/` naar de hoofdmap van de repo.
