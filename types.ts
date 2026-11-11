import React from 'react';

export enum Platform {
  Meta = 'Meta Ads',
  GoogleAds = 'Google Ads',
  GA4 = 'Google Analytics 4',
  LinkedIn = 'LinkedIn Ads',
  TikTok = 'TikTok Ads',
  Kommo = 'Kommo CRM'
}

export enum BusinessGoal {
  HighValue = 'Venta Alta Valor',
  Ecommerce = 'E-commerce',
  LeadGen = 'Generación de Leads',
  Messaging = 'Mensajería'
}

export interface AppPreferences {
    visiblePlatforms: Record<string, boolean>;
    defaultGoal: BusinessGoal;
    isDemoMode: boolean;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

// --- BI ENGINE TYPES ---

export type ChartType = 'scorecard' | 'table' | 'bar' | 'line' | 'area' | 'pie';

export interface WidgetConfig {
    id: string;
    title: string;
    description?: string;
    dataSource: Platform;
    chartType: ChartType;
    dimensions: string[]; // e.g., ['date', 'campaignName']
    metrics: string[];    // e.g., ['spend', 'roas']
    pinnedToDashboard: boolean;
}

// --- DAILY TREND (all platforms combined) ---
export interface TrendPoint {
    date: string; // YYYY-MM-DD
    spend: number;
    revenue: number;
    impressions?: number;
    clicks?: number;
    conversions?: number;
}

// --- BLENDED METRICS ---
export interface BlendedMetrics {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalRevenue: number;
    blendedRoas: number;
    blendedCpa: number;
    blendedCtr: number;
    blendedCpc: number;
}

// --- CAMPAIGN & AD DATA ---
export interface CampaignData {
  id: string;
  name: string;
  status: 'Active' | 'Paused' | 'Ended';
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpc: number;
  [key: string]: any;
}

export interface AdData {
    id: string;
    campaignId: string;
    name: string;
    status: string;
    thumbnail?: string; // URL for ad creative
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    cpa: number;
    roas: number;
    cpc: number;
    // Optional, used by the Anuncios tab (not every platform reports all of them)
    campaignName?: string;
    format?: string;          // 'Video', 'Imagen', 'Búsqueda'...
    url?: string;
    revenue?: number;
    reach?: number;
    interactions?: number;     // Meta post_engagement, Google interactions+engagements, LinkedIn totalEngagements
    landingPageViews?: number; // Meta landing_page_view, LinkedIn landingPageClicks
    linkClicks?: number;
    videoViews?: number;
    reactions?: number;
    comments?: number;
    shares?: number;
    saves?: number;
}

export interface KeywordData {
    id: string;
    text: string;
    campaignName: string;
    status: string;
    qualityScore: number; // 1-10
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    spend: number;
    conversions: number;
}

// --- DEMOGRAPHICS & GEO ---
export interface DemographicGroup {
    ageGroup: string; // "18-24", "25-34"
    gender: 'Male' | 'Female' | 'Unknown';
    impressions: number;
    spend: number;
    conversions: number;
}

export interface GeoRegion {
    region: string; // "Madrid", "California"
    country: string;
    spend: number;
    conversions: number;
    roas: number;
}

// --- GA4 DEEP DATA ---
export interface GA4Source {
    source: string;
    medium: string;
    sessions: number;
    users: number;
    revenue: number;
    bounceRate: number;
}

export interface GA4City {
    city: string;
    country: string;
    activeUsers: number;
    revenue: number;
}

// --- LINKEDIN DEEP DATA ---
export interface LinkedInDemographic {
    name: string; // e.g., "Software Engineering", "Finance"
    type: 'Industry' | 'JobFunction' | 'CompanySize';
    clicks: number;
    spend: number;
    conversions: number;
    [key: string]: any;
}

// --- TIKTOK DEEP DATA ---
export interface TikTokVideo {
    id: string;
    thumbnail: string;
    text: string;
    views: number;
    likes: number;
    shares: number;
    ctr: number;
    spend: number;
    conversions: number;
    // Optional extras (Anuncios tab)
    name?: string;
    status?: string;
    campaignName?: string;
    impressions?: number;
    clicks?: number;
    comments?: number;
}

// --- META HIERARCHY ---
export interface MetaBusinessPortfolio {
  id: string;
  name: string;
  profile_picture_uri?: string;
}

export interface MetaAdAccount {
  id: string;
  account_id: string;
  name: string;
  currency: string;
}

// --- DEEP KOMMO TYPES ---
export interface PipelineStage {
  id: string;
  name: string;
  count: number;
  value: number;
  color: string;
  /** Kommo's terminal stages: counted over the date range instead of as a snapshot of active leads */
  closed?: 'won' | 'lost';
  [key: string]: any;
}

export interface KommoPipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
  archived?: boolean;
  leadCount?: number;
  /** Stats limited to this pipeline's leads (absent in older cached data / demo) */
  agents?: AgentPerformance[];
  lossReasons?: LossReason[];
  salesHistory?: SalesRepHistory[];
}

export interface AgentPerformance {
  id: string;
  name: string;
  leads: number;
  sales: number;
  avgResponseTime: string;
  conversionRate: number;
  totalValue: number;
}

// Historic data for charts
export interface SalesRepHistory {
    agentName: string;
    data: { date: string; sales: number; value: number }[];
}

export interface LossReason {
    reason: string;
    count: number;
    [key: string]: any;
}

export interface LeadChannel {
  name: string;
  count: number;
  conversionRate: number;
  [key: string]: any;
}

// --- AI & INTEGRATION ---
export interface AIAnalysisResult {
  trends: string[];
  optimizations: string[];
  priority: 'Alta' | 'Media' | 'Baja';
  rawAnalysis: string;
}

export interface Integration {
  id: string;
  name: string;
  icon: React.ElementType;
  status: 'connected' | 'disconnected' | 'configuring' | 'error';
  lastSync?: string;
  description: string;
  credentialsRequired: string[];
  subdomain?: string;
  domainSuffix?: string;
  businessName?: string;
  developerToken?: string;
  customerId?: string;
  propertyId?: string;
  advertiserId?: string;
  clientId?: string;
  clientSecret?: string;
}

// --- CUSTOM BUILDER ---
export interface CustomVariable {
  id: string;
  name: string;
  value: string | number;
  unit?: string;
}

export interface CustomWidget {
  id: string;
  title: string;
  type: ChartType;
  dataSource: Platform;
  selectedColumns: string[]; // Legacy support
  config?: WidgetConfig; // New Engine Config
}