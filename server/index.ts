import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ROOT_DIR, DIST_DIR } from './lib/paths';

// Load .env.local / .env (same files Vite uses) before anything reads process.env
for (const file of ['.env.local', '.env']) {
    const p = path.join(ROOT_DIR, file);
    if (fs.existsSync(p)) process.loadEnvFile(p);
}

const { createSessionToken, verifySessionToken } = await import('./lib/crypto');
const { Store } = await import('./lib/store');
type StoredConnection = import('./lib/store').StoredConnection;
const { Shares, SHARE_PAGES, toPublicShare, isExpired } = await import('./lib/shares');
const { Users, USERNAME_RE, MIN_PASSWORD, normalizeUsername, toPublic } = await import('./lib/users');
type User = import('./lib/users').User;
const { SyncCache } = await import('./lib/syncCache');
const { ApiError } = await import('./lib/http');
const { eachDay } = await import('./lib/dates');
type SeriesPoint = import('./lib/http').SeriesPoint;
const { PLATFORMS, isPlatform, emptyData } = await import('./platforms/index');
const { Meta } = await import('./platforms/meta');
const { oauthRouter } = await import('./oauth');

// PORT lo asigna el hosting (Hostinger); API_PORT es para desarrollo local
const PORT = Number(process.env.PORT || process.env.API_PORT || 4000);
// Primer arranque: si aún no hay usuarios, crea el administrador inicial (con contraseña temporal que debe cambiar)
const createdAdmin = Users.bootstrap();
if (createdAdmin) console.log(`✔ Administrador inicial creado: usuario "${createdAdmin}". Deberá cambiar su contraseña al entrar.`);

const SESSION_COOKIE = 'om_session';
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '100kb' }));

const readCookie = (req: Request, name: string) =>
    req.headers.cookie?.split(';').map(c => c.trim().split('=')).find(([k]) => k === name)?.[1];

const isHttps = (req: Request) => req.secure || req.headers['x-forwarded-proto'] === 'https';

const setSession = (req: Request, res: Response, user: User) =>
    res.cookie(SESSION_COOKIE, createSessionToken(user.id, SESSION_TTL), {
        httpOnly: true, sameSite: 'lax', secure: isHttps(req), maxAge: SESSION_TTL, path: '/',
    });

// --- AUTH ---
const loginAttempts = new Map<string, { count: number; until: number }>();
const isLockedOut = (ip: string) => {
    const a = loginAttempts.get(ip);
    return !!a && a.count >= 5 && a.until > Date.now();
};
const recordFailure = (ip: string) => {
    const a = loginAttempts.get(ip);
    loginAttempts.set(ip, { count: (a && a.until > Date.now() ? a.count : 0) + 1, until: Date.now() + 15 * 60 * 1000 });
};

app.post('/api/auth/login', (req, res) => {
    const ip = req.ip || 'unknown';
    if (isLockedOut(ip)) return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
    const username = normalizeUsername(req.body?.username);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const user = username && password && password.length <= 200 ? Users.verify(username, password) : undefined;
    if (!user) {
        recordFailure(ip);
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }
    loginAttempts.delete(ip);
    setSession(req, res, user);
    res.json({ user: toPublic(user) });
});

app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
});

/**
 * La sesión solo guarda el id: si la cuenta se elimina, pierde el acceso en su siguiente petición.
 * Las sesiones iniciadas antes del último cambio de contraseña dejan de valer.
 */
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const session = verifySessionToken(readCookie(req, SESSION_COOKIE));
    const user = session ? Users.get(session.userId) : undefined;
    const stale = user?.passwordChangedAt && session!.issuedAt < Date.parse(user.passwordChangedAt);
    if (!user || stale) return void res.status(401).json({ error: 'No autenticado.' });
    res.locals.user = user;
    next();
};

const userOf = (res: Response) => res.locals.user as User;

app.get('/api/auth/me', requireAuth, (_req, res) => res.json({ user: toPublic(userOf(res)) }));

// Cambiar la propia contraseña (cualquier cuenta). Mantiene esta sesión y cierra las demás.
app.post('/api/auth/password', requireAuth, (req, res) => {
    const ip = req.ip || 'unknown';
    if (isLockedOut(ip)) throw new ApiError('Demasiados intentos. Espera 15 minutos.', 429);
    const me = userOf(res);
    const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const next = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (!current || current.length > 200 || !Users.verify(me.username, current)) {
        recordFailure(ip);
        throw new ApiError('La contraseña actual no es correcta.');
    }
    if (next.length < MIN_PASSWORD || next.length > 200) throw new ApiError(`La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    if (next === current) throw new ApiError('La nueva contraseña debe ser distinta de la actual.');
    const updated = Users.setPassword(me.id, next)!;
    setSession(req, res, updated);
    res.json({ user: toPublic(updated) });
});

// Todo /api requiere sesión. Una cuenta con contraseña temporal solo puede cambiarla.
// Los clientes solo pueden usar sus enlaces (/shared/... y /my/shares); el resto es de administradores.
const CLIENT_PATHS = (p: string) => p.startsWith('/shared/') || p === '/my/shares';
app.use('/api', (req, res, next) => req.path.startsWith('/auth/') ? next() : requireAuth(req, res, next));
app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth/')) return next();
    const user = userOf(res);
    if (user.mustChangePassword) return void res.status(403).json({ error: 'Debes cambiar tu contraseña antes de continuar.' });
    if (CLIENT_PATHS(req.path) || user.role === 'admin') return next();
    res.status(403).json({ error: 'Tu cuenta no tiene acceso a esta sección.' });
});

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const platformParam = (req: Request) => {
    const id = String(req.params.platform);
    if (!isPlatform(id)) throw new ApiError('Plataforma desconocida.', 404);
    return id;
};

// --- GESTIONAR CUENTAS (solo administradores) ---
app.get('/api/users', (_req, res) => res.json(Users.list().map(toPublic)));

app.post('/api/users', (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = req.body?.role;
    if (!USERNAME_RE.test(username)) throw new ApiError('El usuario debe tener de 3 a 32 caracteres: letras minúsculas, números, punto, guion o guion bajo.');
    if (password.length < MIN_PASSWORD || password.length > 200) throw new ApiError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    if (role !== 'admin' && role !== 'client') throw new ApiError('Elige un tipo de cuenta válido.');
    try {
        res.json(toPublic(Users.create(username, password, role, userOf(res).username)));
    } catch (e: any) {
        throw new ApiError(e.message, 409);
    }
});

app.delete('/api/users/:id', (req, res) => {
    const id = String(req.params.id);
    if (id === userOf(res).id) throw new ApiError('No puedes eliminar tu propia cuenta.');
    const target = Users.get(id);
    if (!target) throw new ApiError('Cuenta no encontrada.', 404);
    Users.remove(id);
    // Los enlaces de un cliente eliminado dejan de existir
    const revokedShares = target.role === 'client' ? Shares.revokeForClient(id) : 0;
    res.json({ ok: true, revokedShares });
});

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
    /** Conexiones a consultar (enlaces compartidos: su copia). Por defecto, las conectadas ahora. */
    connections?: StoredConnection[];
}

/** Consulta todas las plataformas conectadas (con caché por conexión y rango, ver lib/syncCache). */
const buildSync = async (start: string, end: string, opts: SyncOptions = {}) => {
    const { light, force } = opts;
    // Una copia de un enlace nunca actualiza el estado de las conexiones actuales
    const background = opts.background || !!opts.connections;
    const connections = opts.connections ?? Store.list();
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

// --- ENLACES PARA COMPARTIR (administración) ---
app.get('/api/shares', (_req, res) => {
    const names = new Map(Users.list().map(u => [u.id, u.username]));
    res.json(Shares.list().map(s => ({ ...toPublicShare(s), clientUsername: s.clientId ? names.get(s.clientId) : undefined })));
});

app.post('/api/shares', (req, res) => {
    const client = Users.get(String(req.body?.clientId ?? ''));
    if (!client || client.role !== 'client') throw new ApiError('Elige la cuenta de cliente que podrá ver el enlace.');
    // Copia de las cuentas conectadas ahora: el enlace seguirá mostrando estas aunque luego se conecten otras
    const connections = Store.list();
    if (connections.length === 0) throw new ApiError('No hay cuentas conectadas para compartir. Conecta al menos una en Conexiones.');
    const label = String(req.body?.label ?? '').trim().slice(0, 60) || 'Enlace sin nombre';
    const days = req.body?.expiresInDays == null || req.body.expiresInDays === '' ? undefined : Number(req.body.expiresInDays);
    if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 365)) throw new ApiError('La vigencia debe ser de 1 a 365 días.');
    const requested: unknown[] = Array.isArray(req.body?.pages) ? req.body.pages : ['dashboard'];
    // Orden fijo y sin duplicados; cualquier valor desconocido se descarta
    const pages = SHARE_PAGES.filter(p => requested.includes(p));
    if (pages.length === 0) throw new ApiError('Elige al menos una pestaña para compartir.');
    const share = Shares.create({ label, expiresInDays: days, pages, clientId: client.id, connections, createdBy: userOf(res).username });
    res.json({ ...toPublicShare(share), clientUsername: client.username });
});

// Enlaces asignados al cliente que inició sesión (vigentes)
app.get('/api/my/shares', (_req, res) => {
    const me = userOf(res);
    res.json(Shares.list().filter(s => me.role === 'client' && s.clientId === me.id && !isExpired(s))
        .map(s => ({ id: s.id, token: s.token, label: s.label, pages: Shares.pagesOf(s), createdAt: s.createdAt, expiresAt: s.expiresAt })));
});

app.delete('/api/shares/:id', (req, res) => {
    if (!Shares.revoke(String(req.params.id))) throw new ApiError('Enlace no encontrado.', 404);
    res.json({ ok: true });
});

// --- VISTA COMPARTIDA DE SOLO LECTURA (requiere sesión del cliente asignado, o de un administrador) ---
// Solo entrega las métricas. Nunca credenciales, mensajes de error de las plataformas ni ajustes.
const publicHits = new Map<string, { count: number; reset: number }>();
const publicCache = new Map<string, { at: number; body: unknown }>();
const PUBLIC_TTL = 60_000;
const MAX_RANGE_DAYS = 366;

app.get('/api/shared/:token/data', wrap(async (req, res) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' });

    const ip = req.ip || 'unknown';
    const hit = publicHits.get(ip);
    if (!hit || hit.reset < Date.now()) publicHits.set(ip, { count: 1, reset: Date.now() + 60_000 });
    else if (++hit.count > 60) throw new ApiError('Demasiadas solicitudes. Espera un minuto.', 429);

    const share = Shares.find(String(req.params.token));
    if (!share) throw new ApiError('Enlace no válido o vencido.', 404);
    const me = userOf(res);
    if (me.role !== 'admin' && share.clientId !== me.id) throw new ApiError('Este enlace no está asignado a tu cuenta.', 403);

    const { start, end } = parseRange(req);
    if ((Date.parse(end) - Date.parse(start)) / 864e5 > MAX_RANGE_DAYS) throw new ApiError('El rango máximo es de 1 año.');

    // Solo cuentan las visitas del cliente (no las revisiones de un administrador)
    if (me.role === 'client' && (!share.lastViewedAt || Date.now() - Date.parse(share.lastViewedAt) > 30_000)) Shares.touch(share.id);

    // Caché corto por enlace: muchas visitas no multiplican las consultas a Meta/Google
    const shareInfo = { label: share.label, pages: Shares.pagesOf(share) };
    const light = req.query.light === '1';
    const key = `${share.id}|${start}|${end}|${light ? 'L' : 'F'}`;
    const cached = publicCache.get(key);
    if (cached && Date.now() - cached.at < PUBLIC_TTL) return void res.json({ ...(cached.body as object), share: shareInfo });

    // Enlaces antiguos (sin copia de cuentas) muestran las conexiones actuales; solo los abren administradores
    const full = await buildSync(start, end, { background: true, light, connections: share.connections });
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
