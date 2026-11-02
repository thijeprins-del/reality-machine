import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base './' zodat hetzelfde bouwsel werkt onder /reality-machine/ en /reality-machine/dev/.
export default defineConfig({
  base: './',
  // Twee pagina's: het spel en de teaser (teaser/index.html, komt in dist/teaser/).
  build: {
    rollupOptions: {
      input: { spel: resolve(import.meta.dirname, 'index.html'), teaser: resolve(import.meta.dirname, 'teaser/index.html') },
    },
  },
  define: {
    __GAME_ENV__: JSON.stringify(process.env.GAME_ENV ?? ''),
    __BUILD__: JSON.stringify(process.env.BUILD_NUMBER ?? 'lokaal'),
    __COMMIT__: JSON.stringify((process.env.COMMIT ?? '').slice(0, 7)),
  },
});
