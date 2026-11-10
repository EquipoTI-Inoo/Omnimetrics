import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiPort = env.API_PORT || '4000';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // El frontend (:3000) habla con el backend Express (:4000) a través de /api.
        // Sin changeOrigin el header Host se conserva (localhost:3000), que es lo que
        // el backend usa para armar la URL de retorno de OAuth.
        proxy: {
          '/api': { target: `http://localhost:${apiPort}`, changeOrigin: false },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
