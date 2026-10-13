/**
 * Kortste weg voor een rak door vaarwater: zichtbaarheidsgraaf over de oorspronkelijke routepunten plus
 * extra knopen naast de vaarwaterboeien (aan de vaarwaterkant). Een verbinding mag als het water vrij is
 * (clear) en geen vaarwaterboei dichter dan minDist nadert. Oorspronkelijke stukken blijven altijd geldig,
 * dus het resultaat is nooit langer dan de oorspronkelijke route.
 *
 * P      : oorspronkelijke polyline [[x,y],...] (nm; x oost, y zuid)
 * names  : naam per punt van P (of null)
 * nodes  : extra knopen [{p:[x,y], name, buoy:[x,y]}]
 * opts   : { clear(a,b)→bool, obst:[{p:[x,y], inward?:[ux,uy]}], minDist, ellipse }
 *          inward = eenheidsvector naar de vaarwaterkant; een verbinding die de boei nadert moet aan die kant blijven.
 * Geeft {p, names, buoys} terug.
 */
export function shortestLeg(P, names, nodes, opts) {
  const { clear, obst = [], minDist = 0.02, ellipse = 1.25 } = opts;
  const d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const A = P[0], B = P[P.length - 1];
  let orig = 0; for (let i = 1; i < P.length; i++) orig += d(P[i - 1], P[i]);
  const N = P.map((p, i) => ({ p, name: names ? names[i] : null, oi: i, buoy: null }));
  const lim = Math.max(orig, d(A, B)) * ellipse + 0.05;
  nodes.forEach(n => { if (d(A, n.p) + d(n.p, B) <= lim) N.push({ p: n.p, name: n.name, oi: -1, buoy: n.buoy || null }); });
  const end = P.length - 1;
  // obstakels dicht bij begin/eind (bv. het rondingsmerk zelf) tellen niet
  const O = obst.filter(o => d(o.p, A) > 0.03 && d(o.p, B) > 0.03);
  const segDist = (a, b, q) => { const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy || 1e-12; let t = ((q[0] - a[0]) * vx + (q[1] - a[1]) * vy) / L2; t = Math.max(0, Math.min(1, t)); const c = [a[0] + vx * t, a[1] + vy * t]; return { dist: d(c, q), c }; };
  const okObst = (a, b) => {
    for (const o of O) {
      const { dist, c } = segDist(a, b, o.p);
      if (dist < minDist) return false;
      if (o.inward && dist < (o.near || 0.12)) { // boei aan de vaarwaterkant passeren: dichtstbijzijnde punt aan de binnenkant
        if ((c[0] - o.p[0]) * o.inward[0] + (c[1] - o.p[1]) * o.inward[1] <= 0) return false;
      }
    }
    return true;
  };
  const cache = new Map();
  const valid = (i, j) => {
    const a = N[i], b = N[j];
    if (a.oi >= 0 && b.oi >= 0 && Math.abs(a.oi - b.oi) === 1) return true;
    const k = i < j ? i + ',' + j : j + ',' + i; if (cache.has(k)) return cache.get(k);
    const v = okObst(a.p, b.p) && clear(a.p, b.p); cache.set(k, v); return v;
  };
  // A* (heuristiek: rechte afstand tot het eind)
  const g = N.map(() => Infinity), prev = N.map(() => -1), done = N.map(() => false);
  g[0] = 0; const h = i => d(N[i].p, N[end].p);
  for (;;) {
    let u = -1, bu = Infinity; for (let i = 0; i < N.length; i++) if (!done[i] && g[i] + h(i) < bu) { bu = g[i] + h(i); u = i; }
    if (u < 0 || u === end) break; done[u] = true;
    // kandidaten op volgorde van belofte, zodat dure vrij-water-checks zo veel mogelijk worden overgeslagen
    const C = []; for (let v = 0; v < N.length; v++) if (!done[v] && v !== u) { const nd = g[u] + d(N[u].p, N[v].p); if (nd < g[v] - 1e-9) C.push([nd, v]); }
    C.sort((x, y) => x[0] - y[0]);
    for (const [nd, v] of C) { if (nd < g[v] - 1e-9 && valid(u, v)) { g[v] = nd; prev[v] = u; } }
  }
  if (!isFinite(g[end])) return { p: P.slice(), names: names ? names.slice() : P.map(() => null), buoys: P.map(() => null), nm: orig };
  const path = []; for (let v = end; v >= 0; v = prev[v]) { path.unshift(v); if (v === 0) break; }
  return { p: path.map(i => N[i].p.slice()), names: path.map(i => N[i].name), buoys: path.map(i => N[i].buoy), nm: g[end], orig };
}

/** Polygonen van een vaarwater (SVG-pad "M..L..") → lijst ringen [[x,y],...]. */
export function parseRings(dstr) {
  return (dstr || '').split(/(?=M)/).filter(Boolean).map(s => (s.match(/-?[\d.]+,-?[\d.]+/g) || []).map(t => t.split(',').map(Number)));
}
