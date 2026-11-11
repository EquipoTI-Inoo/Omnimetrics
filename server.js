// Punto de entrada para hosting (Hostinger, etc.).
//
// - Hostinger arranca la app con Passenger, que carga este archivo con require(): por eso no puede
//   tener top-level await (ERR_REQUIRE_ASYNC_MODULE). El servidor se carga con import() sin esperar.
// - En producción se usa el servidor ya compilado a JavaScript por `npm run build` (server/dist).
//   No se compila TypeScript al vuelo: tsx necesita un proceso auxiliar de esbuild que el hosting
//   compartido detiene ("The service was stopped").
// - Si no existe la versión compilada (p. ej. `npm start` sin build), se usa tsx como respaldo.
import fs from 'node:fs';

const compiled = new URL('./server/dist/index.js', import.meta.url);

const start = fs.existsSync(compiled)
    ? import(compiled.href)
    : import('tsx/esm/api').then(({ register }) => {
        register();
        return import('./server/index.ts');
    });

start.catch((err) => {
    console.error('✖ No se pudo iniciar el servidor:', err);
    process.exit(1);
});
