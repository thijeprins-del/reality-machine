import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Version per push/PR, e.g. v100t (Thije) or v101l (Lieuwe). Rules: CLAUDE.md, "Versie".
const VERSIE = readFileSync(resolve(import.meta.dirname, 'VERSIE'), 'utf8').trim();

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
    __VERSIE__: JSON.stringify(VERSIE),
    __GAME_ENV__: JSON.stringify(process.env.GAME_ENV ?? ''),
    __BUILD__: JSON.stringify(process.env.BUILD_NUMBER ?? 'lokaal'),
    __COMMIT__: JSON.stringify((process.env.COMMIT ?? '').slice(0, 7)),
  },
});
