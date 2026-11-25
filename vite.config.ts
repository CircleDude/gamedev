import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

// Версия — единственный источник правды: package.json.
// Подставляется в код константой __APP_VERSION__ (см. src/game/version.ts).
const APP_VERSION = pkg.version;
// Дата сборки фиксируется при запуске dev-сервера или сборке (ISO, YYYY-MM-DD).
const BUILD_DATE = new Date().toISOString().slice(0, 10);

export default defineConfig({
  // Relative asset paths make the build work both at a custom domain
  // and at https://username.github.io/repository-name/.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_BUILD_DATE__: JSON.stringify(BUILD_DATE),
  },
  server: {
    host: true,
  },
});
