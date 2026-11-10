# Correr OmniMetrics en local

1. Abre esta carpeta en VS Code (Archivo > Abrir carpeta).
2. Copia `.env.example` como `.env.local` y define al menos `APP_PASSWORD` (la contraseña para entrar a la app).
3. Terminal > Nueva terminal, y ejecuta:
   npm install
   npm run dev
   (levanta el frontend en :3000 y el backend en :4000 a la vez)
4. Abre http://localhost:3000 e ingresa con tu `APP_PASSWORD`.

La app inicia en Modo Demo (datos de ejemplo). Para usar datos reales: Ajustes > desactiva Modo Demo, y conecta tus fuentes en Conexiones.

## Producción / compartir

   npm run build
   npm start
Sirve todo (app + API) desde http://localhost:4000.

## Backend (carpeta server/)

- Las credenciales se validan contra cada plataforma y se guardan cifradas (AES-256-GCM) en `server/data/connections.enc`.
- La clave de cifrado está en `server/data/secret.key` (o en `ENCRYPTION_KEY`). No la compartas ni la subas a git. Si la pierdes, vuelve a conectar las plataformas.
- Si una plataforma falla por versión de API, cambia `META_API_VERSION`, `GOOGLE_ADS_API_VERSION` o `LINKEDIN_API_VERSION` en `.env.local`.

## Conectar con un clic ("Iniciar sesión con Google / Meta")

Se configura una sola vez. Después, conectar cualquier cuenta es iniciar sesión y elegirla de una lista.
Completa las variables en `.env.local` y reinicia `npm run dev`.

### Google (Google Ads + GA4)
1. https://console.cloud.google.com → crea un proyecto.
2. "APIs y servicios" → Biblioteca → habilita **Google Ads API**, **Google Analytics Data API** y **Google Analytics Admin API**.
3. "Pantalla de consentimiento de OAuth" → tipo **Externo** → completa nombre y correo. En "Usuarios de prueba" agrega los correos que vas a conectar.
4. "Credenciales" → Crear credenciales → **ID de cliente de OAuth** → tipo **Aplicación web**. En "URIs de redirección autorizados" agrega:
   - `http://localhost:3000/api/oauth/google/callback` (con `npm run dev`)
   - `http://localhost:4000/api/oauth/google/callback` (con `npm start`)
5. Copia el ID y el secreto en `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET`.
6. Solo para Google Ads: `GOOGLE_ADS_DEVELOPER_TOKEN` = Google Ads → Herramientas → Centro de API (cuenta MCC). GA4 funciona sin él.

Importante: mientras la app de Google esté en modo "Prueba", Google corta el acceso cada 7 días y hay que volver a conectar.
Para evitarlo, en la pantalla de consentimiento pulsa "Publicar app" (para cuentas de terceros Google pedirá verificarla).

### Meta
1. https://developers.facebook.com/apps → Crear app → caso de uso de anuncios / tipo **Negocio**, vinculada a tu Business Manager.
2. Agrega el producto **Facebook Login for Business** → Configuraciones → crea una configuración de tipo "Token de acceso de usuario" con los permisos `ads_read` y `business_management`. Copia su ID en `META_LOGIN_CONFIG_ID`.
   (Si tu app usa el "Inicio de sesión con Facebook" clásico, deja `META_LOGIN_CONFIG_ID` vacío.)
3. En la configuración del login, en "URI de redireccionamiento de OAuth válidos" agrega `http://localhost:3000/api/oauth/meta/callback` (y la de :4000 si usas `npm start`).
4. Configuración → Básica: copia **Identificador de la app** y **Clave secreta** en `META_APP_ID` y `META_APP_SECRET`.

En modo desarrollo funciona con las cuentas de quienes tengan rol en la app. Para conectar cuentas de terceros, Meta exige verificar el negocio y aprobar `ads_read` (Acceso avanzado).
El acceso de Meta dura ~60 días; la tarjeta en Conexiones avisa cuándo vence para volver a conectar.

Si usas un dominio o túnel, agrega también `https://TU-DOMINIO/api/oauth/google/callback` y `.../meta/callback` en cada consola.

## Qué credenciales pide cada plataforma (conexión manual con token)

| Plataforma | Datos | Dónde se obtienen |
|---|---|---|
| Meta Ads | Access Token | Business Manager > Usuarios del sistema > Generar token (permisos `ads_read`, `business_management`). El token de System User no expira. |
| Google Ads | Client ID, Client Secret, Refresh Token, Developer Token, Customer ID (+ MCC ID si accedes vía cuenta administradora) | Client ID/Secret: Google Cloud Console > Credenciales (OAuth, tipo "Web"). Refresh Token: OAuth Playground con tu Client ID, scope `https://www.googleapis.com/auth/adwords`. Developer Token: Google Ads > Herramientas > Centro de API (requiere aprobación). |
| GA4 | Client ID, Client Secret, Refresh Token, Property ID | Igual que Google Ads, con el scope `https://www.googleapis.com/auth/analytics.readonly` (puedes autorizar ambos scopes en un solo Refresh Token). Activa "Google Analytics Data API" en Cloud Console. |
| LinkedIn Ads | Access Token, Ad Account ID | App en linkedin.com/developers con el producto "Advertising API" aprobado; token con `r_ads` y `r_ads_reporting`. Expira a los 60 días. |
| TikTok Ads | Access Token, Advertiser ID | App en TikTok for Business Developers (Marketing API aprobada); el token se obtiene al autorizar al anunciante. |
| Kommo | Subdominio, Token de larga duración | Kommo > Ajustes > Integraciones > Crear integración (privada) > pestaña Claves > Token de larga duración. |

En el OAuth Playground: engranaje > "Use your own OAuth credentials" y agrega `https://developers.google.com/oauthplayground` como URI de redirección autorizada en tu Client ID.

Para el chat/insights de IA, revisa GEMINI_API_KEY en .env.local.

## Límite de consultas de Meta ("too many calls to this ad-account")

Meta limita cuántas consultas se pueden hacer por cuenta publicitaria por hora. La app ya lo mitiga:
- Reutiliza los datos de cada plataforma durante `SYNC_CACHE_MINUTES` (10 min por defecto). El botón de actualizar solo vuelve a consultar si los datos tienen más de 1 minuto.
- El periodo anterior (los % de comparación) hace una sola consulta a Meta.
- Si Meta bloquea, muestra los últimos datos guardados (insignia "Datos guardados") y espera 5 minutos antes de reintentar.

Si aun así aparece seguido: sube `SYNC_CACHE_MINUTES` a 30–60, y pide en tu app de Meta (developers.facebook.com → Revisión de la app) el **Acceso estándar a Ads Management** (Ads Management Standard Access), que aumenta mucho el límite. Las apps en nivel de desarrollo tienen un límite muy bajo.
