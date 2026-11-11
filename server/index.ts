import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ROOT_DIR, DIST_DIR } from './lib/paths';

// Load .env.local / .env (same files Vite uses) before anything reads process.env
for (const file of ['.env.local', '.env']) {
    const p = path.join(ROOT_DIR, file);
    if (fs.existsSync(p)) process.loadEnvFile(p);
}

const { createSessionToken, verifySessionToken, safeEqual } = await import('./lib/crypto');
const { Store } = await import('./lib/store');
const { Shares, SHARE_PAGES } = await import('./lib/shares');
const { SyncCache } = await import('./lib/syncCache');
const { ApiError } = await import('./lib/http');
const { eachDay } = await import('./lib/dates');
type SeriesPoint = import('./lib/http').SeriesPoint;
const { PLATFORMS, isPlatform, emptyData } = await import('./platforms/index');
const { Meta } = await import('./platforms/meta');
const { oauthRouter } = await import('./oauth');

// PORT lo asigna el hosting (Hostinger); API_PORT es para desarrollo local
const PORT = Number(process.env.PORT || process.env.API_PORT || 4000);
const APP_PASSWORD = process.env.APP_PASSWORD;
if (!APP_PASSWORD) {
    console.error('\n✖ Falta APP_PASSWORD. Agrega una línea "APP_PASSWORD=tu-contraseña" en .env.local y reinicia.\n');
    process.exit(1);
}

const SESSION_COOKIE = 'om_session';
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '100kb' }));

const readCookie = (req: Request, name: string) =>
    req.headers.cookie?.split(';').map(c => c.trim().split('=')).find(([k]) => k === name)?.[1];

const isHttps = (req: Request) => req.secure || req.headers['x-forwarded-proto'] === 'https';

// --- AUTH ---
const loginAttempts = new Map<string, { count: number; until: number }>();

app.post('/api/auth/login', (req, res) => {
    const ip = req.ip || 'unknown';
    const attempt = loginAttempts.get(ip);
    if (attempt && attempt.count >= 5 && attempt.until > Date.now()) {
        return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
    }
    if (typeof req.body?.password !== 'string' || !safeEqual(req.body.password, APP_PASSWORD)) {
        const count = (attempt && attempt.until > Date.now() ? attempt.count : 0) + 1;
        loginAttempts.set(ip, { count, until: Date.now() + 15 * 60 * 1000 });
        return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }
    loginAttempts.delete(ip);
    res.cookie(SESSION_COOKIE, createSessionToken(SESSION_TTL), {
        httpOnly: true, sameSite: 'lax', secure: isHttps(req), maxAge: SESSION_TTL, path: '/',
    });
    res.json({ ok: true });
});

app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
});

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (verifySessionToken(readCookie(req, SESSION_COOKIE))) return next();
    res.status(401).json({ error: 'No autenticado.' });
};

app.get('/api/auth/me', requireAuth, (_req, res) => res.json({ ok: true }));
app.use('/api', (req, res, next) => req.path.startsWith('/auth/') || req.path.startsWith('/public/') ? next() : requireAuth(req, res, next));

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const platformParam = (req: Request) => {
    const id = String(req.params.platform);
    if (!isPlatform(id)) throw new ApiError('Plataforma desconocida.', 404);
    return id;
};

// --- OAUTH ("Conectar con Google / Meta") ---
app.use('/api/oauth', oauthRouter);

// --- CONNECTIONS ---
app.get('/api/connections', (_req, res) => {
    res.json(Store.list().map(({ platform, info, connectedAt, lastSync, lastError }) => ({ platform, info, connectedAt, lastSync, lastError })));
});

app.post('/api/connections/:platform', wrap(async (req, res) => {
    const platform = platformParam(req);
    const input = Object.fromEntries(Object.entries(req.body || {}).map(([k, v]) => [k, String(v ?? '')]));
    const { credentials, info } = await PLATFORMS[platform].connect(input);
    Store.save({ platform, credentials, info, connectedAt: new Date().toISOString() });
    SyncCache.clear(`${platform}|`);
    res.json({ platform, info });
}));

app.delete('/api/connections/:platform', (req, res) => {
    const platform = platformParam(req);
    Store.remove(platform);
    SyncCache.clear(`${platform}|`);
    res.json({ ok: true });
});

// Meta connection wizard: list businesses / ad accounts for a token before saving it
app.post('/api/meta/businesses', wrap(async (req, res) => {
    if (!req.body?.token) throw new ApiError('Token requerido.');
    res.json(await Meta.listBusinesses(String(req.body.token).trim()));
}));

app.post('/api/meta/adaccounts', wrap(async (req, res) => {
    if (!req.body?.token) throw new ApiError('Token requerido.');
    res.json(await Meta.listAdAccounts(String(req.body.token).trim(), req.body.businessId || undefined));
}));

// --- DATA ---
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const parseRange = (req: Request) => {
    const start = String(req.query.start || ''), end = String(req.query.end || '');
    if (!ISO_DATE.test(start) || !ISO_DATE.test(end) || start > end) throw new ApiError('Rango de fechas inválido (YYYY-MM-DD).');
    return { start, end };
};

interface SyncOptions {
    /** No toca el estado de sincronización de cada conexión */
    background?: boolean;
    /** Solo lo necesario para los % de comparación (periodo anterior) */
    light?: boolean;
    /** Botón "Actualizar": ignora la caché si tiene más de 1 minuto */
    force?: boolean;
}

/** Consulta todas las plataformas conectadas (con caché por conexión y rango, ver lib/syncCache). */
const buildSync = async (start: string, end: string, opts: SyncOptions = {}) => {
    const { background, light, force } = opts;
    const connections = Store.list();
    const data: Record<string, unknown> = emptyData();
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    const series: SeriesPoint[] = [];

    await Promise.all(connections.map(async (conn) => {
        try {
            const scope = `${conn.platform}|${conn.connectedAt}`;
            const { value, staleWarning } = await SyncCache.get(scope, `${scope}|${start}|${end}|${light ? 'L' : 'F'}`,
                () => PLATFORMS[conn.platform].fetch(conn.credentials, { start, end }, { light }), { force });
            const { series: platformSeries, ...partial } = value;
            Object.assign(data, partial);
            series.push(...((platformSeries as SeriesPoint[]) || []));
            if (staleWarning) warnings[conn.platform] = staleWarning;
            else if (!background) Store.update(conn.platform, { lastSync: new Date().toISOString(), lastError: undefined });
        } catch (e: any) {
            errors[conn.platform] = e.message || 'Error desconocido';
            if (!background) Store.update(conn.platform, { lastError: errors[conn.platform] });
            console.error(`[sync:${conn.platform}]`, e.message);
        }
    }));

    // Daily trend across platforms. Revenue follows the dashboard rule: GA4 site revenue when available, else ad-reported value.
    const byDay = new Map(eachDay(start, end).map(d => [d, { spend: 0, revenue: 0, siteRevenue: 0, impressions: 0, clicks: 0, conversions: 0 }]));
    for (const p of series) {
        const day = byDay.get(p.date);
        if (!day) continue;
        day.spend += p.spend || 0;
        day.revenue += p.revenue || 0;
        day.siteRevenue += p.siteRevenue || 0;
        day.impressions += p.impressions || 0;
        day.clicks += p.clicks || 0;
        day.conversions += p.conversions || 0;
    }
    const useSite = [...byDay.values()].some(d => d.siteRevenue > 0);
    data.trend = [...byDay.entries()].map(([date, d]) => ({
        date, spend: +d.spend.toFixed(2), revenue: +(useSite ? d.siteRevenue : d.revenue).toFixed(2),
        impressions: d.impressions, clicks: d.clicks, conversions: +d.conversions.toFixed(2),
    }));

    return { data, errors, warnings, connected: connections.map(c => c.platform), syncedAt: new Date().toISOString() };
};

app.get('/api/data', wrap(async (req, res) => {
    const { start, end } = parseRange(req);
    const background = req.query.background === '1';
    res.json(await buildSync(start, end, { background, light: background, force: req.query.fresh === '1' }));
}));

// --- ENLACES PARA COMPARTIR (administración: requiere sesión) ---
app.get('/api/shares', (_req, res) => res.json(Shares.list()));

app.post('/api/shares', (req, res) => {
    const label = String(req.body?.label ?? '').trim().slice(0, 60) || 'Enlace sin nombre';
    const days = req.body?.expiresInDays == null || req.body.expiresInDays === '' ? undefined : Number(req.body.expiresInDays);
    if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 365)) throw new ApiError('La vigencia debe ser de 1 a 365 días.');
    const requested: unknown[] = Array.isArray(req.body?.pages) ? req.body.pages : ['dashboard'];
    // Orden fijo y sin duplicados; cualquier valor desconocido se descarta
    const pages = SHARE_PAGES.filter(p => requested.includes(p));
    if (pages.length === 0) throw new ApiError('Elige al menos una pestaña para compartir.');
    res.json(Shares.create(label, days, pages));
});

app.delete('/api/shares/:id', (req, res) => {
    if (!Shares.revoke(String(req.params.id))) throw new ApiError('Enlace no encontrado.', 404);
    res.json({ ok: true });
});

// --- VISTA PÚBLICA DE SOLO LECTURA (sin sesión: la protege el token del enlace) ---
// Solo entrega las métricas del dashboard. Nunca credenciales, mensajes de error de las plataformas ni ajustes.
const publicHits = new Map<string, { count: number; reset: number }>();
const publicCache = new Map<string, { at: number; body: unknown }>();
const PUBLIC_TTL = 60_000;
const MAX_RANGE_DAYS = 366;

app.get('/api/public/:token/data', wrap(async (req, res) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' });

    const ip = req.ip || 'unknown';
    const hit = publicHits.get(ip);
    if (!hit || hit.reset < Date.now()) publicHits.set(ip, { count: 1, reset: Date.now() + 60_000 });
    else if (++hit.count > 60) throw new ApiError('Demasiadas solicitudes. Espera un minuto.', 429);

    const share = Shares.find(String(req.params.token));
    if (!share) throw new ApiError('Enlace no válido o vencido.', 404);

    const { start, end } = parseRange(req);
    if ((Date.parse(end) - Date.parse(start)) / 864e5 > MAX_RANGE_DAYS) throw new ApiError('El rango máximo es de 1 año.');

    if (!share.lastViewedAt || Date.now() - Date.parse(share.lastViewedAt) > 30_000) Shares.touch(share.id);

    // Caché corto: muchas visitas al mismo link no multiplican las consultas a Meta/Google
    // La caché es por rango (compartida entre enlaces): los datos propios del enlace se agregan después
    const shareInfo = { label: share.label, pages: Shares.pagesOf(share) };
    const light = req.query.light === '1';
    const key = `${start}|${end}|${light ? 'L' : 'F'}`;
    const cached = publicCache.get(key);
    if (cached && Date.now() - cached.at < PUBLIC_TTL) return void res.json({ ...(cached.body as object), share: shareInfo });

    const full = await buildSync(start, end, { background: true, light });
    const body = {
        data: full.data,
        connected: full.connected,
        // Solo se indica qué fuentes fallaron, sin el detalle técnico
        errors: Object.fromEntries(Object.keys(full.errors).map(p => [p, 'No disponible por ahora.'])),
        warnings: Object.fromEntries(Object.keys(full.warnings).map(p => [p, 'Mostrando los últimos datos disponibles.'])),
        syncedAt: full.syncedAt,
    };
    publicCache.set(key, { at: Date.now(), body });
    if (publicCache.size > 200) publicCache.delete(publicCache.keys().next().value!);
    res.json({ ...body, share: shareInfo });
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// La página compartida no debe indexarse ni filtrar el token por el header Referer
app.use('/ver', (_req, res, next) => { res.set({ 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' }); next(); });

// --- STATIC FRONTEND (production: after `npm run build`) ---
if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err instanceof ApiError ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Error interno.' });
});

app.listen(PORT, () => console.log(`✔ OmniMetrics API en http://localhost:${PORT}`));
