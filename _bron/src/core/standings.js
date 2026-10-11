// Tussenstand / totaalklassement volgens WB 17.1 (lage punten) en 17.6 (aftrekwedstrijden).
/** Aantal aftrekwedstrijden bij n gevaren races (WB 17.6). */
export function discards(n) { return n >= 15 ? 3 : n >= 10 ? 2 : n >= 6 ? 1 : 0; }
export const boatKey = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * group = { races: { raceId: [{pl, gc, boat, pts, ...}] } }, raceIds = volgorde van alle races.
 * Boten die in een gevaren race ontbreken krijgen de DNC-score = hoogste punten in die race (aanname: aantal ingeschrevenen + 1).
 */
export function standings(group, raceIds) {
  const sailed = raceIds.filter(id => group.races[id] && group.races[id].length);
  const boats = new Map();
  for (const id of sailed) for (const r of group.races[id]) {
    const k = boatKey(r.boat);
    if (!boats.has(k)) boats.set(k, { key: k, boat: r.boat, gc: r.gc, type: r.type, pts: {} });
  }
  for (const id of sailed) {
    const rows = group.races[id]; const dnc = Math.max(...rows.map(r => r.pts));
    for (const b of boats.values()) {
      const r = rows.find(x => boatKey(x.boat) === b.key);
      b.pts[id] = r ? { p: r.pts, code: typeof r.pl === 'number' ? '' : r.pl } : { p: dnc, code: 'DNC' };
    }
  }
  const nd = discards(sailed.length);
  for (const b of boats.values()) {
    const list = sailed.map(id => ({ id, p: b.pts[id].p })).sort((a, c) => c.p - a.p);
    const drop = new Set(list.slice(0, nd).map(x => x.id));
    for (const id of sailed) b.pts[id].drop = drop.has(id);
    b.gross = sailed.reduce((a, id) => a + b.pts[id].p, 0);
    b.net = b.gross - list.slice(0, nd).reduce((a, x) => a + x.p, 0);
  }
  // Rangschikking: laagste netto; bij gelijke stand beslist de laatste race (vereenvoudigd t.o.v. RvW A8).
  const last = sailed[sailed.length - 1];
  const arr = [...boats.values()].sort((a, c) => a.net - c.net || (last ? a.pts[last].p - c.pts[last].p : 0) || a.boat.localeCompare(c.boat));
  arr.forEach((b, i) => { b.rank = i + 1; });
  return { sailed, discards: nd, rows: arr };
}
