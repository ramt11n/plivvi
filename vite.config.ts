import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
export default defineConfig({
  plugins: [react()],
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
    rollupOptions: { input: { main: 'index.html', redirect: 'redirect.html' } },
  },
  optimizeDeps: { exclude: ['mupdf'] },
});
