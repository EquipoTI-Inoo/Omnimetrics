import { ApiError, DateRangeQuery, FetchOptions, RateLimitError, SeriesPoint, fetchJson, num, withRatios } from '../lib/http';

const VERSION = () => process.env.META_API_VERSION || 'v23.0';
const graph = (path: string, params: Record<string, string>, token: string) =>
    `https://graph.facebook.com/${VERSION()}/${path}?${new URLSearchParams({ ...params, access_token: token })}`;

// Meta throttling: error codes 4, 17, 32, 613 and 80000-80014 ("too many calls to this ad-account")
const RATE_LIMITED = /too many calls|rate.?limit|request limit|\(#(4|17|32|613|800\d\d)\)|code"?:\s*(4|17|32|613|800\d\d)\b/i;

/** Follows paging.next until exhausted (capped). */
const getAll = async (url: string, maxPages = 20): Promise<any[]> => {
    const out: any[] = [];
    let next: string | undefined = url;
    for (let i = 0; next && i < maxPages; i++) {
        let page: any;
        try {
            page = await fetchJson(next);
        } catch (e: any) {
            if (RATE_LIMITED.test(e.message || '')) {
                throw new RateLimitError('Meta limitó temporalmente las consultas a esta cuenta publicitaria. Se libera sola en unos minutos (a veces hasta 1 hora).');
            }
            throw e;
        }
        out.push(...(page.data || []));
        next = page.paging?.next;
    }
    return out;
};

// Meta reports overlapping action types (purchase / omni_purchase / pixel purchase): take the first present per group.
const PURCHASE_TYPES = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'];
const LEAD_TYPES = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'];
const firstOf = (list: any[] | undefined, types: string[]) => {
    for (const t of types) {
        const hit = list?.find(a => a.action_type === t);
        if (hit) return num(hit.value);
    }
    return 0;
};
const conversionsOf = (row: any) => firstOf(row.actions, PURCHASE_TYPES) + firstOf(row.actions, LEAD_TYPES);
const revenueOf = (row: any) => firstOf(row.action_values, PURCHASE_TYPES);
const actionOf = (row: any, ...types: string[]) => firstOf(row.actions, types);

// Meta's creative object_type -> readable format
const FORMAT: Record<string, string> = { VIDEO: 'Video', PHOTO: 'Imagen', SHARE: 'Enlace', STATUS: 'Publicación', APPLICATION: 'App', OFFER: 'Oferta', EVENT: 'Evento', INVALID: '' };

const STATUS: Record<string, string> = { ACTIVE: 'Active', PAUSED: 'Paused', CAMPAIGN_PAUSED: 'Paused', ADSET_PAUSED: 'Paused' };

const accountPath = (id: string) => id.startsWith('act_') ? id : `act_${id}`;

export const Meta = {
    async listBusinesses(token: string) {
        return getAll(graph('me/businesses', { fields: 'id,name', limit: '100' }, token));
    },

    async listAdAccounts(token: string, businessId?: string) {
        const fields = { fields: 'id,account_id,name,currency', limit: '200' };
        if (!businessId) return getAll(graph('me/adaccounts', fields, token));
        const [owned, client] = await Promise.all([
            getAll(graph(`${businessId}/owned_ad_accounts`, fields, token)).catch(() => []),
            getAll(graph(`${businessId}/client_ad_accounts`, fields, token)).catch(() => []),
        ]);
        const seen = new Set<string>();
        return [...owned, ...client].filter(a => !seen.has(a.id) && seen.add(a.id));
    },

    async connect(input: Record<string, string>) {
        const token = input.token?.trim();
        const adAccountId = input.adAccountId?.trim();
        if (!token || !adAccountId) throw new ApiError('Token y cuenta publicitaria son requeridos.');
        const acc: any = await fetchJson(graph(accountPath(adAccountId), { fields: 'name,currency' }, token));
        return {
            credentials: { token, adAccountId: accountPath(adAccountId) },
            info: { account: acc.name, accountId: accountPath(adAccountId), currency: acc.currency, business: input.businessName || '' },
        };
    },

    /**
     * Meta caps calls per ad account, so this asks for as little as possible:
     * campaigns are added up from the ad-level rows instead of a separate request, and
     * `light` (previous period, only used for the % badges) makes a single request.
     */
    async fetch(creds: Record<string, string>, range: DateRangeQuery, opts: FetchOptions = {}) {
        const { token, adAccountId } = creds;
        const time_range = JSON.stringify({ since: range.start, until: range.end });
        const base = { time_range, limit: '500' };
        const metrics = 'spend,impressions,clicks,actions,action_values';
        const insights = (params: Record<string, string>) => getAll(graph(`${adAccountId}/insights`, { ...base, ...params }, token));
        const none = Promise.resolve([] as any[]);

        const [adRows, statuses, demoRows, geoRows, dailyRows, adMeta] = await Promise.all([
            insights({ level: 'ad', fields: `ad_id,ad_name,campaign_id,campaign_name,reach,${metrics}` }),
            opts.light ? none : getAll(graph(`${adAccountId}/campaigns`, { fields: 'id,effective_status', limit: '500' }, token)),
            opts.light ? none : insights({ level: 'account', fields: metrics, breakdowns: 'age,gender' }),
            opts.light ? none : insights({ level: 'account', fields: metrics, breakdowns: 'country,region' }),
            opts.light ? none : insights({ level: 'account', fields: metrics, time_increment: '1' }),
            // Thumbnails are optional: a failure here must not break the sync
            opts.light ? none : getAll(graph(`${adAccountId}/ads`, { fields: 'id,effective_status,creative{thumbnail_url,image_url,object_type}', limit: '500' }, token)).catch(() => []),
        ]);
        const statusById = new Map(statuses.map((s: any) => [s.id, s.effective_status]));
        const adById = new Map<string, any>(adMeta.map((a: any) => [a.id, a]));

        // Campaign totals = sum of their ads (same numbers Meta gives at campaign level, one request less)
        const byCampaign = new Map<string, { id: string; name: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number }>();
        for (const r of adRows) {
            const c = byCampaign.get(r.campaign_id) || { id: r.campaign_id, name: r.campaign_name, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
            c.spend += num(r.spend); c.impressions += num(r.impressions); c.clicks += num(r.clicks);
            c.conversions += conversionsOf(r); c.revenue += revenueOf(r);
            byCampaign.set(r.campaign_id, c);
        }
        const campaigns = [...byCampaign.values()].map(c => withRatios({
            ...c, spend: +c.spend.toFixed(2), status: STATUS[statusById.get(c.id)] || 'Ended',
        })).sort((a, b) => b.spend - a.spend);

        const ads = adRows.map((r: any) => {
            const creative = adById.get(r.ad_id)?.creative;
            return {
                ...withRatios({
                    spend: num(r.spend), impressions: num(r.impressions), clicks: num(r.clicks),
                    conversions: conversionsOf(r), revenue: revenueOf(r),
                }),
                id: r.ad_id, campaignId: r.campaign_id, campaignName: r.campaign_name, name: r.ad_name,
                status: STATUS[adById.get(r.ad_id)?.effective_status] || 'Ended',
                thumbnail: creative?.image_url || creative?.thumbnail_url,
                format: FORMAT[creative?.object_type] ?? creative?.object_type,
                // Extra metrics used by the Anuncios tab
                reach: num(r.reach),
                interactions: actionOf(r, 'post_engagement', 'page_engagement'),
                landingPageViews: actionOf(r, 'landing_page_view', 'omni_landing_page_view'),
                linkClicks: actionOf(r, 'link_click'),
                videoViews: actionOf(r, 'video_view'),
                reactions: actionOf(r, 'post_reaction'),
                comments: actionOf(r, 'comment'),
                shares: actionOf(r, 'post'),
                saves: actionOf(r, 'onsite_conversion.post_save'),
            };
        }).sort((a: any, b: any) => b.spend - a.spend);

        const gender = (g: string) => g === 'male' ? 'Male' : g === 'female' ? 'Female' : 'Unknown';
        const demographics = demoRows.map((r: any) => ({
            ageGroup: r.age, gender: gender(r.gender),
            impressions: num(r.impressions), spend: num(r.spend), conversions: conversionsOf(r),
        }));

        const geo = geoRows.map((r: any) => {
            const spend = num(r.spend), revenue = revenueOf(r);
            return { region: r.region, country: r.country, spend, conversions: conversionsOf(r), roas: spend > 0 ? +(revenue / spend).toFixed(2) : 0 };
        }).sort((a, b) => b.spend - a.spend).slice(0, 25);

        const series: SeriesPoint[] = dailyRows.map((r: any) => ({
            date: r.date_start, spend: num(r.spend), revenue: revenueOf(r),
            impressions: num(r.impressions), clicks: num(r.clicks), conversions: conversionsOf(r),
        }));

        return { meta: { campaigns, ads, demographics, geo }, series };
    },
};
