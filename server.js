// Punto de entrada para hosting (Hostinger, etc.): registra tsx y arranca el servidor TypeScript.
import { register } from 'tsx/esm/api';

register();
await import('./server/index.ts');
