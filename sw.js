/* Service worker Visão da Fênix: network-first para HTML/JS/CSS; cache só como fallback offline. */
const CACHE = 'jvf-202611060134';
const PRE = ['./fonts.css', './logo.webp', './logo.png', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRE).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req) {
  return fetch(req).then((r) => {
    if (r && r.ok && (req.method === 'GET')) {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
    }
    return r;
  }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')));
}

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  const path = u.pathname;
  const accept = e.request.headers.get('accept') || '';
  const isNav = e.request.mode === 'navigate' || accept.includes('text/html');
  const isShell =
    isNav ||
    /\/(index\.html)?$/.test(path) ||
    /\/app\.js$/.test(path) ||
    /\/fonts\.css$/.test(path) ||
    /\/sw\.js$/.test(path) ||
    /\.css$/i.test(path) ||
    /\/edicao\.json$/.test(path);
  if (isShell) {
    e.respondWith(networkFirst(e.request));
    return;
  }
  // imagens/fontes: cache-first com atualização em segundo plano
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const fresh = fetch(e.request).then((r) => {
        if (r && r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return r;
      }).catch(() => hit);
      return hit || fresh;
    })
  );
});
