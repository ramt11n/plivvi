import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-codec-isolation',
      configureServer(server) {
        server.middlewares.use(codecHeaders);
      },
      configurePreviewServer(server) {
        server.middlewares.use(codecHeaders);
      },
    },
  ],
  define: {
    __PLIVVI_PUBLIC_CONFIG__: readFileSync(
      new URL('./public/pocket-config.json', import.meta.url),
      'utf8',
    ),
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      input: { main: 'index.html', redirect: 'redirect.html', codec: 'codec.html' },
    },
  },
  optimizeDeps: { exclude: ['mupdf'] },
});

function codecHeaders(req: any, res: any, next: () => void) {
  if (
    /^\/codec(?:\.html|\/)?(?:\?|$)|^\/assets\/heic(?:\.worker|-enc)-.*\.js/.test(req.url || '')
  ) {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  }
  next();
}
