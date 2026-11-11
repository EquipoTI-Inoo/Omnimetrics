export class ApiError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}

/** The platform is throttling us: retrying makes it worse, so the sync serves the last good data instead. */
export class RateLimitError extends ApiError {
    constructor(message: string) { super(message, 429); }
}

/** light: only what the % change badges need (used for the previous period). Adapters may ignore it. */
export interface FetchOptions { light?: boolean }

/**
 * fetch + JSON with timeout. Throws ApiError with the provider's own error message when possible.
 */
export class TimeoutError extends ApiError {
    constructor() { super('La plataforma tardó demasiado en responder.', 504); }
}

const isTimeout = (e: any) => e?.name === 'TimeoutError' || /aborted due to timeout/i.test(e?.message || '');

export const fetchJson = async <T = any>(url: string, init: RequestInit = {}, timeoutMs = 30000): Promise<T> => {
    let res: Response;
    let text: string;
    try {
        res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
        // The timeout also covers downloading the body, so it must be read inside the try
        text = await res.text();
    } catch (e: any) {
        if (isTimeout(e)) throw new TimeoutError();
        throw new ApiError(`Error de red: ${e.message}`, 502);
    }
    let body: any = text;
    try { body = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
    if (!res.ok) {
        const msg = body?.error?.message || body?.error_description || body?.message || body?.detail
            || (Array.isArray(body) && body[0]?.error?.message) || (typeof body === 'string' ? body.slice(0, 200) : '')
            || res.statusText;
        throw new ApiError(`${res.status}: ${msg}`, res.status === 401 || res.status === 403 ? 400 : 502);
    }
    // e.g. Kommo redirects unknown subdomains to its HTML homepage with a 200
    if (typeof body === 'string') {
        throw new ApiError(`Respuesta inesperada (no JSON) de ${new URL(res.url || url).host}. Revisa el subdominio/ID.`, 502);
    }
    return body as T;
};

export const num = (v: unknown): number => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
    return Number.isFinite(n) ? n : 0;
};

/** Fills the derived ratios every CampaignData row is expected to have. */
export const withRatios = <T extends { spend: number; impressions: number; clicks: number; conversions: number; revenue?: number }>(c: T) => ({
    ...c,
    ctr: c.impressions > 0 ? +(c.clicks / c.impressions * 100).toFixed(2) : 0,
    cpc: c.clicks > 0 ? +(c.spend / c.clicks).toFixed(2) : 0,
    cpa: c.conversions > 0 ? +(c.spend / c.conversions).toFixed(2) : 0,
    roas: c.spend > 0 && c.revenue ? +(c.revenue / c.spend).toFixed(2) : 0,
});

export interface DateRangeQuery { start: string; end: string } // YYYY-MM-DD, inclusive

/** One day of a platform's daily totals. Ad platforms report spend/revenue; GA4 reports siteRevenue. */
export interface SeriesPoint {
    date: string; spend?: number; revenue?: number; siteRevenue?: number;
    impressions?: number; clicks?: number; conversions?: number;
}
