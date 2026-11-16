'use strict';

// Include the scope in the prefix so another Pages project is never cleared.
const PREFIX = 'ielts-atelier:' + self.registration.scope + ':';
const CACHE = PREFIX + '2026-11-16-v1';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './core.js', './questions.js',
  './sources.js', './icon.svg', './icon-192.png', './icon-512.png',
  './manifest.webmanifest', './question-template.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  // The updated worker activates after the old tabs close, avoiding a forced reload.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(event.request, { cache: 'no-cache', signal: controller.signal });
      // Prefer fresh network content; only cache successful same-origin resources.
      if (response.ok && response.type === 'basic') await cache.put(event.request, response.clone()).catch(() => {});
      if (response.status >= 500) throw new Error('Server unavailable');
      return response;
    } catch {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      return new Response('此内容尚未离线缓存，请联网后重试。', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    } finally { clearTimeout(timeout); }
  })());
});
