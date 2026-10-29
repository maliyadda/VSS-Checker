const C = 'vss-v4', SHELL = ['./', 'index.html', 'app.js', 'calc.js', 'manifest.webmanifest', 'icons/icon-192.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(C).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== C).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url); if (u.origin !== location.origin) return;
  const net = u.pathname.endsWith('.json'); // data: network first so edits arrive; shell: cache first
  e.respondWith(net ? fetch(e.request).then((r) => { const k = r.clone(); caches.open(C).then((c) => c.put(e.request, k)); return r; }).catch(() => caches.match(e.request))
    : caches.match(e.request).then((m) => m || fetch(e.request)));
});
