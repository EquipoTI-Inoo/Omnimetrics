// Punto de entrada para hosting (Hostinger, etc.): registra tsx y arranca el servidor TypeScript.
// Hostinger arranca la app con Passenger, que carga este archivo con require(): por eso no puede
// tener top-level await (ERR_REQUIRE_ASYNC_MODULE). El servidor se carga con import() sin esperar.
import { register } from 'tsx/esm/api';

register();
import('./server/index.ts').catch((err) => {
    console.error('✖ No se pudo iniciar el servidor:', err);
    process.exit(1);
});
