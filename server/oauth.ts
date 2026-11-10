import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { ApiError, fetchJson } from './lib/http';
import { Store } from './lib/store';
import { PLATFORMS } from './platforms/index';
import { Meta } from './platforms/meta';
import { gaql, ADS_VERSION } from './platforms/google';

/**
 * "Conectar con un clic": OAuth 2.0 (authorization code) para Meta y Google (Ads + GA4).
 *
 *  GET  /api/oauth/providers                  -> qué proveedores están configurados en .env.local
 *  GET  /api/oauth/:provider/start?target=…   -> redirige al login del proveedor (meta | google)
 *  GET  /api/oauth/:provider/callback         -> el proveedor vuelve aquí; guarda los tokens en memoria (grant)
 *                                                y redirige a /?oauth_target=…&oauth_grant=… (o &oauth_error=…)
 *  GET  /api/oauth/grants/:grant/accounts     -> cuentas/propiedades a las que da acceso ese login
 *  POST /api/oauth/grants/:grant/connect      -> valida la cuenta elegida y la guarda cifrada (Store)
 *
 * Los tokens nunca viajan al navegador: el "grant" es solo un id opaco de corta vida.
 */

type Target = 'meta' | 'google' | 'ga4';
const isTarget = (v: unknown): v is Target => v === 'meta' || v === 'google' || v === 'ga4';
const providerOf = (t: Target): 'meta' | 'google' => (t === 'meta' ? 'meta' : 'google');

interface Account { id: string; name: string; group?: string; loginCustomerId?: string; currency?: string }
interface Grant {
    target: Target;
    created: number;
    identity?: string;
    meta?: { token: string; expiresAt?: string };
    google?: { refreshToken: string };
    accounts?: Account[];
}

const STATE_TTL = 10 * 60_000;
const GRANT_TTL = 15 * 60_000;
const states = new Map<string, { target: Target; created: number }>();
const grants = new Map<string, Grant>();

const sweep = () => {
    const now = Date.now();
    for (const [k, v] of states) if (now - v.created > STATE_TTL) states.delete(k);
    for (const [k, v] of grants) if (now - v.created > GRANT_TTL) grants.delete(k);
};

const env = (k: string) => (process.env[k] || '').trim();
const META_VERSION = () => env('META_API_VERSION') || 'v23.0';

const configured = {
    meta: () => !!(env('META_APP_ID') && env('META_APP_SECRET')),
    google: () => !!(env('GOOGLE_OAUTH_CLIENT_ID') && env('GOOGLE_OAUTH_CLIENT_SECRET') && env('GOOGLE_ADS_DEVELOPER_TOKEN')),
    ga4: () => !!(env('GOOGLE_OAUTH_CLIENT_ID') && env('GOOGLE_OAUTH_CLIENT_SECRET')),
};

/** La URL de retorno se calcula con el host por el que entró el usuario (localhost:3000 con Vite, :4000 con npm start). */
const redirectUri = (req: Request, provider: 'meta' | 'google') => {
    const base = env('OAUTH_REDIRECT_BASE')
        || `${req.headers['x-forwarded-proto'] === 'https' || req.secure ? 'https' : 'http'}://${req.headers.host}`;
    return `${base.replace(/\/$/, '')}/api/oauth/${provider}/callback`;
};

const back = (res: Response, target: string, params: Record<string, string>) => {
    const q = new URLSearchParams({ oauth_target: target, ...params });
    res.redirect(`/?${q}`);
};

const form = (data: Record<string, string>) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data),
});

// ---------- META ----------
const metaLoginUrl = (req: Request, state: string) => {
    const p = new URLSearchParams({ client_id: env('META_APP_ID'), redirect_uri: redirectUri(req, 'meta'), state });
    const configId = env('META_LOGIN_CONFIG_ID');
    if (configId) {
        // Facebook Login for Business: los permisos viven en la "configuración", no en scope
        p.set('config_id', configId);
        p.set('response_type', 'code');
        p.set('override_default_response_type', 'true');
    } else {
        p.set('scope', 'ads_read,business_management,read_insights');
    }
    return `https://www.facebook.com/${META_VERSION()}/dialog/oauth?${p}`;
};

const metaExchange = async (req: Request, code: string) => {
    const base = `https://graph.facebook.com/${META_VERSION()}/oauth/access_token`;
    const short: any = await fetchJson(`${base}?${new URLSearchParams({
        client_id: env('META_APP_ID'), client_secret: env('META_APP_SECRET'), redirect_uri: redirectUri(req, 'meta'), code,
    })}`);
    // Token de corta vida (~1-2 h) -> token de larga vida (~60 días)
    const long: any = await fetchJson(`${base}?${new URLSearchParams({
        grant_type: 'fb_exchange_token', client_id: env('META_APP_ID'), client_secret: env('META_APP_SECRET'),
        fb_exchange_token: short.access_token,
    })}`).catch(() => short);
    const seconds = Number(long.expires_in);
    return {
        token: String(long.access_token),
        expiresAt: Number.isFinite(seconds) && seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : undefined,
    };
};

const metaAccounts = async (token: string): Promise<{ identity?: string; accounts: Account[] }> => {
    const me: any = await fetchJson(`https://graph.facebook.com/${META_VERSION()}/me?${new URLSearchParams({ fields: 'name', access_token: token })}`)
        .catch(() => ({}));
    const accounts: Account[] = [];
    const seen = new Set<string>();
    const add = (a: any, group: string) => {
        if (!a?.id || seen.has(a.id)) return;
        seen.add(a.id);
        accounts.push({ id: a.id, name: a.name || a.id, currency: a.currency, group });
    };
    const businesses = await Meta.listBusinesses(token).catch(() => []);
    for (const b of businesses) {
        for (const a of await Meta.listAdAccounts(token, b.id).catch(() => [])) add(a, b.name);
    }
    for (const a of await Meta.listAdAccounts(token).catch(() => [])) add(a, 'Mis cuentas');
    return { identity: me.name, accounts };
};

// ---------- GOOGLE ----------
const GOOGLE_SCOPES: Record<'google' | 'ga4', string> = {
    google: 'https://www.googleapis.com/auth/adwords',
    ga4: 'https://www.googleapis.com/auth/analytics.readonly',
};

const googleLoginUrl = (req: Request, state: string, target: 'google' | 'ga4') =>
    `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: env('GOOGLE_OAUTH_CLIENT_ID'),
        redirect_uri: redirectUri(req, 'google'),
        response_type: 'code',
        scope: `openid email ${GOOGLE_SCOPES[target]}`,
        access_type: 'offline',
        prompt: 'consent', // fuerza la entrega del refresh_token
        include_granted_scopes: 'true',
        state,
    })}`;

const googleExchange = async (req: Request, code: string) => {
    const res: any = await fetchJson('https://oauth2.googleapis.com/token', form({
        grant_type: 'authorization_code', code,
        client_id: env('GOOGLE_OAUTH_CLIENT_ID'), client_secret: env('GOOGLE_OAUTH_CLIENT_SECRET'),
        redirect_uri: redirectUri(req, 'google'),
    }));
    if (!res.refresh_token) {
        throw new ApiError('Google no entregó un refresh token. Quita el acceso de la app en myaccount.google.com/permissions y vuelve a intentarlo.');
    }
    let identity: string | undefined;
    try {
        const info: any = await fetchJson('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${res.access_token}` } });
        identity = info.email;
    } catch { /* la identidad es solo informativa */ }
    return { refreshToken: String(res.refresh_token), accessToken: String(res.access_token), identity };
};

const googleCreds = (refreshToken: string) => ({
    clientId: env('GOOGLE_OAUTH_CLIENT_ID'),
    clientSecret: env('GOOGLE_OAUTH_CLIENT_SECRET'),
    refreshToken,
    developerToken: env('GOOGLE_ADS_DEVELOPER_TOKEN'),
});

const adsAccounts = async (refreshToken: string, accessToken: string): Promise<Account[]> => {
    const list: any = await fetchJson(`https://googleads.googleapis.com/${ADS_VERSION()}/customers:listAccessibleCustomers`, {
        headers: { Authorization: `Bearer ${accessToken}`, 'developer-token': env('GOOGLE_ADS_DEVELOPER_TOKEN') },
    });
    const ids: string[] = (list.resourceNames || []).map((r: string) => r.replace('customers/', ''));
    const base = googleCreds(refreshToken);
    const out: Account[] = [];
    const seen = new Set<string>();
    const push = (a: Account) => { const k = `${a.loginCustomerId || ''}/${a.id}`; if (!seen.has(k)) { seen.add(k); out.push(a); } };

    await Promise.all(ids.map(async id => {
        try {
            const [row] = await gaql({ ...base, customerId: id }, 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1');
            const c = row?.customer;
            if (!c) return;
            if (!c.manager) {
                push({ id, name: c.descriptiveName || id, currency: c.currencyCode, group: 'Cuentas directas' });
                return;
            }
            // Cuenta administradora (MCC): lista sus cuentas cliente y accede a través de ella
            const rows = await gaql({ ...base, customerId: id, loginCustomerId: id },
                'SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.level = 1');
            for (const r of rows) {
                const cc = r.customerClient;
                if (!cc || cc.manager || cc.status === 'CANCELED') continue;
                push({ id: String(cc.id), name: cc.descriptiveName || String(cc.id), currency: cc.currencyCode, group: `MCC · ${c.descriptiveName || id}`, loginCustomerId: id });
            }
        } catch { /* cuenta sin acceso directo: se omite */ }
    }));
    return out;
};

const ga4Accounts = async (accessToken: string): Promise<Account[]> => {
    const out: Account[] = [];
    let pageToken = '';
    for (let i = 0; i < 10; i++) {
        const res: any = await fetchJson(`https://analyticsadmin.googleapis.com/v1beta/accountSummaries?${new URLSearchParams({ pageSize: '200', ...(pageToken ? { pageToken } : {}) })}`,
            { headers: { Authorization: `Bearer ${accessToken}` } });
        for (const acc of res.accountSummaries || []) {
            for (const p of acc.propertySummaries || []) {
                out.push({ id: String(p.property).replace('properties/', ''), name: p.displayName || p.property, group: acc.displayName });
            }
        }
        pageToken = res.nextPageToken || '';
        if (!pageToken) break;
    }
    return out;
};

// ---------- ROUTER ----------
export const oauthRouter = Router();

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: (e?: unknown) => void) => fn(req, res).catch(next);

oauthRouter.get('/providers', (_req, res) => {
    res.json({ google: configured.google(), ga4: configured.ga4(), meta: configured.meta() });
});

oauthRouter.get('/grants/:grant/accounts', wrap(async (req, res) => {
    sweep();
    const g = grants.get(String(req.params.grant));
    if (!g) throw new ApiError('La sesión de conexión venció. Vuelve a iniciar sesión.', 410);
    if (!g.accounts) {
        if (g.target === 'meta') {
            const r = await metaAccounts(g.meta!.token);
            g.accounts = r.accounts;
            g.identity ??= r.identity;
        } else if (g.target === 'ga4') {
            g.accounts = await ga4Accounts(await accessFor(g));
        } else {
            g.accounts = await adsAccounts(g.google!.refreshToken, await accessFor(g));
        }
    }
    res.json({ target: g.target, identity: g.identity, accounts: g.accounts });
}));

/** Access token corto para listar cuentas (se pide con el refresh token del grant). */
const accessFor = async (g: Grant) => {
    const res: any = await fetchJson('https://oauth2.googleapis.com/token', form({
        grant_type: 'refresh_token', refresh_token: g.google!.refreshToken,
        client_id: env('GOOGLE_OAUTH_CLIENT_ID'), client_secret: env('GOOGLE_OAUTH_CLIENT_SECRET'),
    }));
    return String(res.access_token);
};

oauthRouter.post('/grants/:grant/connect', wrap(async (req, res) => {
    sweep();
    const g = grants.get(String(req.params.grant));
    if (!g) throw new ApiError('La sesión de conexión venció. Vuelve a iniciar sesión.', 410);
    const accountId = String(req.body?.accountId || '').trim();
    if (!accountId) throw new ApiError('Elige una cuenta.');
    const picked = g.accounts?.find(a => a.id === accountId);
    const group = String(req.body?.group || picked?.group || '');
    const loginCustomerId = String(req.body?.loginCustomerId || picked?.loginCustomerId || '');

    let result: { credentials: Record<string, string>; info: Record<string, string> };
    if (g.target === 'meta') {
        result = await PLATFORMS.meta.connect({ token: g.meta!.token, adAccountId: accountId, businessName: group === 'Mis cuentas' ? '' : group });
        if (g.meta!.expiresAt) result.info.expiresAt = g.meta!.expiresAt;
    } else if (g.target === 'ga4') {
        result = await PLATFORMS.ga4.connect({ ...googleCreds(g.google!.refreshToken), propertyId: accountId });
    } else {
        result = await PLATFORMS.google.connect({ ...googleCreds(g.google!.refreshToken), customerId: accountId, loginCustomerId });
    }
    if (g.identity) result.info.identity = g.identity;

    Store.save({ platform: g.target, credentials: result.credentials, info: result.info, connectedAt: new Date().toISOString() });
    grants.delete(String(req.params.grant));
    res.json({ platform: g.target, info: result.info });
}));

oauthRouter.get('/:provider/start', (req, res) => {
    sweep();
    const provider = String(req.params.provider);
    const target = String(req.query.target || provider) as Target;
    if ((provider !== 'meta' && provider !== 'google') || !isTarget(target) || providerOf(target) !== provider) {
        return void res.status(404).json({ error: 'Proveedor desconocido.' });
    }
    if (!configured[target]()) {
        return void back(res, target, { oauth_error: 'Falta configurar las credenciales OAuth en .env.local (ver LEEME-LOCAL.md).' });
    }
    const state = crypto.randomBytes(24).toString('hex');
    states.set(state, { target, created: Date.now() });
    res.redirect(provider === 'meta' ? metaLoginUrl(req, state) : googleLoginUrl(req, state, target as 'google' | 'ga4'));
});

oauthRouter.get('/:provider/callback', async (req, res) => {
    sweep();
    const provider = String(req.params.provider);
    const st = states.get(String(req.query.state || ''));
    states.delete(String(req.query.state || ''));
    if (!st || (provider !== 'meta' && provider !== 'google') || providerOf(st.target) !== provider) {
        return void back(res, provider === 'meta' ? 'meta' : 'google', { oauth_error: 'La sesión de inicio venció o es inválida. Inténtalo de nuevo.' });
    }
    const providerError = req.query.error_description || req.query.error_message || req.query.error;
    if (providerError || !req.query.code) {
        return void back(res, st.target, { oauth_error: String(providerError || 'No se concedió el acceso.') });
    }
    try {
        const grant: Grant = { target: st.target, created: Date.now() };
        if (provider === 'meta') {
            grant.meta = await metaExchange(req, String(req.query.code));
        } else {
            const g = await googleExchange(req, String(req.query.code));
            grant.google = { refreshToken: g.refreshToken };
            grant.identity = g.identity;
        }
        const id = crypto.randomBytes(24).toString('hex');
        grants.set(id, grant);
        back(res, st.target, { oauth_grant: id });
    } catch (e: any) {
        back(res, st.target, { oauth_error: e?.message || 'No se pudo completar el inicio de sesión.' });
    }
});
