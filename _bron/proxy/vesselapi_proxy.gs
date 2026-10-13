// Proxy voor VesselAPI (Google Apps Script) — voor de Wintercup-app, tab Post Race Analyses.
// VesselAPI staat aanvragen rechtstreeks vanuit de browser niet toe; dit script haalt de AIS-posities op
// en geeft ze door aan de app. De API-sleutel staat alleen hier (Projectinstellingen › Scripteigenschappen › VESSELAPI_KEY).
// Aanroep: <web-app-URL>?mmsi=244001631&day=2026-10-11  →  {positions:[{latitude,longitude,timestamp,sog,cog}], pages}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const mmsi = String(p.mmsi || '').replace(/\D/g, '');
  const day = String(p.day || '');
  if (!/^\d{9}$/.test(mmsi) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return out({ error: 'mmsi (9 cijfers) en day (JJJJ-MM-DD) nodig' });
  const key = PropertiesService.getScriptProperties().getProperty('VESSELAPI_KEY');
  if (!key) return out({ error: 'Scripteigenschap VESSELAPI_KEY ontbreekt' });

  // racedag 06:00–20:00 Nederlandse tijd, als UTC
  const tz = 'Europe/Amsterdam';
  const from = Utilities.formatDate(Utilities.parseDate(day + ' 06:00', tz, 'yyyy-MM-dd HH:mm'), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
  const to = Utilities.formatDate(Utilities.parseDate(day + ' 20:00', tz, 'yyyy-MM-dd HH:mm'), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");

  let next = null, pages = 0; const positions = [];
  do {
    let url = 'https://api.vesselapi.com/v1/vessels/positions?filter.ids=' + mmsi + '&filter.idType=mmsi'
      + '&time.from=' + encodeURIComponent(from) + '&time.to=' + encodeURIComponent(to) + '&pagination.limit=50';
    if (next) url += '&pagination.nextToken=' + encodeURIComponent(next);
    const r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });
    const code = r.getResponseCode(); let j = null;
    try { j = JSON.parse(r.getContentText()); } catch (err) {}
    if (code !== 200) return out({ error: 'VesselAPI HTTP ' + code + ': ' + (j && (j.message || (j.error && (j.error.message || j.error))) || r.getContentText().slice(0, 200)), pages: pages, positions: positions });
    collect(j, positions);
    next = findNext(j); pages++;
  } while (next && pages < 40);
  return out({ mmsi: mmsi, day: day, from: from, to: to, pages: pages, positions: positions });
}

// alle objecten met latitude/longitude uit het antwoord halen, wat de verpakking ook is
function collect(v, acc) {
  if (!v || typeof v !== 'object') return;
  if (Array.isArray(v)) { v.forEach(function (x) { collect(x, acc); }); return; }
  const la = v.latitude != null ? v.latitude : v.lat, lo = v.longitude != null ? v.longitude : (v.lon != null ? v.lon : v.lng);
  if (la != null && lo != null) { acc.push({ latitude: +la, longitude: +lo, timestamp: v.timestamp || v.time || v.processed_timestamp, sog: v.sog, cog: v.cog }); return; }
  Object.keys(v).forEach(function (k) { collect(v[k], acc); });
}
function findNext(v, d) {
  d = d || 0; if (!v || typeof v !== 'object' || d > 4) return null;
  for (const k of Object.keys(v)) { if (/^next_?token$/i.test(k) && v[k]) return v[k]; const n = findNext(v[k], d + 1); if (n) return n; }
  return null;
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
