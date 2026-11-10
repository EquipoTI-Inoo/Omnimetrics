import { ApiError, DateRangeQuery, SeriesPoint, fetchJson, num, withRatios } from '../lib/http';
import { chunks } from '../lib/dates';

const BASE = 'https://business-api.tiktok.com/open_api/v1.3';

/** TikTok returns HTTP 200 with { code, message } — code 0 means success. */
const call = async (path: string, params: Record<string, unknown>, token: string) => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
    const res: any = await fetchJson(`${BASE}${path}?${qs}`, { headers: { 'Access-Token': token } });
    if (res.code !== 0) throw new ApiError(`TikTok ${res.code}: ${res.message}`);
    return res.data;
};

const STATUS: Record<string, string> = { ENABLE: 'Active', DISABLE: 'Paused' };

export const TikTok = {
    async connect(input: Record<string, string>) {
        const token = input.token?.trim();
        const advertiserId = (input.advertiserId || '').replace(/\D/g, '');
        if (!token || !advertiserId) throw new ApiError('Access Token y Advertiser ID son requeridos.');
        const data = await call('/advertiser/info/', { advertiser_ids: [advertiserId] }, token);
        const adv = data?.list?.[0];
        return {
            credentials: { token, advertiserId },
            info: { account: adv?.name || advertiserId, accountId: advertiserId, currency: adv?.currency || '' },
        };
    },

    async fetch(creds: Record<string, string>, range: DateRangeQuery) {
        const { token, advertiserId } = creds;
        const report = (params: Record<string, unknown>, r = range) => call('/report/integrated/get/', {
            advertiser_id: advertiserId, report_type: 'BASIC', start_date: r.start, end_date: r.end, page_size: 1000, ...params,
        }, token);

        const [campReport, campaignData, adReport, ...dailyReports] = await Promise.all([
            report({
                data_level: 'AUCTION_CAMPAIGN',
                dimensions: ['campaign_id'],
                metrics: ['campaign_name', 'spend', 'impressions', 'clicks', 'conversion', 'complete_payment_roas'],
            }),
            call('/campaign/get/', { advertiser_id: advertiserId, page_size: 1000, fields: ['campaign_id', 'operation_status'] }, token),
            adLevelReport(report),
            // Daily reports are capped at 30 days per request
            ...chunks(range.start, range.end, 30).map(w => report({
                data_level: 'AUCTION_ADVERTISER',
                dimensions: ['stat_time_day'],
                metrics: ['spend', 'complete_payment_roas'],
            }, w)),
        ]);

        const status = new Map<string, string>((campaignData?.list || []).map((c: any) => [String(c.campaign_id), c.operation_status]));
        const campaigns = (campReport?.list || []).map((r: any) => {
            const id = String(r.dimensions.campaign_id);
            const m = r.metrics;
            const spend = num(m.spend);
            return withRatios({
                id,
                name: m.campaign_name,
                status: STATUS[status.get(id) || ''] || 'Ended',
                spend,
                impressions: num(m.impressions),
                clicks: num(m.clicks),
                conversions: num(m.conversion),
                revenue: spend * num(m.complete_payment_roas),
            });
        });

        const adRows = (adReport?.list || []).filter((r: any) => num(r.metrics.video_play_actions) > 0);
        const { covers, statuses } = await adDetails(token, advertiserId, adRows.map((r: any) => String(r.dimensions.ad_id)));
        const videos = adRows.map((r: any) => {
            const m = r.metrics;
            return {
                id: String(r.dimensions.ad_id),
                text: m.ad_text || m.ad_name,
                name: m.ad_name,
                status: STATUS[statuses.get(String(r.dimensions.ad_id)) || ''],
                campaignName: m.campaign_name,
                impressions: num(m.impressions),
                clicks: num(m.clicks),
                comments: num(m.comments),
                thumbnail: covers.get(String(r.dimensions.ad_id)) || '',
                views: num(m.video_play_actions),
                likes: num(m.likes),
                shares: num(m.shares),
                ctr: num(m.ctr),
                spend: num(m.spend),
                conversions: num(m.conversion),
            };
        });

        const series: SeriesPoint[] = dailyReports.flatMap((d: any) => d?.list || []).map((r: any) => {
            const spend = num(r.metrics.spend);
            return { date: String(r.dimensions.stat_time_day).slice(0, 10), spend, revenue: spend * num(r.metrics.complete_payment_roas) };
        });

        return { tiktok: { campaigns, videos }, series };
    },
};

const AD_METRICS = ['ad_name', 'ad_text', 'spend', 'clicks', 'ctr', 'conversion', 'video_play_actions', 'likes', 'shares'];

/**
 * Ad-level report. Asks for the extra metrics the Anuncios tab uses (impressions, comments, campaign);
 * if TikTok rejects them, falls back to the original metric set so the TikTok tab keeps working.
 */
const adLevelReport = async (report: (params: Record<string, unknown>) => Promise<any>) => {
    const params = { data_level: 'AUCTION_AD', dimensions: ['ad_id'], order_field: 'spend', order_type: 'DESC', page_size: 100 };
    try {
        return await report({ ...params, metrics: [...AD_METRICS, 'impressions', 'comments', 'campaign_name'] });
    } catch {
        return report({ ...params, metrics: AD_METRICS }).catch(() => ({ list: [] }));
    }
};

/** ad_id -> video cover URL and on/off status. Best effort: both are cosmetic, so errors yield empty maps. */
const adDetails = async (token: string, advertiserId: string, adIds: string[]) => {
    const covers = new Map<string, string>();
    const statuses = new Map<string, string>();
    if (adIds.length === 0) return { covers, statuses };
    try {
        const ads = await call('/ad/get/', {
            advertiser_id: advertiserId, filtering: { ad_ids: adIds }, fields: ['ad_id', 'video_id', 'operation_status'], page_size: 100,
        }, token);
        for (const a of ads?.list || []) if (a.operation_status) statuses.set(String(a.ad_id), a.operation_status);
        const videoByAd = new Map<string, string>((ads?.list || []).filter((a: any) => a.video_id).map((a: any) => [String(a.ad_id), a.video_id]));
        const videoIds = [...new Set(videoByAd.values())];
        if (videoIds.length === 0) return { covers, statuses };
        const info = await call('/file/video/ad/info/', { advertiser_id: advertiserId, video_ids: videoIds.slice(0, 60) }, token);
        const coverByVideo = new Map<string, string>((info?.list || []).map((v: any) => [v.video_id, v.video_cover_url]));
        for (const [ad, video] of videoByAd) {
            const cover = coverByVideo.get(video);
            if (cover) covers.set(ad, cover);
        }
    } catch { /* no thumbnails */ }
    return { covers, statuses };
};
