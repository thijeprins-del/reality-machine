import { defineConfig } from 'vite';

// base './' zodat hetzelfde bouwsel werkt onder /reality-machine/ en /reality-machine/dev/.
export default defineConfig({
  base: './',
  define: {
    __GAME_ENV__: JSON.stringify(process.env.GAME_ENV ?? ''),
    __BUILD__: JSON.stringify(process.env.BUILD_NUMBER ?? 'lokaal'),
    __COMMIT__: JSON.stringify((process.env.COMMIT ?? '').slice(0, 7)),
  },
});
