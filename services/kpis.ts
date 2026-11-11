import type { BlendedMetrics, CampaignData } from '../types';
import type { GlobalData } from '../context/DataContext';

// KPI math shared by the Dashboard and Plataformas, applied identically to the current and previous period.

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + (f(r) || 0), 0);
const ratio = (a: number, b: number) => b > 0 ? a / b : 0;

/** Spend-weighted ROAS, so a tiny campaign with a huge ROAS doesn't skew the average. */
const weightedRoas = (cs: CampaignData[]) => ratio(sum(cs, c => (c.roas || 0) * c.spend), sum(cs, c => c.spend));

/** % change vs the previous period; null when there is nothing to compare against. */
export const pctChange = (current: number, previous: number | undefined | null): number | null => {
  if (previous == null || !isFinite(previous) || previous === 0 || !isFinite(current)) return null;
  return Math.round((current - previous) / Math.abs(previous) * 1000) / 10;
};

export const computeBlended = (data: GlobalData, isDemoMode: boolean): BlendedMetrics => {
  const all = [...data.meta.campaigns, ...data.google.campaigns, ...data.linkedin.campaigns, ...data.tiktok.campaigns];
  const spend = sum(all, c => c.spend);
  const imps = sum(all, c => c.impressions);
  const clicks = sum(all, c => c.clicks);
  const conv = sum(all, c => c.conversions);
  // Real mode: GA4 revenue if available, otherwise conversion value reported by the ad platforms.
  // Demo mode keeps the simulated 3.5x estimate.
  const ga4Rev = data.ga4.revenue || 0;
  const adsRev = sum(all, c => c.revenue || 0);
  const totalRev = ga4Rev > 0 ? ga4Rev : isDemoMode ? spend * 3.5 : adsRev;
  return {
    totalSpend: spend,
    totalImpressions: imps,
    totalClicks: clicks,
    totalConversions: conv,
    totalRevenue: totalRev,
    blendedRoas: ratio(totalRev, spend),
    blendedCpa: ratio(spend, conv),
    blendedCtr: ratio(clicks, imps) * 100,
    blendedCpc: ratio(spend, clicks),
  };
};

export const platformKpis = (data: GlobalData) => {
  const { meta, google, linkedin, tiktok, kommo, ga4 } = data;
  const metaSpend = sum(meta.campaigns, c => c.spend);
  const metaConv = sum(meta.campaigns, c => c.conversions);
  const googleSpend = sum(google.campaigns, c => c.spend);
  const googleConv = sum(google.campaigns, c => c.conversions);
  const scored = google.keywords.filter(k => k.qualityScore > 0);
  const tiktokSpend = sum(tiktok.campaigns, c => c.spend);
  const kommoLeads = sum(kommo.agents, a => a.leads);

  return {
    meta: {
      spend: metaSpend,
      roas: weightedRoas(meta.campaigns),
      revenue: sum(meta.campaigns, c => c.revenue || c.roas * c.spend),
      conversions: metaConv,
      cpa: ratio(metaSpend, metaConv),
      ctr: ratio(sum(meta.campaigns, c => c.clicks), sum(meta.campaigns, c => c.impressions)) * 100,
      clicks: sum(meta.campaigns, c => c.clicks),
    },
    google: {
      clicks: sum(google.campaigns, c => c.clicks),
      // Impression-weighted, like Google Ads reports it
      qualityScore: ratio(sum(scored, k => k.qualityScore * k.impressions), sum(scored, k => k.impressions)),
      conversions: googleConv,
      cpa: ratio(googleSpend, googleConv),
    },
    ga4: {
      sessions: ga4.sessions,
      users: ga4.users,
      revenue: ga4.revenue,
      conversionRate: parseFloat(ga4.conversionRate) || 0,
    },
    linkedin: {
      spend: sum(linkedin.campaigns, c => c.spend),
      impressions: sum(linkedin.campaigns, c => c.impressions),
      clicks: sum(linkedin.campaigns, c => c.clicks),
      conversions: sum(linkedin.campaigns, c => c.conversions),
    },
    tiktok: {
      spend: tiktokSpend,
      views: sum(tiktok.videos, v => v.views),
      cpm: ratio(tiktokSpend, sum(tiktok.campaigns, c => c.impressions)) * 1000,
      conversions: sum(tiktok.campaigns, c => c.conversions),
    },
    kommo: {
      wonValue: sum(kommo.agents, a => a.totalValue),
      sales: sum(kommo.agents, a => a.sales),
      leadConversion: ratio(sum(kommo.agents, a => a.sales), kommoLeads) * 100,
      leads: kommoLeads,
      opportunities: sum(kommo.pipelines, p => sum(p.stages.filter(s => !s.closed), s => s.count)),
      lost: sum(kommo.lossReasons, l => l.count),
    },
  };
};

export type PlatformKpis = ReturnType<typeof platformKpis>;
