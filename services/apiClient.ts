// Thin client for the OmniMetrics backend (server/). All credentials live server-side.

export class UnauthorizedError extends Error {}

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    let res: Response;
    try {
        res = await fetch(`/api${path}`, {
            ...init,
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', ...init.headers },
        });
    } catch {
        throw new Error('No se pudo contactar al servidor. ¿Está corriendo el backend (npm run dev)?');
    }
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) throw new UnauthorizedError(body.error || 'No autenticado.');
    // Vite's proxy answers 5xx without a JSON body when the backend isn't running
    if (res.status >= 500 && !body.error) {
        throw new Error('El backend no está corriendo. Revisa la terminal de "npm run dev" (¿falta APP_PASSWORD en .env.local?).');
    }
    if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
    return body as T;
};

const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export interface ConnectionStatus {
    platform: string;
    info: Record<string, string>;
    connectedAt: string;
    lastSync?: string;
    lastError?: string;
}

export interface OAuthAccount { id: string; name: string; group?: string; loginCustomerId?: string; currency?: string }

/** Pestañas que se pueden compartir por enlace */
export type SharePage = 'dashboard' | 'reports' | 'ads';
export const SHARE_PAGE_LABELS: Record<SharePage, string> = { dashboard: 'Dashboard', reports: 'Plataformas', ads: 'Anuncios' };

export interface ShareLink {
    id: string;
    token: string;
    label: string;
    pages?: SharePage[];
    createdAt: string;
    expiresAt?: string;
    lastViewedAt?: string;
    views: number;
}

export interface SyncResponse {
    data: any;
    errors: Record<string, string>;
    /** Plataformas que respondieron con datos guardados (p. ej. porque limitaron las consultas) */
    warnings?: Record<string, string>;
    connected: string[];
    syncedAt: string;
    /** Solo en la vista compartida: nombre del enlace y pestañas que puede ver */
    share?: { label: string; pages: SharePage[] };
}

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const Api = {
    me: () => request<{ ok: true }>('/auth/me'),
    login: (password: string) => post<{ ok: true }>('/auth/login', { password }),
    logout: () => post('/auth/logout'),

    listConnections: () => request<ConnectionStatus[]>('/connections'),
    connect: (platform: string, fields: Record<string, string>) => post<{ platform: string; info: Record<string, string> }>(`/connections/${platform}`, fields),
    disconnect: (platform: string) => request(`/connections/${platform}`, { method: 'DELETE' }),

    metaBusinesses: (token: string) => post<{ id: string; name: string }[]>('/meta/businesses', { token }),
    metaAdAccounts: (token: string, businessId?: string) =>
        post<{ id: string; account_id: string; name: string; currency: string }[]>('/meta/adaccounts', { token, businessId }),

    // "Conectar con Google / Meta": the login itself is a full-page redirect to /api/oauth/<provider>/start
    oauthProviders: () => request<{ google: boolean; ga4: boolean; meta: boolean }>('/oauth/providers'),
    oauthStartUrl: (target: string) => `/api/oauth/${target === 'meta' ? 'meta' : 'google'}/start?target=${target}`,
    oauthAccounts: (grant: string) => request<{ target: string; identity?: string; accounts: OAuthAccount[] }>(`/oauth/grants/${grant}/accounts`),
    oauthConnect: (grant: string, account: OAuthAccount) =>
        post<{ platform: string; info: Record<string, string> }>(`/oauth/grants/${grant}/connect`,
            { accountId: account.id, loginCustomerId: account.loginCustomerId, group: account.group }),

    // Enlaces para compartir el dashboard (solo lectura)
    shares: () => request<ShareLink[]>('/shares'),
    shareCreate: (label: string, expiresInDays: number | undefined, pages: SharePage[]) =>
        post<ShareLink>('/shares', { label, expiresInDays, pages }),
    shareRevoke: (id: string) => request(`/shares/${id}`, { method: 'DELETE' }),
    /** Vista pública: no requiere sesión, la autoriza el token del enlace */
    publicSync: (token: string, start: Date, end: Date, opts: { light?: boolean } = {}) =>
        request<SyncResponse>(`/public/${encodeURIComponent(token)}/data?start=${isoDate(start)}&end=${isoDate(end)}${opts.light ? '&light=1' : ''}`),

    /** background: comparison fetch (lighter, doesn't overwrite each connection's sync status). fresh: manual refresh */
    sync: (start: Date, end: Date, opts: { background?: boolean; fresh?: boolean } = {}) =>
        request<SyncResponse>(`/data?start=${isoDate(start)}&end=${isoDate(end)}${opts.background ? '&background=1' : ''}${opts.fresh ? '&fresh=1' : ''}`),
};
