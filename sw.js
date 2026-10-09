// Wintercup banenkaart - service worker: app altijd eerst vers van het netwerk, offline de laatst opgeslagen versie.
// Kaarttegels (PDOK) worden bewaard zodra ze bekeken zijn, zodat de kaart ook zonder bereik werkt.
const CACHE = 'wintercup-v12';
const TILES = 'wintercup-tiles';
const MAX_TILES = 4000;
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function trimTiles() {
  const c = await caches.open(TILES); const keys = await c.keys();
  if (keys.length > MAX_TILES) for (const k of keys.slice(0, keys.length - MAX_TILES)) await c.delete(k);
}
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
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
