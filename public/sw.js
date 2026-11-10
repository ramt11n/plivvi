const CACHE = 'plivvi-v4-8-0';
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE),
        response = await fetch('/', { cache: 'reload' });
      if (!response.ok) throw Error('App shell unavailable');
      const html = await response.clone().text();
      const assets = [
        ...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css|svg|png|webmanifest)(?:\?[^"#]*)?)"/g),
      ]
        .map((m) => m[1])
        .filter((p) => p.startsWith('/'));
      await cache.addAll([...new Set(['/icon.svg', '/manifest.webmanifest', ...assets])]);
      await cache.put('/', response);
      // Updated workers wait until the visitor explicitly applies the update.
    })(),
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'APPLY_UPDATE') self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = (await caches.keys()).filter(
        (k) => k.startsWith('plivvi-') || k.startsWith('pocket-'),
      );
      const previous = keys.filter((k) => k !== CACHE).at(-1);
      await Promise.all(
        keys.filter((k) => k !== CACHE && k !== previous).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    /^\/(?:api|cdn-cgi)\//.test(url.pathname) ||
    /^\/(?:redirect(?:\.html)?|auth\/callback)\/?$/.test(url.pathname) ||
    url.searchParams.has('code') ||
    url.searchParams.has('access_token') ||
    ['/version.json', '/pocket-config.json', '/source.zip', '/redirect.html', '/redirect'].includes(
      url.pathname,
    )
  )
    return;
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const controller = new AbortController(),
          timer = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch(request, { signal: controller.signal });
          if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
            const cache = await caches.open(CACHE);
            await cache.put(url.pathname === '/' ? '/' : request, response.clone());
          }
          return response;
        } catch {
          return (
            (await caches.match(request)) ||
            (await caches.match('/')) ||
            new Response('Open Plivvi online once to prepare offline use.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          );
        } finally {
          clearTimeout(timer);
        }
      })(),
    );
    return;
  }
  const cacheable =
    /^\/(?:assets|fonts|ocr|visuals|logos)\//.test(url.pathname) ||
    /^\/(?:icon.*\.(?:svg|png)|manifest.webmanifest)$/.test(url.pathname);
  if (!cacheable) return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
