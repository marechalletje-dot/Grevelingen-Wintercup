// Wintercup banenkaart - service worker.
// index.html: altijd eerst vers van het netwerk. App, kaartdata, luchtfoto en PDF-module hebben een vaste naam per versie
// en worden maar één keer gedownload en daarna uit de cache gebruikt. Kaarttegels (PDOK) worden bewaard zodra ze bekeken zijn.
const VER = '43b122f2';
const CACHE = 'wintercup-' + VER;
const ASSETS_CACHE = 'wintercup-assets';
const TILES = 'wintercup-tiles';
const MAX_TILES = 4000;
const ASSETS = ["app.2075b007.js", "data.f884bc41.json", "aerial.45820b3e.jpg", "jspdf.umd.min.js"];
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const isAsset = p => ASSETS.some(a => p.endsWith('/' + a));
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== TILES && k !== ASSETS_CACHE) await caches.delete(k);
    const ac = await caches.open(ASSETS_CACHE);
    for (const r of await ac.keys()) if (!isAsset(new URL(r.url).pathname)) await ac.delete(r);
    await self.clients.claim();
  })());
});
async function trimTiles() {
  const c = await caches.open(TILES); const keys = await c.keys();
  if (keys.length > MAX_TILES) for (const k of keys.slice(0, keys.length - MAX_TILES)) await c.delete(k);
}
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin && isAsset(u.pathname)) {
    e.respondWith(caches.open(ASSETS_CACHE).then(c => c.match(u.pathname).then(m => m || fetch(r).then(res => {
      if (res.ok) c.put(u.pathname, res.clone());
      return res;
    }))));
  } else if (u.origin === location.origin) {
    e.respondWith(
      fetch(r, { cache: 'no-cache' }).then(res => {
        if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(u.pathname.endsWith('/') ? './' : r, cp)); }
        return res;
      }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('./')))
    );
  } else if (u.hostname === 'service.pdok.nl') {
    e.respondWith(caches.open(TILES).then(c => c.match(r).then(m => m || fetch(r).then(res => {
      if (res.ok || res.type === 'opaque') { c.put(r, res.clone()); if (Math.random() < 0.02) trimTiles(); }
      return res;
    }))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; })));
  }
});
