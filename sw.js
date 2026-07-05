const VERSION = 'gymapp-v5';
const EX_IMGS = ['goblet-squat', 'flat-db-bench', 'bent-row', 'shoulder-press', 'bicep-curls', 'tricep-ext',
  'rdl', 'incline-bench', 'assisted-pullup', 'lateral-raises', 'hammer-curls', 'skull-crushers',
  'bulgarian-split', 'bench-variation', 'single-arm-row', 'face-pulls', 'walking-lunges', 'hanging-leg-raises']
  .map(n => './img/' + n + '.jpg');
const SHELL = ['./', './index.html', './app.css', './app.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', ...EX_IMGS];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Stale-while-revalidate for same-origin: instant offline load, silent background refresh.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request).then(resp => {
        if (resp && resp.ok) cache.put(e.request, resp.clone());
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
