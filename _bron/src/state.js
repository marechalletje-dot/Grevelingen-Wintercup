// Centrale toestand van de app: één plek voor alle instellingen, met controle, opslag (localStorage) en meldingen.
const H12 = 12 * 3600e3;
const num = (lo, hi) => v => { v = +v; return isFinite(v) && v >= lo && v <= hi ? v : undefined; };
const clampNum = (lo, hi, round) => v => { v = +v; if (!isFinite(v)) return undefined; if (round) v = Math.round(v); return Math.max(lo, Math.min(hi, v)); };
export const SCHEMA = {
  boat:    { def: 'dm', key: 'wc_boat', fix: v => (v === 'dm' || v === 'xp') ? v : undefined },
  twd:     { def: 270, key: 'wc_twd', fix: v => { v = +v; return isFinite(v) ? Math.round(((v % 360) + 360) % 360) : undefined; } },
  tws:     { def: 20, key: 'wc_tws', fix: clampNum(4, 24), load: num(4, 24) },
  eff:     { def: 100, key: 'wc_eff', fix: clampNum(50, 110), load: num(50, 110) },
  tackS:   { def: 12, key: 'wc_tack', fix: clampNum(0, 60) },
  gybeS:   { def: 15, key: 'wc_gybe', fix: clampNum(0, 60) },
  spiMin:  { def: 145, key: 'wc_spi', fix: clampNum(90, 180, true), load: num(90, 180) },
  spiLead: { def: 5, key: 'wc_spilead', fix: v => { v = Math.round(+v); return v >= 1 && v <= 15 ? v : undefined; } },
  baan:    { def: 51, key: 'wc_baan', fix: v => (+v > 0 ? +v : undefined) },
  area:    { def: 'B', key: 'wc_area', fix: v => (v && 'ABCD'.includes(v) && v.length === 1 ? v : undefined) },
  allC:    { def: false },
  mapStyle:{ def: 'chart', key: 'wc_style2', fix: v => (['chart','dim','photo','night'].includes(v) ? v : undefined) },
  tab:     { def: 'Kaart', key: 'wc_tab', fix: v => (['Kaart','Race','Deeln','Regels','Uitleg'].includes(v) ? v : undefined) },
  voice:   { def: true, key: 'wc_voice', fix: v => !!v, ser: v => (v ? '1' : '0'), de: s => s !== '0' },
  demoSpd: { def: 10, key: 'wc_demospd', fix: v => (+v === 10 || +v === 60 ? +v : undefined) },
  race:    { def: { start: null, fin: null }, key: 'wc_race', json: true,
             fix: v => (v && typeof v === 'object' ? { start: v.start || null, fin: v.fin || null } : undefined),
             load: v => (v && v.start && Date.now() - v.start < H12 ? { start: v.start, fin: v.fin || null } : undefined) },
  pings:   { def: {}, key: 'wc_ping', fix: v => (v && typeof v === 'object' ? v : undefined),
             ser: v => JSON.stringify({ t: Date.now(), p: v }),
             de: s => { const o = JSON.parse(s); return o && o.t && Date.now() - o.t < H12 ? o.p || {} : undefined; } },
  fleets2: { def: {}, key: 'wc_fleets2026', json: true, fix: v => (v && typeof v === 'object' && !Array.isArray(v) ? v : undefined) },
  myf2:    { def: {}, key: 'wc_myf2026', json: true, fix: v => (v && typeof v === 'object' && !Array.isArray(v) ? v : undefined) },
  dlCls:   { def: '', key: 'wc_dlcls', fix: v => (['', 'TS', 'T', 'ORC', 'MH'].includes(v) ? v : undefined) },
  sgAdj:   { def: {}, key: 'wc_sgadj', json: true, fix: v => (v && typeof v === 'object' && !Array.isArray(v) ? v : undefined) },
  voiceName:{ def: '', key: 'wc_voicename', fix: v => (typeof v === 'string' ? v : undefined) },
  wbGrp:   { def: 'TS1', key: 'wc_wbgrp', fix: v => (['TS1','TS2','TS3','T1','T2','T3','ORC1','ORC2','MH'].includes(v) ? v : undefined) },
  wbPos:   { def: 1, key: 'wc_wbpos', fix: v => { v = Math.round(+v); return v >= 1 && v <= 9 ? v : undefined; } },
  layout:  { def: {}, key: 'wc_layout', json: true, fix: v => (v && typeof v === 'object' && !Array.isArray(v) ? v : undefined) },
};
const clone = v => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

/**
 * Maakt de store. storage = localStorage (of een nep-versie in tests).
 * - store.state: alleen-lezen weergave; schrijven via store.set({..}) of via de proxy store.S (S.twd = 250).
 * - store.on(['twd','tws'], fn): fn(changedKeys) na elke wijziging van een van die sleutels.
 * - store.touch(key): opslaan + melden na een wijziging binnen een object (bv. pings).
 */
export function createStore(storage, schema = SCHEMA) {
  const state = {}; const subs = [];
  const read = (k, d) => {
    if (!d.key || !storage) return undefined;
    try {
      const s = storage.getItem(d.key); if (s === null || s === undefined) return undefined;
      let v = d.de ? d.de(s) : d.json ? JSON.parse(s) : s;
      if (v === undefined) return undefined;
      if (d.load) return d.load(v);
      return d.fix ? d.fix(v) : v;
    } catch (e) { return undefined; }
  };
  const write = (k, d, v) => {
    if (!d.key || !storage) return;
    try {
      if (v === null || v === undefined) { storage.removeItem && storage.removeItem(d.key); return; }
      storage.setItem(d.key, d.ser ? d.ser(v) : d.json ? JSON.stringify(v) : String(v));
    } catch (e) {}
  };
  for (const [k, d] of Object.entries(schema)) { const v = read(k, d); state[k] = v === undefined ? clone(d.def) : v; }
  function emit(changed) { if (!changed.length) return; for (const s of subs) if (!s.keys || s.keys.some(k => changed.includes(k))) s.fn(changed); }
  function set(patch) {
    const changed = [];
    for (const [k, raw] of Object.entries(patch)) {
      const d = schema[k]; if (!d) throw new Error('Onbekende instelling: ' + k);
      const v = d.fix ? d.fix(raw) : raw;
      if (v === undefined) continue;                       // ongeldig: negeren, oude waarde blijft
      if (JSON.stringify(v) === JSON.stringify(state[k])) continue;
      state[k] = v; write(k, d, v); changed.push(k);
    }
    emit(changed); return changed;
  }
  function touch(k) { write(k, schema[k], state[k]); emit([k]); }
  function on(keys, fn) { const s = { keys: keys ? [].concat(keys) : null, fn }; subs.push(s); return () => subs.splice(subs.indexOf(s), 1); }
  const S = new Proxy(state, { set(t, k, v) { if (!(k in schema)) throw new Error('Onbekende instelling: ' + String(k)); set({ [k]: v }); return true; } });
  return { state, S, set, touch, on };
}
