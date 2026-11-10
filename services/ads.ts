import { Platform } from '../types';
import type { AdData, TikTokVideo } from '../types';
import type { GlobalData } from '../context/DataContext';

// Unifies the ads of every ad platform into one shape for the "Anuncios" tab.
// A metric a platform doesn't report is null (not 0), so sorting can push it to the end
// instead of ranking it as "the worst".

export type AdStatus = 'Active' | 'Paused' | 'Ended' | 'Unknown';

export interface AdRow {
    key: string;              // platform:id — unique across platforms, used to match the previous period
    id: string;
    platform: Platform;
    name: string;
    campaign: string;
    status: AdStatus;
    format: string;
    thumbnail?: string;
    url?: string;
    isVideo: boolean;
    // Volume
    spend: number;
    impressions: number;
    reach: number | null;
    clicks: number;
    visits: number;
    interactions: number | null;
    videoViews: number | null;
    conversions: number;
    revenue: number | null;
    // Ratios
    ctr: number;
    cpc: number | null;
    cpm: number | null;
    costPerVisit: number | null;
    cpa: number | null;
    roas: number | null;
    engagementRate: number | null;
    conversionRate: number | null;
}

const ratio = (a: number, b: number) => b > 0 ? a / b : null;
const opt = (v: number | undefined) => v == null || !isFinite(v) ? null : v;
const status = (s: string | undefined): AdStatus => !s ? 'Unknown' : s === 'Active' || s === 'Paused' ? s : 'Ended';

const finish = (r: Omit<AdRow, 'ctr' | 'cpc' | 'cpm' | 'costPerVisit' | 'cpa' | 'engagementRate' | 'conversionRate'>): AdRow => ({
    ...r,
    ctr: (ratio(r.clicks, r.impressions) ?? 0) * 100,
    cpc: ratio(r.spend, r.clicks),
    cpm: r.impressions > 0 ? r.spend / r.impressions * 1000 : null,
    costPerVisit: ratio(r.spend, r.visits),
    cpa: ratio(r.spend, r.conversions),
    engagementRate: r.interactions == null || r.impressions <= 0 ? null : r.interactions / r.impressions * 100,
    conversionRate: r.clicks > 0 ? r.conversions / r.clicks * 100 : null,
});

/** Meta / Google / LinkedIn rows share the AdData shape. */
const fromAdData = (platform: Platform, ads: AdData[] | undefined, campaignNames: Map<string, string>): AdRow[] =>
    (ads || []).map(a => {
        const revenue = a.revenue ?? (a.roas ? a.roas * a.spend : undefined);
        return finish({
            key: `${platform}:${a.id}`,
            id: a.id,
            platform,
            name: a.name || `Anuncio ${a.id}`,
            campaign: a.campaignName || campaignNames.get(a.campaignId) || '',
            status: status(a.status),
            format: a.format || '',
            thumbnail: a.thumbnail,
            url: a.url,
            isVideo: a.format === 'Video' || (a.videoViews ?? 0) > 0,
            spend: a.spend || 0,
            impressions: a.impressions || 0,
            reach: opt(a.reach) || null,
            clicks: a.clicks || 0,
            // "Visitas" = people who reached the destination: landing page views when the platform reports them,
            // otherwise link clicks, otherwise clicks.
            visits: a.landingPageViews || a.linkClicks || a.clicks || 0,
            interactions: opt(a.interactions),
            videoViews: a.videoViews ? a.videoViews : null,
            conversions: a.conversions || 0,
            revenue: revenue && revenue > 0 ? revenue : null,
            roas: revenue && a.spend > 0 ? revenue / a.spend : null,
        });
    });

const fromTikTok = (videos: TikTokVideo[] | undefined): AdRow[] =>
    (videos || []).map(v => {
        const impressions = v.impressions ?? 0;
        // Older backends didn't send clicks: rebuild them from CTR when possible
        const clicks = v.clicks ?? (impressions > 0 ? Math.round(impressions * v.ctr / 100) : 0);
        return finish({
            key: `${Platform.TikTok}:${v.id}`,
            id: v.id,
            platform: Platform.TikTok,
            name: v.text || v.name || `Anuncio ${v.id}`,
            campaign: v.campaignName || '',
            status: status(v.status),
            format: 'Video',
            thumbnail: v.thumbnail || undefined,
            isVideo: true,
            spend: v.spend || 0,
            impressions,
            reach: null,
            clicks,
            visits: clicks,
            interactions: (v.likes || 0) + (v.comments || 0) + (v.shares || 0),
            videoViews: v.views || null,
            conversions: v.conversions || 0,
            revenue: null,
            roas: null,
        });
    });

/** Every ad in the period, from every ad platform, in one list. */
export const collectAds = (data: GlobalData): AdRow[] => {
    const names = (cs: { id: string; name: string }[]) => new Map(cs.map(c => [c.id, c.name]));
    return [
        ...fromAdData(Platform.Meta, data.meta.ads, names(data.meta.campaigns)),
        ...fromAdData(Platform.GoogleAds, data.google.ads, names(data.google.campaigns)),
        ...fromAdData(Platform.LinkedIn, data.linkedin.ads, names(data.linkedin.campaigns)),
        ...fromTikTok(data.tiktok.videos),
    ];
};

// --- Sorting ---

export type MetricFormat = 'number' | 'money' | 'percent' | 'multiplier';
export type SortKey = keyof Pick<AdRow,
    'visits' | 'interactions' | 'impressions' | 'reach' | 'clicks' | 'videoViews' | 'ctr' | 'engagementRate'
    | 'conversions' | 'conversionRate' | 'revenue' | 'roas' | 'spend' | 'cpc' | 'cpm' | 'costPerVisit' | 'cpa'> | 'name';

export interface SortOption {
    key: SortKey;
    label: string;
    short: string;            // column / card label
    group: string;
    format: MetricFormat | 'text';
    /** true when a lower value is better (costs): the default direction becomes ascending */
    lowerIsBetter?: boolean;
    help?: string;
}

export const SORT_OPTIONS: SortOption[] = [
    { key: 'visits', label: 'Visitas', short: 'Visitas', group: 'Alcance y tráfico', format: 'number',
      help: 'Personas que llegaron al destino del anuncio: vistas de página de destino (Meta, LinkedIn); si la plataforma no las reporta, clics en el enlace o clics (Google, TikTok).' },
    { key: 'impressions', label: 'Impresiones', short: 'Impresiones', group: 'Alcance y tráfico', format: 'number' },
    { key: 'reach', label: 'Alcance (personas únicas)', short: 'Alcance', group: 'Alcance y tráfico', format: 'number',
      help: 'Solo Meta reporta alcance por anuncio.' },
    { key: 'clicks', label: 'Clics', short: 'Clics', group: 'Alcance y tráfico', format: 'number' },
    { key: 'ctr', label: 'CTR', short: 'CTR', group: 'Alcance y tráfico', format: 'percent' },
    { key: 'interactions', label: 'Interacciones', short: 'Interacciones', group: 'Interacción', format: 'number',
      help: 'Meta: interacciones con la publicación. TikTok: likes + comentarios + compartidos. LinkedIn: interacciones totales. Google: interacciones del anuncio.' },
    { key: 'engagementRate', label: 'Tasa de interacción', short: 'Tasa interac.', group: 'Interacción', format: 'percent',
      help: 'Interacciones ÷ impresiones.' },
    { key: 'videoViews', label: 'Reproducciones de video', short: 'Reproducciones', group: 'Interacción', format: 'number' },
    { key: 'conversions', label: 'Conversiones', short: 'Conversiones', group: 'Resultados', format: 'number' },
    { key: 'conversionRate', label: 'Tasa de conversión', short: 'Tasa conv.', group: 'Resultados', format: 'percent',
      help: 'Conversiones ÷ clics.' },
    { key: 'revenue', label: 'Ingresos', short: 'Ingresos', group: 'Resultados', format: 'money' },
    { key: 'roas', label: 'ROAS', short: 'ROAS', group: 'Resultados', format: 'multiplier' },
    { key: 'spend', label: 'Inversión', short: 'Inversión', group: 'Costos', format: 'money' },
    { key: 'cpa', label: 'Costo por conversión (CPA)', short: 'CPA', group: 'Costos', format: 'money', lowerIsBetter: true },
    { key: 'costPerVisit', label: 'Costo por visita', short: 'Costo/visita', group: 'Costos', format: 'money', lowerIsBetter: true },
    { key: 'cpc', label: 'Costo por clic (CPC)', short: 'CPC', group: 'Costos', format: 'money', lowerIsBetter: true },
    { key: 'cpm', label: 'Costo por mil (CPM)', short: 'CPM', group: 'Costos', format: 'money', lowerIsBetter: true },
    { key: 'name', label: 'Nombre (A-Z)', short: 'Nombre', group: 'Otros', format: 'text' },
];

export const sortOption = (key: SortKey) => SORT_OPTIONS.find(o => o.key === key) || SORT_OPTIONS[0];

/** Sorts a copy. Ads without the metric (null) always go last, whatever the direction. */
export const sortAds = (rows: AdRow[], key: SortKey, dir: 'asc' | 'desc'): AdRow[] => {
    const sign = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
        if (key === 'name') return sign * a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
        const va = a[key] as number | null, vb = b[key] as number | null;
        if (va == null && vb == null) return b.spend - a.spend;
        if (va == null) return 1;
        if (vb == null) return -1;
        return va === vb ? b.spend - a.spend : sign * (va - vb);
    });
};

// --- Formatting ---

export const formatMetric = (value: number | null | undefined, format: MetricFormat | 'text'): string => {
    if (value == null || !isFinite(value)) return '—';
    switch (format) {
        case 'money': return '$' + value.toLocaleString('en-US', { minimumFractionDigits: value < 100 ? 2 : 0, maximumFractionDigits: value < 100 ? 2 : 0 });
        case 'percent': return `${value.toFixed(2)}%`;
        case 'multiplier': return `${value.toFixed(2)}x`;
        default: return Math.round(value).toLocaleString('en-US');
    }
};

/** 12.3k / 1.2M — for compact cards */
export const compact = (value: number | null | undefined): string => {
    if (value == null || !isFinite(value)) return '—';
    const abs = Math.abs(value);
    if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (abs >= 1e4) return `${(value / 1e3).toFixed(1)}k`;
    return Math.round(value).toLocaleString('en-US');
};

// --- CSV export ---

const STATUS_ES: Record<AdStatus, string> = { Active: 'Activo', Paused: 'Pausado', Ended: 'Finalizado', Unknown: 'Sin estado' };

export const adsToCsv = (rows: AdRow[]): string => {
    const cols: [string, (r: AdRow) => string | number | null][] = [
        ['Plataforma', r => r.platform], ['Anuncio', r => r.name], ['Campaña', r => r.campaign], ['Estado', r => STATUS_ES[r.status]],
        ['Formato', r => r.format], ['Inversión', r => r.spend.toFixed(2)], ['Impresiones', r => r.impressions], ['Alcance', r => r.reach],
        ['Clics', r => r.clicks], ['CTR %', r => r.ctr.toFixed(2)], ['Visitas', r => r.visits], ['Interacciones', r => r.interactions],
        ['Tasa interacción %', r => r.engagementRate?.toFixed(2) ?? null], ['Reproducciones', r => r.videoViews],
        ['Conversiones', r => r.conversions], ['Tasa conversión %', r => r.conversionRate?.toFixed(2) ?? null],
        ['Ingresos', r => r.revenue?.toFixed(2) ?? null], ['ROAS', r => r.roas?.toFixed(2) ?? null],
        ['CPC', r => r.cpc?.toFixed(2) ?? null], ['CPM', r => r.cpm?.toFixed(2) ?? null],
        ['Costo por visita', r => r.costPerVisit?.toFixed(2) ?? null], ['CPA', r => r.cpa?.toFixed(2) ?? null],
    ];
    const cell = (v: string | number | null) => {
        const s = v == null ? '' : String(v);
        return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [cols.map(c => c[0]).join(','), ...rows.map(r => cols.map(c => cell(c[1](r))).join(','))].join('\n');
};
