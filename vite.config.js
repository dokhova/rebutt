import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'es2019', chunkSizeWarningLimit: 900 },
  // Для `npm run dev` без Vercel: проксируем /api на `vercel dev` (порт 3000), если он запущен
  server: { proxy: { '/api': 'http://localhost:3000' } }
});
