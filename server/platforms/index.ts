import type { DateRangeQuery, FetchOptions } from '../lib/http';
import type { PlatformId } from '../lib/store';
import { Meta } from './meta';
import { GoogleAds, GA4 } from './google';
import { LinkedIn } from './linkedin';
import { TikTok } from './tiktok';
import { Kommo } from './kommo';

export interface PlatformAdapter {
    /** Validates the pasted credentials against the real API; returns what to store. */
    connect(input: Record<string, string>): Promise<{ credentials: Record<string, string>; info: Record<string, string> }>;
    /** Returns a partial GlobalData object (e.g. { meta: {...} }) for the date range. */
    fetch(credentials: Record<string, string>, range: DateRangeQuery, opts?: FetchOptions): Promise<Record<string, unknown>>;
}

export const PLATFORMS: Record<PlatformId, PlatformAdapter> = {
    meta: Meta,
    google: GoogleAds,
    ga4: GA4,
    linkedin: LinkedIn,
    tiktok: TikTok,
    kommo: Kommo,
};

export const isPlatform = (id: string): id is PlatformId => id in PLATFORMS;

/** Same empty shape the frontend starts with, so missing platforms are always well-formed. */
export const emptyData = () => ({
    meta: { campaigns: [], ads: [], demographics: [], geo: [] },
    google: { campaigns: [], keywords: [], ads: [] },
    linkedin: { campaigns: [], demographics: [], ads: [] },
    tiktok: { campaigns: [], videos: [] },
    kommo: { pipelines: [], agents: [], channels: [], salesHistory: [], lossReasons: [] },
    ga4: { sessions: 0, revenue: 0, users: 0, conversionRate: '0%', bounceRate: '0%', avgSessionDuration: '0s', sources: [], cities: [] },
    trend: [] as { date: string; spend: number; revenue: number; impressions?: number; clicks?: number; conversions?: number }[],
});
