// Polar-berekeningen. Puur: geen DOM, geen globale toestand.
export const RAD = Math.PI / 180;

/** Lineaire interpolatie van een polar-rij over de windsnelheden (TWS) van die polar. */
export function interpTws(polar, arr, tws) {
  const T = polar.tws;
  if (tws <= T[0]) return arr[0];
  if (tws >= T[T.length - 1]) return arr[arr.length - 1];
  for (let i = 1; i < T.length; i++) if (tws <= T[i]) {
    const f = (tws - T[i - 1]) / (T[i] - T[i - 1]);
    return arr[i - 1] + (arr[i] - arr[i - 1]) * f;
  }
}

/**
 * Snelheid langs de koers (vmc, kn), bootsnelheid (bs) en modus voor een ware windhoek.
 * Onder de optimale kruishoek: opkruisen; boven de optimale gijphoek: gijpend voor de wind.
 * eff = rendement in procent (100 = polar).
 */
export function perf(polar, twa, tws, eff = 100) {
  const pI = arr => interpTws(polar, arr, tws);
  const b = pI(polar.beatAng), vu = pI(polar.beatVmg), g = pI(polar.gybeAng), vd = pI(polar.runVmg);
  const f = eff / 100;
  if (twa < b) return { vmc: vu / Math.cos(twa * RAD) * f, bs: vu / Math.cos(b * RAD) * f, mode: 'kruisen' };
  if (twa > g) return { vmc: vd / Math.cos((180 - twa) * RAD) * f, bs: vd / Math.cos((180 - g) * RAD) * f, mode: 'gijpend' };
  const pts = [[b, vu / Math.cos(b * RAD)]];
  polar.ang.forEach((a, i) => { if (a > b && a < g) pts.push([a, pI(polar.v[i])]); });
  pts.push([g, vd / Math.cos((180 - g) * RAD)]);
  for (let i = 1; i < pts.length; i++) if (twa <= pts[i][0]) {
    const q = (twa - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
    const v = (pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * q) * f;
    return { vmc: v, bs: v, mode: 'direct' };
  }
  const v = pts[pts.length - 1][1] * f;
  return { vmc: v, bs: v, mode: 'direct' };
}
