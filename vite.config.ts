import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the static build works from any path (GitHub Pages, Vercel, a subfolder).
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
