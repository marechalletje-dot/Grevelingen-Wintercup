// Signal K: live boordinstrumenten (puur rekenwerk, zonder browser-API's).
// Signal K levert SI-eenheden: snelheden in m/s, hoeken in radialen. De app werkt in knopen en graden.
const KN = 1.943844, DEG = 180 / Math.PI;

/** Paden waarop de app zich abonneert. */
export const SK_PATHS = [
  'environment.wind.speedApparent', 'environment.wind.angleApparent',
  'environment.wind.speedTrue', 'environment.wind.angleTrueWater', 'environment.wind.directionTrue', 'environment.wind.directionMagnetic',
  'navigation.speedThroughWater', 'navigation.headingMagnetic', 'navigation.headingTrue', 'navigation.magneticVariation',
  'navigation.position', 'navigation.speedOverGround', 'navigation.courseOverGroundTrue',
  'environment.depth.belowTransducer',
];
export function subscribeMsg(period = 1000) {
  return { context: 'vessels.self', subscribe: SK_PATHS.map(path => ({ path, period, policy: 'instant' })) };
}

/**
 * Adres invoer → WebSocket-URL voor de Signal K-datastroom.
 * input: '' of 'auto' (zelfde computer als de app, poort 3000), '10.10.10.1', '10.10.10.1:3000', 'pi.local:3443', of een volledige ws(s)://-URL.
 * loc: { protocol, hostname } van de pagina.
 */
export function skUrl(input, loc = { protocol: 'http:', hostname: 'localhost' }) {
  let s = String(input || '').trim();
  const secure = loc.protocol === 'https:';
  if (!s || s.toLowerCase() === 'auto') s = (loc.hostname || 'localhost') + ':' + (secure ? 3443 : 3000);
  if (/^https?:\/\//i.test(s)) s = s.replace(/^http/i, 'ws');
  if (!/^wss?:\/\//i.test(s)) s = (secure ? 'wss://' : 'ws://') + s;
  const u = s.replace(/\/+$/, '');
  if (/\/signalk\/v1\/stream/.test(u)) return u.includes('subscribe=') ? u : u + (u.includes('?') ? '&' : '?') + 'subscribe=none';
  return u + '/signalk/v1/stream?subscribe=none';
}
/** Wordt deze verbinding door de browser geblokkeerd (onbeveiligde ws:// vanaf een https-pagina)? */
export const mixedBlocked = (url, loc) => loc && loc.protocol === 'https:' && /^ws:\/\//i.test(url) && !/^ws:\/\/(localhost|127\.0\.0\.1)(:|\/)/i.test(url);

/** Een delta-bericht verwerken in de toestand S ({pad: {v, t}}). Geeft het aantal bijgewerkte waarden. */
export function applyDelta(S, msg, now = Date.now()) {
  if (!msg || !Array.isArray(msg.updates)) return 0;
  // alleen het eigen schip (S.__self uit het welkomstbericht); andere schepen komen bv. via AIS binnen
  if (msg.context && msg.context !== 'vessels.self' && S.__self && msg.context !== S.__self) return 0;
  let n = 0;
  for (const u of msg.updates) {
    if (!u || !Array.isArray(u.values)) continue;
    const t = u.timestamp ? Date.parse(u.timestamp) : now;
    for (const { path, value } of u.values) { if (!path || value == null) continue; S[path] = { v: value, t: isFinite(t) ? Math.min(t, now) : now, rx: now }; n++; }
  }
  return n;
}

/** Ware wind uit schijnbare wind (aws kn, awa graden, + = stuurboord) en snelheid door het water (stw kn). */
export function trueWind(aws, awa, stw) {
  const a = awa / DEG; const x = aws * Math.cos(a) - stw, y = aws * Math.sin(a);
  return { tws: Math.hypot(x, y), twa: Math.atan2(y, x) * DEG };
}
const norm = d => ((d % 360) + 360) % 360;
const sgn180 = d => { d = norm(d); return d > 180 ? d - 360 : d; };

/**
 * Actuele waarden (knopen, graden) uit de toestand. Waarden ouder dan maxAge ms vallen weg.
 * decl = magnetische variatie in graden (oost +) als reserve voor koers magnetisch → rechtwijzend.
 * twa met teken: + = wind van stuurboord. twd = ware windrichting (waar de wind vandaan komt), rechtwijzend.
 */
export function snapshot(S, now = Date.now(), { maxAge = 5000, decl = 0 } = {}) {
  const g = p => { const e = S[p]; return e && now - e.rx <= maxAge ? e.v : null; };
  const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
  const kn = v => (num(v) == null ? null : v * KN), dg = v => (num(v) == null ? null : v * DEG);
  const o = { aws: kn(g('environment.wind.speedApparent')), awa: dg(g('environment.wind.angleApparent')), stw: kn(g('navigation.speedThroughWater')),
    sog: kn(g('navigation.speedOverGround')), cog: dg(g('navigation.courseOverGroundTrue')), depth: num(g('environment.depth.belowTransducer')) };
  const varn = dg(g('navigation.magneticVariation')); const vr = varn != null ? varn : decl;
  const ht = dg(g('navigation.headingTrue')), hm = dg(g('navigation.headingMagnetic'));
  o.hdg = ht != null ? norm(ht) : hm != null ? norm(hm + vr) : null;
  o.awa = o.awa == null ? null : sgn180(o.awa);
  let tws = kn(g('environment.wind.speedTrue')), twa = dg(g('environment.wind.angleTrueWater'));
  o.twSrc = tws != null && twa != null ? 'sk' : null;
  if (o.twSrc == null && o.aws != null && o.awa != null && o.stw != null) { const w = trueWind(o.aws, o.awa, o.stw); tws = w.tws; twa = w.twa; o.twSrc = 'calc'; }
  o.tws = tws; o.twa = twa == null ? null : sgn180(twa);
  const dT = dg(g('environment.wind.directionTrue')), dM = dg(g('environment.wind.directionMagnetic'));
  // zonder kompaskoers: grondkoers als benadering (op het Grevelingenmeer nauwelijks stroom; drift genegeerd)
  const hd = o.hdg != null ? o.hdg : o.cog != null && o.sog > 1 ? o.cog : null;
  o.twd = dT != null ? norm(dT) : dM != null ? norm(dM + vr) : hd != null && o.twa != null ? norm(hd + o.twa) : null;
  o.twdCog = dT == null && dM == null && o.hdg == null && o.twd != null;
  const pos = g('navigation.position');
  if (pos && num(pos.latitude) != null && num(pos.longitude) != null) { o.lat = pos.latitude; o.lon = pos.longitude; o.posT = S['navigation.position'].t; }
  return o;
}

// ---------- opname: compacte rij per seconde ----------
// [t (s), tws*10, twa (graden met teken), stw*100, hdg, aws*10, awa, twd]
const r = (v, k = 1) => (v == null || !isFinite(v) ? null : Math.round(v * k));
export const packIns = (t, o) => [Math.round(t / 1000), r(o.tws, 10), r(o.twa), r(o.stw, 100), r(o.hdg), r(o.aws, 10), r(o.awa), r(o.twd)];
export function unpackIns(a) {
  const d = (v, k = 1) => (v == null ? null : v / k);
  return (a || []).map(x => ({ t: x[0] * 1000, tws: d(x[1], 10), twa: d(x[2]), stw: d(x[3], 100), hdg: d(x[4]), aws: d(x[5], 10), awa: d(x[6]), twd: d(x[7]) }));
}
/** Dichtstbijzijnde instrumentrij bij tijdstip t (binnen maxDt ms). I = gesorteerd op t. */
export function insAt(I, t, maxDt = 10e3) {
  if (!I || !I.length) return null;
  let lo = 0, hi = I.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (I[m].t < t) lo = m + 1; else hi = m; }
  const c = [I[lo], I[lo - 1]].filter(Boolean).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
  return Math.abs(c.t - t) <= maxDt ? c : null;
}
/** Gemiddelde ware wind over de laatste ms (vectorgemiddelde voor de richting). */
export function meanWind(I, tEnd, ms = 120e3) {
  const R = Math.PI / 180; let sx = 0, sy = 0, sv = 0, n = 0;
  for (const x of I) { if (x.t < tEnd - ms || x.t > tEnd || x.twd == null || x.tws == null) continue; sx += Math.sin(x.twd * R); sy += Math.cos(x.twd * R); sv += x.tws; n++; }
  return n ? { twd: norm(Math.atan2(sx, sy) / R), tws: sv / n, n } : null;
}
