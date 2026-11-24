# OmniMetrics

Panel de métricas publicitarias: reúne Meta Ads, Google Ads, GA4, LinkedIn Ads, TikTok Ads y Kommo en un solo lugar, con reportes, enlaces compartidos para clientes, constructor de widgets personalizados e insights con IA (Gemini).

- **Frontend:** React 19 + TypeScript + Vite (`components/`, `context/`, `services/`).
- **Backend:** Express 5 + TypeScript (`server/`). Valida y guarda cifradas las credenciales de cada plataforma, maneja el OAuth de Google y Meta, usuarios y enlaces compartidos.
- **Despliegue:** `server.js` es el punto de entrada para hosting con Passenger (Hostinger); usa el servidor compilado en `server/dist`.

## Correr en local

Requiere Node.js 22 o superior.

```bash
npm install
cp .env.example .env.local   # completa las claves de las plataformas que uses
npm run dev                  # frontend en :3000 y backend en :4000
```

Abre http://localhost:3000. La app inicia en Modo Demo con datos de ejemplo; para datos reales, desactívalo en Ajustes y conecta tus fuentes en Conexiones.

## Producción

```bash
npm run build   # compila el frontend y el servidor (server/dist)
npm start       # sirve app + API desde http://localhost:4000
```

## Documentación

[LEEME-LOCAL.md](LEEME-LOCAL.md) tiene la guía completa: acceso inicial, carpeta de datos y clave de cifrado, configuración de OAuth (Google, Meta), credenciales por plataforma y cómo evitar el límite de consultas de Meta. Todas las variables de entorno están comentadas en [.env.example](.env.example).
