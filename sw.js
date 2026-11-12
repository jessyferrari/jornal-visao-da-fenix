/* Service worker Visão da Fênix: network-first para HTML/JS/CSS; cache só como fallback offline. */
const CACHE = 'jvf-202611120149';
const PRE = ['./fonts.css', './logo.webp', './logo.png', './manifest.webmanifest', './index.html', './app.js', './edicao.json'];

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

function networkFirst(req, opts) {
  const fallbackIndex = !!(opts && opts.fallbackIndex);
  const cacheKey = (opts && opts.cacheKey) || null;
  return fetch(req).then((r) => {
    if (r && r.ok && req.method === 'GET') {
      const copy = r.clone();
      caches.open(CACHE).then((c) => {
        if (cacheKey) c.put(cacheKey, copy);
        else c.put(req, copy);
      }).catch(() => {});
    }
    return r;
  }).catch(() => {
    const key = cacheKey || req;
    return caches.match(key, cacheKey ? { ignoreSearch: true } : undefined).then((hit) => {
      if (hit) return hit;
      if (fallbackIndex) return caches.match('./index.html');
      return undefined;
    });
  });
}

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  const path = u.pathname;
  const isNav = e.request.mode === 'navigate';

  // edicao.json: chave estável + ignoreSearch (ignora ?t= do cliente)
  if (/\/edicao\.json$/.test(path)) {
    e.respondWith(networkFirst(e.request, { cacheKey: './edicao.json' }));
    return;
  }

  const isShell =
    isNav ||
    /\/(index\.html)?$/.test(path) ||
    /\/app\.js$/.test(path) ||
    /\/fonts\.css$/.test(path) ||
    /\/sw\.js$/.test(path) ||
    /\.css$/i.test(path);

  if (isShell) {
    // fallback para index.html somente em navegações
    e.respondWith(networkFirst(e.request, { fallbackIndex: isNav }));
    return;
  }

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
