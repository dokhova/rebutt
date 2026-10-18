import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2019', chunkSizeWarningLimit: 900 },
  // `npm run dev` поднимает только фронт; /api проксируется на `vercel dev` (порт 3000), если он запущен
  server: { proxy: { '/api': 'http://localhost:3000' } }
});
