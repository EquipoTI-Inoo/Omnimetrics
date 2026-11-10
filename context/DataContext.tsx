import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { 
    CampaignData, AdData, KeywordData, DemographicGroup, GeoRegion, 
    KommoPipeline, AgentPerformance, LeadChannel, SalesRepHistory, LossReason,
    DateRange, AppPreferences, BlendedMetrics, CustomWidget, WidgetConfig,
    GA4Source, GA4City, LinkedInDemographic, TikTokVideo, TrendPoint
} from '../types';
import { StorageService } from '../services/storageService';
import { Api, UnauthorizedError, SyncResponse } from '../services/apiClient';
import { computeBlended } from '../services/kpis';
import * as Mock from '../services/mockData';

export interface GlobalData {
  meta: {
      campaigns: CampaignData[];
      ads: AdData[];
      demographics: DemographicGroup[];
      geo: GeoRegion[];
  };
  google: {
      campaigns: CampaignData[];
      keywords: KeywordData[];
      ads?: AdData[];
  };
  linkedin: {
      campaigns: CampaignData[];
      demographics: LinkedInDemographic[];
      ads?: AdData[];
  };
  tiktok: {
      campaigns: CampaignData[];
      videos: TikTokVideo[];
  };
  kommo: {
    pipelines: KommoPipeline[];
    agents: AgentPerformance[];
    channels: LeadChannel[];
    salesHistory: SalesRepHistory[];
    lossReasons: LossReason[];
  };
  ga4: {
      sessions: number;
      revenue: number;
      users: number;
      conversionRate: string;
      bounceRate: string;
      avgSessionDuration: string;
      sources: GA4Source[];
      cities: GA4City[];
  };
  trend: TrendPoint[];
}

interface IntegrityReport {
  status: 'Healthy' | 'Warning' | 'Error';
  checks: string[];
  lastChecked: Date;
}

interface DataContextType {
  data: GlobalData;
  /** Same-length period right before dateRange (null until loaded or if it failed) */
  previousData: GlobalData | null;
  blendedMetrics: BlendedMetrics;
  previousBlended: BlendedMetrics | null;
  customWidgets: WidgetConfig[]; // Updated to use strict Config
  addWidget: (w: WidgetConfig) => void;
  removeWidget: (id: string) => void;
  isLoading: boolean;
  lastSync: Date;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  integrityReport: IntegrityReport;
  triggerSync: () => Promise<void>;
  preferences: AppPreferences;
  updatePreferences: (newPrefs: AppPreferences) => void;
  /** Vista compartida: nombre del enlace y pestañas permitidas (null fuera de ella o hasta cargar) */
  shareInfo: SyncResponse['share'] | null;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const EMPTY_DATA: GlobalData = {
  meta: { campaigns: [], ads: [], demographics: [], geo: [] },
  google: { campaigns: [], keywords: [], ads: [] },
  linkedin: { campaigns: [], demographics: [], ads: [] },
  tiktok: { campaigns: [], videos: [] },
  kommo: { pipelines: [], agents: [], channels: [], salesHistory: [], lossReasons: [] },
  ga4: { sessions: 0, revenue: 0, users: 0, conversionRate: '0%', bounceRate: '0%', avgSessionDuration: '0s', sources: [], cities: [] },
  trend: []
};

/** The period of equal length that ends the day before `range` starts. */
const previousPeriod = (range: DateRange): DateRange => {
  const day = 86400000;
  const length = Math.round((range.endDate.getTime() - range.startDate.getTime()) / day) + 1;
  const endDate = new Date(range.startDate.getTime() - day);
  return { startDate: new Date(endDate.getTime() - (length - 1) * day), endDate, label: 'Periodo anterior' };
};

const buildMockData = (range: DateRange): GlobalData => ({
  meta: {
    campaigns: Mock.generateMetaCampaigns(range),
    ads: Mock.generateMetaAds(range),
    demographics: Mock.generateDemographics(range),
    geo: Mock.generateGeoData(range)
  },
  google: {
    campaigns: Mock.generateGoogleCampaigns(range),
    keywords: Mock.generateKeywords(range),
    ads: Mock.generateGoogleAds(range)
  },
  linkedin: {
    campaigns: Mock.generateLinkedInCampaigns(range),
    demographics: Mock.generateLinkedInDemographics(range),
    ads: Mock.generateLinkedInAds(range)
  },
  tiktok: {
    campaigns: Mock.generateTikTokCampaigns(range),
    videos: Mock.generateTikTokVideos(range)
  },
  kommo: {
    pipelines: Mock.generateKommoPipelines(range),
    agents: Mock.generateAgents(),
    channels: Mock.generateChannels(),
    salesHistory: Mock.generateSalesRepHistory(range),
    lossReasons: Mock.generateLossReasons()
  },
  ga4: {
    ...Mock.generateGA4Data(range),
    sources: Mock.generateGA4Sources(range),
    cities: Mock.generateGA4Cities(range)
  },
  trend: Mock.generateTrend(range)
});

export const DataProvider: React.FC<{ children: ReactNode; onUnauthorized: () => void; /** Vista compartida: solo lectura, datos reales vía el enlace */ shareToken?: string }> = ({ children, onUnauthorized, shareToken }) => {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date(),
    label: 'Últimos 30 días'
  });

  const [preferences, setPreferences] = useState<AppPreferences>(() =>
    shareToken ? { ...StorageService.getPreferences(), isDemoMode: false } : StorageService.getPreferences());
  const [customWidgets, setCustomWidgets] = useState<WidgetConfig[]>([]);

  // Load Widgets
  useEffect(() => {
    if (shareToken) return; // la vista compartida no usa los gráficos personalizados de este navegador
    // Migration: Transform legacy CustomWidget to WidgetConfig if needed
    const raw = StorageService.getCustomWidgets() as any[];
    const clean: WidgetConfig[] = raw.map(w => {
        if (w.config) return w.config;
        return {
            id: w.id,
            title: w.title,
            dataSource: w.dataSource,
            chartType: w.type || 'table',
            dimensions: ['name'], // default fallback
            metrics: w.selectedColumns?.filter((c: string) => c !== 'name' && c !== 'status') || ['spend'],
            pinnedToDashboard: true
        };
    });
    setCustomWidgets(clean);
  }, []);

  const [data, setData] = useState<GlobalData>(EMPTY_DATA);

  const [previousData, setPreviousData] = useState<GlobalData | null>(null);
  const [shareInfo, setShareInfo] = useState<SyncResponse['share'] | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState(new Date());
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport>({ status: 'Healthy', checks: [], lastChecked: new Date() });

  const updatePreferences = (newPrefs: AppPreferences) => {
      setPreferences(newPrefs);
      if (!shareToken) StorageService.savePreferences(newPrefs);
  };

  const addWidget = (w: WidgetConfig) => {
      const updated = [...customWidgets, w];
      setCustomWidgets(updated);
      StorageService.saveCustomWidgets(updated as any); // Type assertion for compatibility
  };

  const removeWidget = (id: string) => {
      const updated = customWidgets.filter(w => w.id !== id);
      setCustomWidgets(updated);
      StorageService.saveCustomWidgets(updated as any);
  };

  const blendedMetrics = useMemo(() => computeBlended(data, preferences.isDemoMode), [data, preferences.isDemoMode]);
  const previousBlended = useMemo(
    () => previousData ? computeBlended(previousData, preferences.isDemoMode) : null,
    [previousData, preferences.isDemoMode]);

  const runETLPipeline = async (fresh = false) => {
    setIsLoading(true);
    const prevRange = previousPeriod(dateRange);

    if (preferences.isDemoMode) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setData(buildMockData(dateRange));
        setPreviousData(buildMockData(prevRange));
        setIntegrityReport({ status: 'Healthy', checks: ['✅ MODO PRO: Datos simulados cargados.'], lastChecked: new Date() });
        setLastSync(new Date());
        setIsLoading(false);
        return;
    }

    // Real data: the backend queries every connected platform server-side.
    // The previous period (same length, right before) feeds the % change badges; if it fails, badges just hide.
    try {
        const [res, prev] = await Promise.all([
            shareToken ? Api.publicSync(shareToken, dateRange.startDate, dateRange.endDate) : Api.sync(dateRange.startDate, dateRange.endDate, { fresh }),
            (shareToken ? Api.publicSync(shareToken, prevRange.startDate, prevRange.endDate, { light: true }) : Api.sync(prevRange.startDate, prevRange.endDate, { background: true })).catch(() => null),
        ]);
        setData(res.data);
        setPreviousData(prev ? prev.data : null);
        if (res.share) setShareInfo(res.share);
        const failed = Object.entries(res.errors);
        const warned = Object.entries(res.warnings || {});
        const checks = [
            ...res.connected.filter(p => !res.errors[p] && !res.warnings?.[p]).map(p => `✅ ${p}: sincronizado`),
            ...warned.map(([p, msg]) => `⚠️ ${p}: ${msg}`),
            ...failed.map(([p, msg]) => `❌ ${p}: ${msg}`),
        ];
        if (res.connected.length === 0) checks.push('⚠️ No hay plataformas conectadas. Ve a Conexiones.');
        setIntegrityReport({
            status: failed.length === 0 ? (warned.length ? 'Warning' : 'Healthy') : failed.length === res.connected.length ? 'Error' : 'Warning',
            checks,
            lastChecked: new Date(),
        });
        setLastSync(new Date(res.syncedAt));
    } catch (e: any) {
        if (e instanceof UnauthorizedError) { onUnauthorized(); return; }
        setIntegrityReport({ status: 'Error', checks: [`❌ ${e.message}`], lastChecked: new Date() });
    } finally {
        setIsLoading(false);
    }
  };

  const triggerSync = async () => { await runETLPipeline(true); };
  useEffect(() => { runETLPipeline(); }, [dateRange, preferences.isDemoMode]);

  return (
    <DataContext.Provider value={{
      data, previousData, blendedMetrics, previousBlended, isLoading, lastSync, dateRange, setDateRange, integrityReport, triggerSync, preferences, updatePreferences, customWidgets, addWidget, removeWidget, shareInfo
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};