import { ApiError, DateRangeQuery, SeriesPoint, fetchJson, num, withRatios } from '../lib/http';

// LinkedIn versions are monthly (YYYYMM) and each is supported for ~1 year.
const VERSION = () => process.env.LINKEDIN_API_VERSION || '202509';

const headers = (token: string) => ({
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': VERSION(),
    'X-Restli-Protocol-Version': '2.0.0',
});

// Rest.li dates: (year:2026,month:10,day:1)
const liDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return `(year:${y},month:${m},day:${d})`;
};
const fromLiDate = (d: { year: number; month: number; day: number }) =>
    `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;

const STATUS: Record<string, string> = { ACTIVE: 'Active', PAUSED: 'Paused' };

// LinkedIn's standardized job functions (urn:li:function:<id>) are a fixed list
const JOB_FUNCTIONS: Record<string, string> = {
    1: 'Contabilidad', 2: 'Administración', 3: 'Arte y diseño', 4: 'Desarrollo de negocio', 5: 'Servicios sociales',
    6: 'Consultoría', 7: 'Educación', 8: 'Ingeniería', 9: 'Emprendimiento', 10: 'Finanzas', 11: 'Salud',
    12: 'Recursos humanos', 13: 'Tecnología de la información', 14: 'Legal', 15: 'Marketing', 16: 'Medios y comunicación',
    17: 'Militar y seguridad', 18: 'Operaciones', 19: 'Gestión de producto', 20: 'Gestión de proyectos', 21: 'Compras',
    22: 'Control de calidad', 23: 'Bienes raíces', 24: 'Investigación', 25: 'Ventas', 26: 'Soporte',
};

const urnId = (urn: string) => String(urn || '').split(':').pop()!;

export const LinkedIn = {
    async connect(input: Record<string, string>) {
        const token = input.token?.trim();
        const accountId = (input.accountId || '').replace(/\D/g, '');
        if (!token || !accountId) throw new ApiError('Access Token y Ad Account ID son requeridos.');
        const acc: any = await fetchJson(`https://api.linkedin.com/rest/adAccounts/${accountId}`, { headers: headers(token) });
        return {
            credentials: { token, accountId },
            info: { account: acc.name || accountId, accountId, currency: acc.currency || '' },
        };
    },

    async fetch(creds: Record<string, string>, range: DateRangeQuery) {
        const { token, accountId } = creds;
        const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${accountId}`);
        const analytics = (pivot: string, granularity: 'ALL' | 'DAILY', fields: string) => fetchJson<any>(
            `https://api.linkedin.com/rest/adAnalytics?q=analytics&pivot=${pivot}&timeGranularity=${granularity}`
            + `&dateRange=(start:${liDate(range.start)},end:${liDate(range.end)})`
            + `&accounts=List(${accountUrn})&fields=${fields}`,
            { headers: headers(token) },
        );
        const perf = 'pivotValues,costInLocalCurrency,clicks,externalWebsiteConversions,oneClickLeads';

        const [byCampaign, campaignList, daily, byIndustry, byFunction, byCreative, creativeList] = await Promise.all([
            analytics('CAMPAIGN', 'ALL', `${perf},impressions,conversionValueInLocalCurrency`),
            fetchJson<any>(`https://api.linkedin.com/rest/adAccounts/${accountId}/adCampaigns?q=search&pageSize=1000`, { headers: headers(token) }),
            analytics('ACCOUNT', 'DAILY', 'dateRange,costInLocalCurrency,conversionValueInLocalCurrency,impressions,clicks,externalWebsiteConversions,oneClickLeads'),
            // Demographic pivots are optional: LinkedIn hides them for small audiences
            analytics('MEMBER_INDUSTRY', 'ALL', perf).catch(() => ({ elements: [] })),
            analytics('MEMBER_JOB_FUNCTION', 'ALL', perf).catch(() => ({ elements: [] })),
            // Creative level (Anuncios tab) is optional too
            analytics('CREATIVE', 'ALL', `${perf},impressions,conversionValueInLocalCurrency,landingPageClicks,totalEngagements,likes,comments,shares,videoViews`)
                .catch(() => ({ elements: [] })),
            fetchJson<any>(`https://api.linkedin.com/rest/adAccounts/${accountId}/creatives?q=criteria&pageSize=100`, { headers: headers(token) })
                .catch(() => ({ elements: [] })),
        ]);

        const meta = new Map<string, any>((campaignList.elements || []).map((c: any) => [String(c.id), c]));
        const campaigns = (byCampaign.elements || []).map((r: any) => {
            const id = urnId(r.pivotValues?.[0]);
            const c = meta.get(id);
            return withRatios({
                id,
                name: c?.name || `Campaña ${id}`,
                status: STATUS[c?.status] || 'Ended',
                spend: num(r.costInLocalCurrency),
                impressions: num(r.impressions),
                clicks: num(r.clicks),
                conversions: num(r.externalWebsiteConversions) + num(r.oneClickLeads),
                revenue: num(r.conversionValueInLocalCurrency),
            });
        });

        const series: SeriesPoint[] = (daily.elements || []).map((r: any) => ({
            date: fromLiDate(r.dateRange.start), spend: num(r.costInLocalCurrency), revenue: num(r.conversionValueInLocalCurrency),
            impressions: num(r.impressions), clicks: num(r.clicks), conversions: num(r.externalWebsiteConversions) + num(r.oneClickLeads),
        }));

        const topIndustries = (byIndustry.elements || [])
            .sort((a: any, b: any) => num(b.costInLocalCurrency) - num(a.costInLocalCurrency)).slice(0, 10);
        const industryNames = await industryLabels(token, topIndustries.map((r: any) => urnId(r.pivotValues?.[0])));

        const demo = (r: any, type: 'Industry' | 'JobFunction', name: string) => ({
            name, type,
            clicks: num(r.clicks),
            spend: num(r.costInLocalCurrency),
            conversions: num(r.externalWebsiteConversions) + num(r.oneClickLeads),
        });
        const demographics = [
            ...topIndustries.map((r: any) => {
                const id = urnId(r.pivotValues?.[0]);
                return demo(r, 'Industry', industryNames.get(id) || `Industria ${id}`);
            }),
            ...(byFunction.elements || [])
                .sort((a: any, b: any) => num(b.costInLocalCurrency) - num(a.costInLocalCurrency)).slice(0, 10)
                .map((r: any) => {
                    const id = urnId(r.pivotValues?.[0]);
                    return demo(r, 'JobFunction', JOB_FUNCTIONS[id] || `Función ${id}`);
                }),
        ];

        const campaignName = new Map(campaigns.map((c: any) => [c.id, c.name]));
        const creativeMeta = new Map<string, any>((creativeList.elements || []).map((c: any) => [urnId(c.id), c]));
        const ads = (byCreative.elements || []).map((r: any) => {
            const id = urnId(r.pivotValues?.[0]);
            const c = creativeMeta.get(id);
            const campaignId = c?.campaign ? urnId(c.campaign) : '';
            return {
                ...withRatios({
                    spend: num(r.costInLocalCurrency),
                    impressions: num(r.impressions),
                    clicks: num(r.clicks),
                    conversions: num(r.externalWebsiteConversions) + num(r.oneClickLeads),
                    revenue: num(r.conversionValueInLocalCurrency),
                }),
                id,
                campaignId,
                campaignName: campaignName.get(campaignId),
                name: c?.name || `Anuncio ${id}`,
                status: STATUS[c?.intendedStatus] || 'Ended',
                landingPageViews: num(r.landingPageClicks),
                interactions: num(r.totalEngagements),
                reactions: num(r.likes),
                comments: num(r.comments),
                shares: num(r.shares),
                videoViews: num(r.videoViews),
            };
        });

        return { linkedin: { campaigns, demographics, ads }, series };
    },
};

/** Industry names come from LinkedIn's taxonomy endpoint; unknown ids fall back to "Industria <id>". */
const industryCache = new Map<string, string>();
const industryLabels = async (token: string, ids: string[]) => {
    await Promise.all(ids.filter(id => !industryCache.has(id)).map(async id => {
        try {
            const res: any = await fetchJson(
                `https://api.linkedin.com/rest/industryTaxonomyVersions/DEFAULT/industries/${id}`,
                { headers: headers(token) }, 10000);
            const name = res.name?.localized?.es_ES || res.name?.localized?.en_US || res.name?.value;
            if (name) industryCache.set(id, name);
        } catch { /* keep fallback label */ }
    }));
    return industryCache;
};
