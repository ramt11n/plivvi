const CACHE = 'pocket-v3-2';
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE),
        response = await fetch('/'),
        html = await response.clone().text();
      if (!response.ok) throw Error('App shell unavailable');
      await cache.put('/', response);
      const assets = [...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css|svg|png|webmanifest))"/g)]
        .map((m) => m[1])
        .filter((p) => p.startsWith('/'));
      await cache.addAll([
        ...new Set([
          '/icon.svg',
          '/icon-192.png',
          '/icon-512.png',
          '/manifest.webmanifest',
          ...assets,
        ]),
      ]);
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('pocket-') && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.includes('/cdn-cgi/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    /^\/redirect(?:\.html)?\/?$/.test(url.pathname) ||
    ['/pocket-config.json', '/source.zip'].includes(url.pathname)
  )
    return;
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const controller = new AbortController(),
          timer = setTimeout(() => controller.abort(), 3500);
        try {
          const response = await fetch(request, { signal: controller.signal });
          if (
            response.ok &&
            response.type === 'basic' &&
            response.headers.get('content-type')?.includes('text/html')
          ) {
            const cache = await caches.open(CACHE);
            await cache.put(url.pathname === '/' ? '/' : request, response.clone());
          }
          return response;
        } catch {
          const cached = (await caches.match(request)) || (await caches.match('/'));
          return (
            cached ||
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
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
