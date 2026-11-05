/* Service worker do Jornal Visão da Fênix: network-first para edicao.json, cache para estáticos. */
const CACHE = 'jvf-v2';
const PRE = ['./', './index.html', './app.js', './fonts.css', './logo.webp', './logo.png', './manifest.webmanifest'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  const path = u.pathname;
  const isEdicao = /\/edicao\.json$/.test(path);
  const isStatic = /\.(?:js|css|woff2|png|webp|jpg|ico|webmanifest|svg)$/.test(path) || /\/(fonts\.css)$/.test(path);
  if (isEdicao) {
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request)));
    return;
  }
  if (isStatic || path.endsWith('/jornal-visao-da-fenix/') || path.endsWith('/jornal-visao-da-fenix/index.html') || /\/index\.html$/.test(path)) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    })));
  }
});
