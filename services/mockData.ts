import { CampaignData, AdData, KeywordData, PipelineStage, KommoPipeline, AgentPerformance, LeadChannel, DateRange, DemographicGroup, GeoRegion, SalesRepHistory, LossReason, GA4Source, GA4City, LinkedInDemographic, TikTokVideo, TrendPoint } from '../types';

const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomFloat = (min: number, max: number) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

const getMultiplier = (range: DateRange) => {
    const diffTime = Math.abs(range.endDate.getTime() - range.startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    // Base multiplier on weekly volume roughly
    return Math.max(0.5, diffDays / 7);
};

// --- META ADS GENERATORS ---

export const generateMetaCampaigns = (range: DateRange): CampaignData[] => {
  const m = getMultiplier(range);
  const data = [
    { id: 'm-1', name: 'Promo Verano - Conversión', status: 'Active', spend: 15500, impressions: 45000, clicks: 1200, conversions: 85 },
    { id: 'm-2', name: 'Retargeting Carrito', status: 'Active', spend: 8200, impressions: 12000, clicks: 800, conversions: 120 },
    { id: 'm-3', name: 'Brand Awareness Q3', status: 'Paused', spend: 5000, impressions: 80000, clicks: 400, conversions: 10 },
    { id: 'm-4', name: 'New Collection Drop', status: 'Active', spend: 12000, impressions: 65000, clicks: 1500, conversions: 110 },
    { id: 'm-5', name: 'Leads - Ebook Download', status: 'Active', spend: 4500, impressions: 25000, clicks: 900, conversions: 210 },
  ];

  return data.map(c => ({
      ...c,
      status: c.status as any,
      spend: Math.round(c.spend * m),
      impressions: Math.round(c.impressions * m),
      clicks: Math.round(c.clicks * m),
      conversions: Math.round(c.conversions * m),
      ctr: parseFloat(((c.clicks / c.impressions) * 100).toFixed(2)),
      cpc: parseFloat((c.spend / c.clicks).toFixed(2)),
      cpa: c.conversions > 0 ? parseFloat((c.spend / c.conversions).toFixed(2)) : 0,
      roas: c.conversions > 0 ? parseFloat((getRandomFloat(2.5, 6.0)).toFixed(2)) : 0
  }));
};

/** Builds a demo ad with consistent ratios; base numbers are per week and scale with the date range. */
const mockAd = (m: number, a: Omit<AdData, 'ctr' | 'cpc' | 'cpa' | 'roas'> & { roas?: number }): AdData => {
    const scaled: any = { ...a };
    for (const k of ['spend', 'impressions', 'clicks', 'conversions', 'reach', 'interactions', 'landingPageViews', 'linkClicks', 'videoViews', 'reactions', 'comments', 'shares', 'saves']) {
        if (typeof scaled[k] === 'number') scaled[k] = Math.round(scaled[k] * m);
    }
    const roas = a.roas ?? 0;
    return {
        ...scaled,
        ctr: scaled.impressions > 0 ? +(scaled.clicks / scaled.impressions * 100).toFixed(2) : 0,
        cpc: scaled.clicks > 0 ? +(scaled.spend / scaled.clicks).toFixed(2) : 0,
        cpa: scaled.conversions > 0 ? +(scaled.spend / scaled.conversions).toFixed(2) : 0,
        roas,
        revenue: Math.round(scaled.spend * roas),
    };
};

export const generateMetaAds = (range: DateRange): AdData[] => {
    const m = getMultiplier(range);
    const images = [
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=80",
        "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=300&q=80",
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80",
        "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&q=80",
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&q=80",
        "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=300&q=80",
        "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=300&q=80",
        "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=300&q=80"
    ];
    // Small random jitter so the period comparison shows movement
    const j = () => getRandomFloat(0.85, 1.15);
    return [
        mockAd(m, { id: 'ad-1', campaignId: 'm-1', name: 'Video_Lifestyle_v2', format: 'Video', status: 'Active', thumbnail: images[0], spend: 5000, impressions: 15000 * j(), reach: 9800, clicks: 450 * j(), linkClicks: 410, landingPageViews: 330 * j(), interactions: 1900 * j(), reactions: 1200, comments: 85, shares: 60, saves: 40, videoViews: 7200 * j(), conversions: 35, roas: 4.2 }),
        mockAd(m, { id: 'ad-2', campaignId: 'm-1', name: 'Carrusel_Products_Best', format: 'Carrusel', status: 'Active', thumbnail: images[1], spend: 4000, impressions: 12000 * j(), reach: 8100, clicks: 380 * j(), linkClicks: 350, landingPageViews: 290 * j(), interactions: 1150 * j(), reactions: 640, comments: 32, shares: 21, saves: 55, conversions: 28, roas: 3.8 }),
        mockAd(m, { id: 'ad-3', campaignId: 'm-2', name: 'Static_Discount_10', format: 'Imagen', status: 'Active', thumbnail: images[2], spend: 3000, impressions: 5000 * j(), reach: 2900, clicks: 300 * j(), linkClicks: 285, landingPageViews: 240 * j(), interactions: 520 * j(), reactions: 180, comments: 12, shares: 6, saves: 9, conversions: 50, roas: 8.5 }),
        mockAd(m, { id: 'ad-4', campaignId: 'm-4', name: 'Reels_Viral_Trend', format: 'Video', status: 'Active', thumbnail: images[3], spend: 6000, impressions: 40000 * j(), reach: 31000, clicks: 800 * j(), linkClicks: 690, landingPageViews: 510 * j(), interactions: 6400 * j(), reactions: 4100, comments: 310, shares: 420, saves: 260, videoViews: 24000 * j(), conversions: 45, roas: 2.9 }),
        mockAd(m, { id: 'ad-5', campaignId: 'm-4', name: 'Story_UGC_Review', format: 'Video', status: 'Active', thumbnail: images[4], spend: 4000, impressions: 25000 * j(), reach: 17500, clicks: 500 * j(), linkClicks: 460, landingPageViews: 380 * j(), interactions: 2800 * j(), reactions: 1500, comments: 140, shares: 95, saves: 70, videoViews: 13500 * j(), conversions: 35, roas: 3.2 }),
        mockAd(m, { id: 'ad-6', campaignId: 'm-5', name: 'Single_Image_Benefit', format: 'Imagen', status: 'Active', thumbnail: images[5], spend: 2500, impressions: 15000 * j(), reach: 11200, clicks: 600 * j(), linkClicks: 580, landingPageViews: 470 * j(), interactions: 980 * j(), reactions: 410, comments: 22, shares: 14, saves: 31, conversions: 120, roas: 1.5 }),
        mockAd(m, { id: 'ad-7', campaignId: 'm-3', name: 'Brand_Manifesto_30s', format: 'Video', status: 'Paused', thumbnail: images[6], spend: 1800, impressions: 32000 * j(), reach: 26000, clicks: 210 * j(), linkClicks: 160, landingPageViews: 110 * j(), interactions: 3900 * j(), reactions: 2600, comments: 190, shares: 240, saves: 120, videoViews: 19000 * j(), conversions: 4, roas: 0.6 }),
        mockAd(m, { id: 'ad-8', campaignId: 'm-2', name: 'DPA_Carrito_Abandonado', format: 'Catálogo', status: 'Active', thumbnail: images[7], spend: 2200, impressions: 6500 * j(), reach: 3100, clicks: 410 * j(), linkClicks: 395, landingPageViews: 350 * j(), interactions: 610 * j(), reactions: 120, comments: 6, shares: 3, saves: 14, conversions: 62, roas: 6.1 }),
    ];
};

export const generateGoogleAds = (range: DateRange): AdData[] => {
    const m = getMultiplier(range);
    const j = () => getRandomFloat(0.85, 1.15);
    return [
        mockAd(m, { id: 'gad-1', campaignId: 'g-1', campaignName: 'Search - Generic Keywords', name: 'Zapatillas Running | Envío Gratis 24h', format: 'Búsqueda', status: 'Active', spend: 5200, impressions: 5400 * j(), clicks: 820 * j(), interactions: 820 * j(), conversions: 95, roas: 4.6 }),
        mockAd(m, { id: 'gad-2', campaignId: 'g-1', campaignName: 'Search - Generic Keywords', name: 'Ofertas en Calzado Deportivo -30%', format: 'Búsqueda', status: 'Active', spend: 3900, impressions: 3800 * j(), clicks: 520 * j(), interactions: 520 * j(), conversions: 61, roas: 4.1 }),
        mockAd(m, { id: 'gad-3', campaignId: 'g-2', campaignName: 'Display - Remarketing', name: 'Banner Remarketing 300x250', format: 'Display', status: 'Active', spend: 2600, impressions: 92000 * j(), clicks: 540 * j(), interactions: 610 * j(), conversions: 26, roas: 2.7 }),
        mockAd(m, { id: 'gad-4', campaignId: 'g-3', campaignName: 'Search - Competitors', name: 'La Alternativa Nº1 a la Competencia', format: 'Búsqueda', status: 'Paused', spend: 1700, impressions: 2100 * j(), clicks: 260 * j(), interactions: 260 * j(), conversions: 30, roas: 3.3 }),
        mockAd(m, { id: 'gad-5', campaignId: 'g-2', campaignName: 'Display - Remarketing', name: 'Video Bumper 6s - Colección', format: 'Video', status: 'Active', spend: 1900, impressions: 58000 * j(), clicks: 260 * j(), interactions: 3100 * j(), videoViews: 21000 * j(), conversions: 12, roas: 1.9 }),
    ];
};

export const generateLinkedInAds = (range: DateRange): AdData[] => {
    const m = getMultiplier(range);
    const j = () => getRandomFloat(0.85, 1.15);
    return [
        mockAd(m, { id: 'lad-1', campaignId: 'l-1', campaignName: 'Lead Gen - Directores', name: 'Whitepaper: Tendencias 2026', format: 'Imagen', status: 'Active', spend: 18000, impressions: 2600 * j(), clicks: 85 * j(), landingPageViews: 70 * j(), interactions: 240 * j(), reactions: 120, comments: 14, shares: 9, conversions: 15, roas: 0.9 }),
        mockAd(m, { id: 'lad-2', campaignId: 'l-1', campaignName: 'Lead Gen - Directores', name: 'Caso de Éxito - Video 45s', format: 'Video', status: 'Active', spend: 17000, impressions: 2400 * j(), clicks: 65 * j(), landingPageViews: 52 * j(), interactions: 410 * j(), reactions: 190, comments: 22, shares: 18, videoViews: 1300 * j(), conversions: 10, roas: 0.7 }),
        mockAd(m, { id: 'lad-3', campaignId: 'l-2', campaignName: 'Brand - IT Managers', name: 'Carrusel: 5 Errores en IT', format: 'Carrusel', status: 'Paused', spend: 12000, impressions: 8000 * j(), clicks: 100 * j(), landingPageViews: 74 * j(), interactions: 520 * j(), reactions: 260, comments: 31, shares: 27, conversions: 5, roas: 0.2 }),
    ];
};

export const generateDemographics = (range: DateRange): DemographicGroup[] => {
    const m = getMultiplier(range);
    return [
        { ageGroup: '18-24', gender: 'Female', impressions: 15000 * m, spend: 2000 * m, conversions: 20 * m },
        { ageGroup: '25-34', gender: 'Female', impressions: 35000 * m, spend: 8000 * m, conversions: 95 * m },
        { ageGroup: '35-44', gender: 'Female', impressions: 12000 * m, spend: 3500 * m, conversions: 30 * m },
        { ageGroup: '45-54', gender: 'Female', impressions: 8000 * m, spend: 2500 * m, conversions: 15 * m },
        { ageGroup: '18-24', gender: 'Male', impressions: 10000 * m, spend: 1500 * m, conversions: 12 * m },
        { ageGroup: '25-34', gender: 'Male', impressions: 28000 * m, spend: 6500 * m, conversions: 75 * m },
        { ageGroup: '35-44', gender: 'Male', impressions: 9000 * m, spend: 2200 * m, conversions: 18 * m },
        { ageGroup: '45-54', gender: 'Male', impressions: 5000 * m, spend: 1800 * m, conversions: 10 * m },
    ];
};

export const generateGeoData = (range: DateRange): GeoRegion[] => {
    const m = getMultiplier(range);
    return [
        { region: 'CDMX', country: 'MX', spend: 8500 * m, conversions: 90 * m, roas: 4.5 },
        { region: 'Jalisco', country: 'MX', spend: 4200 * m, conversions: 45 * m, roas: 3.8 },
        { region: 'Nuevo León', country: 'MX', spend: 5100 * m, conversions: 58 * m, roas: 4.1 },
        { region: 'Querétaro', country: 'MX', spend: 1800 * m, conversions: 15 * m, roas: 3.2 },
        { region: 'Yucatán', country: 'MX', spend: 1200 * m, conversions: 12 * m, roas: 2.9 },
        { region: 'Edomex', country: 'MX', spend: 6500 * m, conversions: 55 * m, roas: 3.5 },
        { region: 'Puebla', country: 'MX', spend: 2100 * m, conversions: 20 * m, roas: 3.0 },
    ];
};

// --- GOOGLE ADS GENERATORS ---

export const generateGoogleCampaigns = (range: DateRange): CampaignData[] => {
  const m = getMultiplier(range);
  const data = [
    { id: 'g-1', name: 'Search - Generic Keywords', status: 'Active', spend: 12000, impressions: 10000, clicks: 1500, conversions: 180 },
    { id: 'g-2', name: 'Display - Remarketing', status: 'Active', spend: 4500, impressions: 150000, clicks: 900, conversions: 40 },
    { id: 'g-3', name: 'Search - Competitors', status: 'Active', spend: 6000, impressions: 4000, clicks: 600, conversions: 90 },
    { id: 'g-4', name: 'PMax - Best Sellers', status: 'Active', spend: 18000, impressions: 200000, clicks: 2500, conversions: 320 },
  ];
  return data.map(c => ({
      ...c,
      status: c.status as any,
      spend: Math.round(c.spend * m),
      impressions: Math.round(c.impressions * m),
      clicks: Math.round(c.clicks * m),
      conversions: Math.round(c.conversions * m),
      ctr: parseFloat(((c.clicks / c.impressions) * 100).toFixed(2)),
      cpc: parseFloat((c.spend / c.clicks).toFixed(2)),
      cpa: c.conversions > 0 ? parseFloat((c.spend / c.conversions).toFixed(2)) : 0,
      roas: getRandomFloat(3.0, 5.5)
  }));
};

export const generateKeywords = (range: DateRange): KeywordData[] => {
    const m = getMultiplier(range);
    return [
        { id: 'kw-1', text: 'comprar zapatillas online', campaignName: 'Search - Generic', status: 'Active', qualityScore: 9, impressions: 4000*m, clicks: 600*m, ctr: 15.0, cpc: 5.5, spend: 3300*m, conversions: 80*m },
        { id: 'kw-2', text: 'mejores zapatillas running', campaignName: 'Search - Generic', status: 'Active', qualityScore: 8, impressions: 3500*m, clicks: 450*m, ctr: 12.8, cpc: 6.2, spend: 2790*m, conversions: 55*m },
        { id: 'kw-3', text: 'ofertas calzado deportivo', campaignName: 'Search - Generic', status: 'Active', qualityScore: 7, impressions: 2500*m, clicks: 450*m, ctr: 18.0, cpc: 4.8, spend: 2160*m, conversions: 45*m },
        { id: 'kw-4', text: 'tienda nike oficial', campaignName: 'Search - Competitors', status: 'Active', qualityScore: 10, impressions: 1200*m, clicks: 200*m, ctr: 16.6, cpc: 3.5, spend: 700*m, conversions: 35*m },
        { id: 'kw-5', text: 'zapatillas baratas', campaignName: 'Search - Generic', status: 'Paused', qualityScore: 4, impressions: 8000*m, clicks: 300*m, ctr: 3.75, cpc: 2.1, spend: 630*m, conversions: 5*m },
        { id: 'kw-6', text: 'adidas outlet', campaignName: 'Search - Competitors', status: 'Active', qualityScore: 6, impressions: 5000*m, clicks: 400*m, ctr: 8.0, cpc: 3.0, spend: 1200*m, conversions: 20*m },
    ];
};

// --- KOMMO CRM DEEP DATA ---

export const generateKommoPipelines = (range: DateRange): KommoPipeline[] => {
    const m = getMultiplier(range);
    const pipe1: PipelineStage[] = [
        { id: 'st1', name: 'Entrante', count: Math.round(150 * m), value: 0, color: '#94a3b8' },
        { id: 'st2', name: 'Contactado', count: Math.round(95 * m), value: 0, color: '#60a5fa' },
        { id: 'st3', name: 'Demo Agendada', count: Math.round(45 * m), value: 0, color: '#818cf8' },
        { id: 'st4', name: 'Negociación', count: Math.round(20 * m), value: Math.round(1200000 * m), color: '#fbbf24' },
        { id: 'st5', name: 'Cierre Ganado', count: Math.round(12 * m), value: Math.round(850000 * m), color: '#4ade80', closed: 'won' },
    ];
    const pipe2: PipelineStage[] = [
        { id: 'st6', name: 'Solicitud', count: Math.round(60 * m), value: 0, color: '#94a3b8' },
        { id: 'st7', name: 'Cotización', count: Math.round(28 * m), value: Math.round(240000 * m), color: '#fbbf24' },
        { id: 'st8', name: 'Reserva confirmada', count: Math.round(9 * m), value: Math.round(180000 * m), color: '#4ade80' },
    ];
    return [
        { id: 'p1', name: 'Ventas B2B Principal', stages: pipe1 },
        { id: 'p2', name: 'Salas y Eventos', stages: pipe2 },
    ];
};

export const generateAgents = (): AgentPerformance[] => [
    { id: 'a1', name: 'Ana Garcia', leads: 65, sales: 12, avgResponseTime: '12m', conversionRate: 18.5, totalValue: 450000 },
    { id: 'a2', name: 'Carlos Ruiz', leads: 45, sales: 8, avgResponseTime: '25m', conversionRate: 17.7, totalValue: 320000 },
    { id: 'a3', name: 'Maria Lopez', leads: 82, sales: 5, avgResponseTime: '8m', conversionRate: 6.1, totalValue: 150000 },
    { id: 'a4', name: 'Luis Torres', leads: 30, sales: 9, avgResponseTime: '15m', conversionRate: 30.0, totalValue: 380000 },
];

export const generateSalesRepHistory = (range: DateRange): SalesRepHistory[] => {
    const weeks = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6'];
    return [
        { agentName: 'Ana Garcia', data: weeks.map(w => ({ date: w, sales: getRandomInt(2, 8), value: getRandomInt(50000, 150000) })) },
        { agentName: 'Carlos Ruiz', data: weeks.map(w => ({ date: w, sales: getRandomInt(1, 6), value: getRandomInt(30000, 120000) })) },
        { agentName: 'Maria Lopez', data: weeks.map(w => ({ date: w, sales: getRandomInt(0, 5), value: getRandomInt(10000, 80000) })) },
        { agentName: 'Luis Torres', data: weeks.map(w => ({ date: w, sales: getRandomInt(3, 9), value: getRandomInt(80000, 200000) })) },
    ];
};

export const generateLossReasons = (): LossReason[] => [
    { reason: 'Precio alto', count: 45 },
    { reason: 'Sin respuesta', count: 32 },
    { reason: 'Competencia', count: 18 },
    { reason: 'No calificado', count: 15 },
    { reason: 'Producto faltante', count: 10 },
    { reason: 'Presupuesto congelado', count: 8 },
];

// --- GA4 DEEP DATA ---

export const generateGA4Data = (range: DateRange) => {
    const m = getMultiplier(range);
    return {
      sessions: Math.round(12500 * m),
      users: Math.round(9800 * m),
      bounceRate: '42%',
      avgSessionDuration: '2m 15s',
      conversionRate: '3.2%',
      revenue: Math.round(450000 * m)
    };
};

export const generateGA4Sources = (range: DateRange): GA4Source[] => {
    const m = getMultiplier(range);
    return [
        { source: 'google', medium: 'cpc', sessions: Math.round(5000 * m), users: Math.round(3500 * m), revenue: Math.round(150000 * m), bounceRate: 45.2 },
        { source: 'facebook', medium: 'cpc', sessions: Math.round(3000 * m), users: Math.round(2500 * m), revenue: Math.round(90000 * m), bounceRate: 55.1 },
        { source: 'direct', medium: 'none', sessions: Math.round(2000 * m), users: Math.round(1800 * m), revenue: Math.round(120000 * m), bounceRate: 35.5 },
        { source: 'google', medium: 'organic', sessions: Math.round(1500 * m), users: Math.round(1200 * m), revenue: Math.round(50000 * m), bounceRate: 38.2 },
        { source: 'linkedin', medium: 'referral', sessions: Math.round(800 * m), users: Math.round(600 * m), revenue: Math.round(40000 * m), bounceRate: 40.0 },
    ];
};

export const generateGA4Cities = (range: DateRange): GA4City[] => {
    const m = getMultiplier(range);
    return [
        { city: 'Madrid', country: 'Spain', activeUsers: Math.round(1200 * m), revenue: Math.round(45000 * m) },
        { city: 'Barcelona', country: 'Spain', activeUsers: Math.round(900 * m), revenue: Math.round(32000 * m) },
        { city: 'Mexico City', country: 'Mexico', activeUsers: Math.round(2500 * m), revenue: Math.round(18000 * m) },
        { city: 'Bogota', country: 'Colombia', activeUsers: Math.round(1500 * m), revenue: Math.round(12000 * m) },
        { city: 'Buenos Aires', country: 'Argentina', activeUsers: Math.round(1100 * m), revenue: Math.round(15000 * m) },
    ];
};

// --- LINKEDIN DEEP DATA ---

export const generateLinkedInCampaigns = (range: DateRange): CampaignData[] => {
  const m = getMultiplier(range);
  return [{ 
      id: 'l-1', name: 'Lead Gen - Directores', status: 'Active', 
      spend: 35000*m, impressions: 5000*m, clicks: 150*m, conversions: 25*m, 
      ctr: 3.0, cpc: 233.3, cpa: 1400, roas: 0.8 
  },
  { 
      id: 'l-2', name: 'Brand - IT Managers', status: 'Paused', 
      spend: 12000*m, impressions: 8000*m, clicks: 100*m, conversions: 5*m, 
      ctr: 1.25, cpc: 120.0, cpa: 2400, roas: 0.2 
  }];
};

export const generateLinkedInDemographics = (range: DateRange): LinkedInDemographic[] => {
    const m = getMultiplier(range);
    return [
        { name: 'Information Technology', type: 'Industry', clicks: Math.round(500 * m), spend: Math.round(12000 * m), conversions: Math.round(15 * m) },
        { name: 'Financial Services', type: 'Industry', clicks: Math.round(300 * m), spend: Math.round(9000 * m), conversions: Math.round(12 * m) },
        { name: 'Marketing & Advertising', type: 'Industry', clicks: Math.round(200 * m), spend: Math.round(4000 * m), conversions: Math.round(5 * m) },
        { name: 'Business Development', type: 'JobFunction', clicks: Math.round(400 * m), spend: Math.round(10000 * m), conversions: Math.round(20 * m) },
        { name: 'Engineering', type: 'JobFunction', clicks: Math.round(350 * m), spend: Math.round(8500 * m), conversions: Math.round(8 * m) },
    ];
};

// --- TIKTOK DEEP DATA ---

export const generateTikTokCampaigns = (range: DateRange): CampaignData[] => {
    const m = getMultiplier(range);
    return [{ 
        id: 'tt-1', name: 'Viral #Challenge', status: 'Active', 
        spend: 14000*m, impressions: 220000*m, clicks: 3200*m, conversions: 180*m, 
        ctr: 1.45, cpc: 4.37, cpa: 77.7, roas: 3.1 
    },
    { 
        id: 'tt-2', name: 'Product Demo Spark', status: 'Active', 
        spend: 8500*m, impressions: 150000*m, clicks: 2100*m, conversions: 95*m, 
        ctr: 1.40, cpc: 4.04, cpa: 89.4, roas: 2.8 
    }];
};

export const generateTikTokVideos = (range: DateRange): TikTokVideo[] => {
    const m = getMultiplier(range);
    const images = [
        "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=150&q=80",
        "https://images.unsplash.com/photo-1611605698335-8b15f5c2dbec?w=150&q=80",
        "https://images.unsplash.com/photo-1626544827763-d516dce335ca?w=150&q=80",
        "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=150&q=80"
    ];
    
    return [
        { id: 'v1', status: 'Active', campaignName: 'Viral #Challenge', impressions: Math.round(900000 * m), clicks: Math.round(18900 * m), comments: Math.round(2100 * m), text: '5 Tips para Ahorrar', thumbnail: images[0], views: Math.round(500000 * m), likes: Math.round(45000 * m), shares: Math.round(1200 * m), ctr: 2.1, spend: 5000 * m, conversions: 120 * m },
        { id: 'v2', status: 'Active', campaignName: 'Product Demo Spark', impressions: Math.round(640000 * m), clicks: Math.round(11500 * m), comments: Math.round(1300 * m), text: 'Unboxing Nuevo Producto', thumbnail: images[1], views: Math.round(350000 * m), likes: Math.round(28000 * m), shares: Math.round(800 * m), ctr: 1.8, spend: 3500 * m, conversions: 90 * m },
        { id: 'v3', status: 'Active', campaignName: 'Product Demo Spark', impressions: Math.round(260000 * m), clicks: Math.round(3100 * m), comments: Math.round(420 * m), text: 'Reacción Cliente Feliz', thumbnail: images[2], views: Math.round(120000 * m), likes: Math.round(8000 * m), shares: Math.round(200 * m), ctr: 1.2, spend: 2000 * m, conversions: 30 * m },
        { id: 'v4', status: 'Paused', campaignName: 'Viral #Challenge', impressions: Math.round(190000 * m), clicks: Math.round(1700 * m), comments: Math.round(260 * m), text: 'Behind the Scenes', thumbnail: images[3], views: Math.round(80000 * m), likes: Math.round(5000 * m), shares: Math.round(150 * m), ctr: 0.9, spend: 1000 * m, conversions: 15 * m },
    ];
};

export const generateChannels = () => [
    { name: 'Meta Ads', count: 210, conversionRate: 3.5 },
    { name: 'Google Search', count: 165, conversionRate: 5.2 },
    { name: 'LinkedIn', count: 50, conversionRate: 8.1 },
    { name: 'Directo', count: 90, conversionRate: 2.1 },
    { name: 'TikTok', count: 120, conversionRate: 1.8 },
];
// --- DAILY TREND ---

export const generateTrend = (range: DateRange): TrendPoint[] => {
    const out: TrendPoint[] = [];
    const d = new Date(range.startDate);
    d.setHours(0, 0, 0, 0);
    while (d <= range.endDate) {
        const spend = getRandomInt(9000, 16000);
        out.push({
            date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            spend,
            revenue: Math.round(spend * getRandomFloat(2.6, 4.4)),
            impressions: Math.round(spend * getRandomFloat(60, 90)),
            clicks: Math.round(spend * getRandomFloat(1.1, 1.8)),
            conversions: Math.round(spend * getRandomFloat(0.02, 0.04)),
        });
        d.setDate(d.getDate() + 1);
    }
    return out;
};
