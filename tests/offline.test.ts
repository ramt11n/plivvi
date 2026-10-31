import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
describe('offline shell', () => {
  it('precaches shell assets and serves the cached app when the network fails', async () => {
    const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
    const entries = new Map<string, Response>(),
      handlers: Record<string, Function> = {},
      added: string[] = [];
    let online = true,
      claimed = false;
    const cache = {
      put: async (key: any, value: Response) => {
        entries.set(typeof key === 'string' ? key : new URL(key.url).pathname, value);
      },
      addAll: async (urls: string[]) => {
        added.push(...urls);
      },
    };
    const self = {
      location: { origin: 'https://pocket.test' },
      addEventListener: (name: string, fn: Function) => (handlers[name] = fn),
      skipWaiting: async () => {},
      clients: {
        claim: async () => {
          claimed = true;
        },
      },
    };
    vm.runInNewContext(source, {
      self,
      URL,
      Set,
      Promise,
      AbortController,
      setTimeout,
      clearTimeout,
      Response,
      caches: {
        open: async () => cache,
        keys: async () => ['pocket-v0', 'pocket-v2'],
        delete: async () => true,
        match: async (key: any) =>
          entries.get(typeof key === 'string' ? key : new URL(key.url).pathname),
      },
      fetch: async () => {
        if (!online) throw Error('offline');
        return new Response(
          '<link href="/assets/app.css"><script src="/assets/app.js"></script><h1>Pocket</h1>',
          { headers: { 'content-type': 'text/html' } },
        );
      },
    });
    let pending: Promise<any> = Promise.resolve();
    handlers.install({ waitUntil: (p: Promise<any>) => (pending = p) });
    await pending;
    expect(added).toEqual(
      expect.arrayContaining([
        '/icon.svg',
        '/manifest.webmanifest',
        '/assets/app.css',
        '/assets/app.js',
      ]),
    );
    handlers.activate({ waitUntil: (p: Promise<any>) => (pending = p) });
    await pending;
    expect(claimed).toBe(true);
    online = false;
    let result: Promise<Response> = Promise.resolve(new Response());
    handlers.fetch({
      request: { method: 'GET', url: 'https://pocket.test/', mode: 'navigate' },
      respondWith: (p: Promise<Response>) => (result = p),
    });
    expect(await (await result).text()).toContain('<h1>Pocket</h1>');
    let intercepted = false;
    for (const path of [
      '/redirect.html',
      '/redirect',
      '/redirect/',
      '/redirect?code=synthetic',
      '/pocket-config.json',
      '/auth/callback/',
    ])
      handlers.fetch({
        request: { method: 'GET', url: 'https://pocket.test' + path, mode: 'navigate' },
        respondWith: () => (intercepted = true),
      });
    expect(intercepted).toBe(false);
  });
});
