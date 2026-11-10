import { ApiError, DateRangeQuery, SeriesPoint, fetchJson, num, withRatios } from '../lib/http';

// --- OAuth: refresh token -> short-lived access token (cached in memory) ---
const tokenCache = new Map<string, { token: string; exp: number }>();

export const accessToken = async (creds: Record<string, string>): Promise<string> => {
    const key = creds.clientId + creds.refreshToken;
    const cached = tokenCache.get(key);
    if (cached && cached.exp > Date.now() + 60_000) return cached.token;
    const res: any = await fetchJson('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            refresh_token: creds.refreshToken,
        }),
    });
    tokenCache.set(key, { token: res.access_token, exp: Date.now() + res.expires_in * 1000 });
    return res.access_token;
};

const oauthCreds = (input: Record<string, string>) => {
    const creds = {
        clientId: input.clientId?.trim(),
        clientSecret: input.clientSecret?.trim(),
        refreshToken: input.refreshToken?.trim(),
    };
    if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
        throw new ApiError('Client ID, Client Secret y Refresh Token son requeridos.');
    }
    return creds;
};

// --- GOOGLE ADS ---
export const ADS_VERSION = () => process.env.GOOGLE_ADS_API_VERSION || 'v21';
const digits = (id?: string) => (id || '').replace(/\D/g, '');

export const gaql = async (creds: Record<string, string>, query: string): Promise<any[]> => {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${await accessToken(creds)}`,
        'developer-token': creds.developerToken,
        'Content-Type': 'application/json',
    };
    if (creds.loginCustomerId) headers['login-customer-id'] = creds.loginCustomerId;
    const url = `https://googleads.googleapis.com/${ADS_VERSION()}/customers/${creds.customerId}/googleAds:search`;
    const rows: any[] = [];
    let pageToken: string | undefined;
    for (let i = 0; i < 20; i++) {
        const res: any = await fetchJson(url, { method: 'POST', headers, body: JSON.stringify({ query, pageToken }) });
        rows.push(...(res.results || []));
        pageToken = res.nextPageToken;
        if (!pageToken) break;
    }
    return rows;
};

const ADS_STATUS: Record<string, string> = { ENABLED: 'Active', PAUSED: 'Paused' };
const AD_TYPES: Record<string, string> = {
    RESPONSIVE_SEARCH_AD: 'Búsqueda', EXPANDED_TEXT_AD: 'Texto', RESPONSIVE_DISPLAY_AD: 'Display', IMAGE_AD: 'Imagen',
    VIDEO_AD: 'Video', VIDEO_RESPONSIVE_AD: 'Video', DEMAND_GEN_MULTI_ASSET_AD: 'Demand Gen', DEMAND_GEN_VIDEO_RESPONSIVE_AD: 'Demand Gen',
    SHOPPING_PRODUCT_AD: 'Shopping', APP_AD: 'App', CALL_AD: 'Llamada',
};

export const GoogleAds = {
    async connect(input: Record<string, string>) {
        const creds = {
            ...oauthCreds(input),
            developerToken: input.developerToken?.trim(),
            customerId: digits(input.customerId),
            loginCustomerId: digits(input.loginCustomerId),
        };
        if (!creds.developerToken || !creds.customerId) throw new ApiError('Developer Token y Customer ID son requeridos.');
        const [row] = await gaql(creds, 'SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1');
        return {
            credentials: creds,
            info: { account: row?.customer?.descriptiveName || creds.customerId, accountId: creds.customerId, currency: row?.customer?.currencyCode || '' },
        };
    },

    async fetch(creds: Record<string, string>, range: DateRangeQuery) {
        const during = `segments.date BETWEEN '${range.start}' AND '${range.end}'`;
        const [campRows, kwRows, dailyRows, adRows] = await Promise.all([
            gaql(creds, `SELECT campaign.id, campaign.name, campaign.status, metrics.cost_micros, metrics.impressions,
                metrics.clicks, metrics.conversions, metrics.conversions_value
                FROM campaign WHERE ${during} AND campaign.status != 'REMOVED'`),
            gaql(creds, `SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.status,
                ad_group_criterion.quality_info.quality_score, campaign.name, metrics.impressions, metrics.clicks,
                metrics.cost_micros, metrics.conversions
                FROM keyword_view WHERE ${during} ORDER BY metrics.cost_micros DESC LIMIT 200`),
            gaql(creds, `SELECT segments.date, metrics.cost_micros, metrics.conversions_value FROM customer WHERE ${during}`),
            // Ad level (Anuncios tab) is optional: a failure here must not break the sync
            gaql(creds, `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.ad.final_urls,
                ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.status, ad_group.name, campaign.id, campaign.name,
                metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value,
                metrics.interactions, metrics.engagements
                FROM ad_group_ad WHERE ${during} AND ad_group_ad.status != 'REMOVED'
                ORDER BY metrics.impressions DESC LIMIT 500`).catch(() => []),
        ]);

        const campaigns = campRows.map((r: any) => withRatios({
            id: String(r.campaign.id),
            name: r.campaign.name,
            status: ADS_STATUS[r.campaign.status] || 'Ended',
            spend: num(r.metrics.costMicros) / 1e6,
            impressions: num(r.metrics.impressions),
            clicks: num(r.metrics.clicks),
            conversions: +num(r.metrics.conversions).toFixed(2),
            revenue: num(r.metrics.conversionsValue),
        }));

        const keywords = kwRows.map((r: any) => {
            const spend = num(r.metrics.costMicros) / 1e6, clicks = num(r.metrics.clicks), impressions = num(r.metrics.impressions);
            return {
                id: String(r.adGroupCriterion.criterionId),
                text: r.adGroupCriterion.keyword?.text || '',
                campaignName: r.campaign.name,
                status: ADS_STATUS[r.adGroupCriterion.status] || r.adGroupCriterion.status,
                qualityScore: num(r.adGroupCriterion.qualityInfo?.qualityScore),
                impressions, clicks, spend,
                ctr: impressions > 0 ? +(clicks / impressions * 100).toFixed(2) : 0,
                cpc: clicks > 0 ? +(spend / clicks).toFixed(2) : 0,
                conversions: +num(r.metrics.conversions).toFixed(2),
            };
        });

        const series: SeriesPoint[] = dailyRows.map((r: any) => ({
            date: r.segments.date, spend: num(r.metrics.costMicros) / 1e6, revenue: num(r.metrics.conversionsValue),
        }));

        const ads = adRows.map((r: any) => {
            const ad = r.adGroupAd?.ad || {};
            const headline = ad.responsiveSearchAd?.headlines?.[0]?.text;
            return {
                ...withRatios({
                    spend: num(r.metrics.costMicros) / 1e6,
                    impressions: num(r.metrics.impressions),
                    clicks: num(r.metrics.clicks),
                    conversions: +num(r.metrics.conversions).toFixed(2),
                    revenue: num(r.metrics.conversionsValue),
                }),
                id: String(ad.id),
                campaignId: String(r.campaign?.id || ''),
                campaignName: r.campaign?.name,
                name: ad.name || headline || `${r.adGroup?.name || 'Anuncio'} · ${ad.id}`,
                status: ADS_STATUS[r.adGroupAd?.status] || 'Ended',
                format: AD_TYPES[ad.type] || ad.type,
                url: ad.finalUrls?.[0],
                interactions: num(r.metrics.interactions) + num(r.metrics.engagements),
            };
        });

        return { google: { campaigns, keywords, ads }, series };
    },
};

// --- GOOGLE ANALYTICS 4 ---
const runReport = async (creds: Record<string, string>, body: object) =>
    fetchJson<any>(`https://analyticsdata.googleapis.com/v1beta/properties/${creds.propertyId}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await accessToken(creds)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

const values = (row: any) => (row?.metricValues || []).map((m: any) => num(m.value));
const dims = (row: any) => (row?.dimensionValues || []).map((d: any) => d.value);

export const GA4 = {
    async connect(input: Record<string, string>) {
        const creds = { ...oauthCreds(input), propertyId: digits(input.propertyId) };
        if (!creds.propertyId) throw new ApiError('Property ID es requerido.');
        await runReport(creds, { dateRanges: [{ startDate: 'yesterday', endDate: 'today' }], metrics: [{ name: 'sessions' }] });
        return { credentials: creds, info: { accountId: creds.propertyId } };
    },

    async fetch(creds: Record<string, string>, range: DateRangeQuery) {
        const dateRanges = [{ startDate: range.start, endDate: range.end }];
        const [summary, sources, cities, daily] = await Promise.all([
            runReport(creds, {
                dateRanges,
                metrics: ['sessions', 'totalRevenue', 'totalUsers', 'sessionKeyEventRate', 'bounceRate', 'averageSessionDuration'].map(name => ({ name })),
            }),
            runReport(creds, {
                dateRanges,
                dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
                metrics: ['sessions', 'totalUsers', 'totalRevenue', 'bounceRate'].map(name => ({ name })),
                orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                limit: 20,
            }),
            runReport(creds, {
                dateRanges,
                dimensions: [{ name: 'city' }, { name: 'country' }],
                metrics: [{ name: 'activeUsers' }, { name: 'totalRevenue' }],
                orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
                limit: 20,
            }),
            runReport(creds, { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'totalRevenue' }], limit: 1000 }),
        ]);

        // GA4 dates come as YYYYMMDD
        const series: SeriesPoint[] = (daily.rows || []).map((r: any) => {
            const [d] = dims(r);
            return { date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, siteRevenue: values(r)[0] };
        });

        const [sessions, revenue, users, convRate, bounce, duration] = values(summary.rows?.[0]);
        return {
            ga4: {
                sessions: sessions || 0,
                revenue: revenue || 0,
                users: users || 0,
                conversionRate: `${((convRate || 0) * 100).toFixed(2)}%`,
                bounceRate: `${((bounce || 0) * 100).toFixed(2)}%`,
                avgSessionDuration: `${(duration || 0).toFixed(0)}s`,
                sources: (sources.rows || []).map((r: any) => {
                    const [source, medium] = dims(r);
                    const [s, u, rev, b] = values(r);
                    return { source, medium, sessions: s, users: u, revenue: rev, bounceRate: +(b * 100).toFixed(2) };
                }),
                cities: (cities.rows || []).map((r: any) => {
                    const [city, country] = dims(r);
                    const [activeUsers, rev] = values(r);
                    return { city, country, activeUsers, revenue: rev };
                }),
            },
            series,
        };
    },
};
