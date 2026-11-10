import React, { useState, useEffect } from 'react';
import { Platform, CampaignData, AdData, KeywordData, AgentPerformance } from '../types';
import { useData } from '../context/DataContext';
import { DateRangePicker } from './DateRangePicker';
import { platformKpis, pctChange } from '../services/kpis';
import { 
  DollarSign, MousePointer, Eye, Target, Users, TrendingUp, Filter, 
  MapPin, Image as ImageIcon, Search, Phone, UserX, UserCheck, AlertCircle, Unplug, Briefcase, Activity,
  Smartphone, Map, Building, Video, Heart, Share2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line, CartesianGrid, Legend, ComposedChart, AreaChart, Area
} from 'recharts';

// --- COLORS ---
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// --- SUB COMPONENTS ---

// trend: % vs previous period (null = nothing to compare). tone: whether a rise is good, bad or neutral.
type Tone = 'up' | 'down' | 'neutral';
const trendClass = (trend: number, tone: Tone) => {
    if (trend === 0 || tone === 'neutral') return 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300';
    return (tone === 'up') === (trend > 0) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
};

const money = (n: number, decimals = 0) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const KpiCard = ({ title, value, subValue, icon: Icon, colorClass, trend, tone = 'up' }: any) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all">
        <div className="flex justify-between items-start mb-2">
            <div className={`p-2.5 rounded-lg ${colorClass}`}>
                <Icon className="h-5 w-5" />
            </div>
            {trend != null && (
                <span title="vs periodo anterior" className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${trendClass(trend, tone)}`}>
                    {trend > 0 ? '+' : ''}{trend}%
                </span>
            )}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</h3>
            {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
        </div>
    </div>
);

const AdCreativeCard: React.FC<{ ad: any, isVideo?: boolean }> = ({ ad, isVideo }) => (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden group hover:border-indigo-500 transition-all">
        <div className="relative h-48 bg-gray-100 dark:bg-slate-700 overflow-hidden">
            {ad.thumbnail ? (
                <img src={ad.thumbnail} alt={ad.text || ad.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
                <div className="flex items-center justify-center h-full">
                    {isVideo ? <Video className="h-12 w-12 text-gray-300" /> : <ImageIcon className="h-12 w-12 text-gray-300" />}
                </div>
            )}
            {/* Overlay Metrics */}
            {isVideo ? (
                 <div className="absolute bottom-2 left-2 flex space-x-2">
                     <div className="bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center">
                         <Eye className="h-3 w-3 mr-1" /> {(ad.views/1000).toFixed(1)}k
                     </div>
                 </div>
            ) : (
                <div className={`absolute top-2 right-2 text-white text-xs px-2 py-1 rounded backdrop-blur-sm ${ad.roas > 3 ? 'bg-green-600/80' : 'bg-black/60'}`}>
                    ROAS {ad.roas}x
                </div>
            )}
        </div>
        <div className="p-4">
            <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate mb-2">{ad.text || ad.name}</h4>
            
            {isVideo ? (
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center"><Heart className="h-3 w-3 mr-1 text-pink-500" /> {ad.likes.toLocaleString()}</span>
                    <span className="flex items-center"><Share2 className="h-3 w-3 mr-1 text-blue-500" /> {ad.shares.toLocaleString()}</span>
                    <span className="font-bold text-gray-900 dark:text-white">CTR {ad.ctr}%</span>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 dark:bg-slate-900 p-2 rounded">
                        <span className="text-gray-400 block">CTR</span>
                        <span className="font-bold text-gray-700 dark:text-gray-300">{ad.ctr}%</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-900 p-2 rounded">
                        <span className="text-gray-400 block">CPA</span>
                        <span className="font-bold text-gray-700 dark:text-gray-300">${ad.cpa.toFixed(2)}</span>
                    </div>
                </div>
            )}
        </div>
    </div>
);

// --- MAIN COMPONENT ---

export const Reports: React.FC = () => {
  const { data, previousData, dateRange, setDateRange, preferences } = useData();
  const kpi = platformKpis(data);
  const prevKpi = previousData ? platformKpis(previousData) : null;
  /** % change of kpi[platform][metric] vs the previous period */
  const delta = <P extends keyof typeof kpi>(platform: P, metric: keyof (typeof kpi)[P]) =>
      pctChange(kpi[platform][metric] as number, prevKpi ? prevKpi[platform][metric] as number : null);
  const visiblePlatforms = Object.values(Platform).filter(p => preferences.visiblePlatforms[p] !== false);
  const [activeTab, setActiveTab] = useState<Platform>(visiblePlatforms[0] || Platform.Meta);
  const [subTab, setSubTab] = useState<'overview' | 'creatives' | 'audience'>('overview');

  // --- META ADS DASHBOARD ---
  const MetaDashboard = () => {
      const { campaigns, ads, demographics, geo } = data.meta;
      const k = kpi.meta;

      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="flex space-x-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
                  {['overview', 'creatives', 'audience'].map(t => (
                      <button 
                        key={t}
                        onClick={() => setSubTab(t as any)}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${subTab === t ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                      >
                          {t === 'overview' ? 'Visión General' : t === 'creatives' ? 'Anuncios & Creativos' : 'Audiencia & Geo'}
                      </button>
                  ))}
              </div>

              {subTab === 'overview' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <KpiCard title="Inversión" value={money(k.spend)} subValue="vs periodo anterior" trend={delta('meta', 'spend')} tone="neutral" icon={DollarSign} colorClass="bg-blue-100 text-blue-600" />
                        <KpiCard title="ROAS Promedio" value={`${k.roas.toFixed(2)}x`} subValue={`Ingresos: ${money(k.revenue)}`} trend={delta('meta', 'roas')} icon={TrendingUp} colorClass="bg-purple-100 text-purple-600" />
                        <KpiCard title="Conversiones" value={Math.round(k.conversions).toLocaleString()} subValue={`Costo/Conv: ${money(k.cpa, 2)}`} trend={delta('meta', 'conversions')} icon={Target} colorClass="bg-green-100 text-green-600" />
                        <KpiCard title="CTR Global" value={`${k.ctr.toFixed(2)}%`} subValue={`${k.clicks.toLocaleString()} clics`} trend={delta('meta', 'ctr')} icon={MousePointer} colorClass="bg-orange-100 text-orange-600" />
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Desempeño de Campañas (Gasto vs ROAS)</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={campaigns}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} angle={-15} textAnchor="end" />
                                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                                    <Tooltip contentStyle={{borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="spend" name="Inversión ($)" fill="#8884d8" radius={[4, 4, 0, 0]} barSize={40} />
                                    <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS" stroke="#82ca9d" strokeWidth={3} dot={{r: 4}} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                  </>
              )}

              {subTab === 'creatives' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {ads.map(ad => <AdCreativeCard key={ad.id} ad={ad} />)}
                  </div>
              )}

              {subTab === 'audience' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Demografía (Edad y Género)</h3>
                          <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={demographics} layout="vertical">
                                      <XAxis type="number" hide />
                                      <YAxis dataKey="ageGroup" type="category" width={50} />
                                      <Tooltip cursor={{fill: 'transparent'}} />
                                      <Bar dataKey="conversions" fill="#8884d8" radius={[0, 4, 4, 0]}>
                                        {demographics.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.gender === 'Female' ? '#ec4899' : '#3b82f6'} />
                                        ))}
                                      </Bar>
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                          <div className="flex justify-center mt-4 space-x-4 text-xs">
                              <span className="flex items-center"><div className="w-3 h-3 bg-pink-500 rounded-full mr-1"></div> Mujeres</span>
                              <span className="flex items-center"><div className="w-3 h-3 bg-blue-500 rounded-full mr-1"></div> Hombres</span>
                          </div>
                      </div>

                      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Top Regiones (ROAS)</h3>
                          <div className="space-y-4">
                              {geo.map((g, i) => (
                                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
                                      <div className="flex items-center">
                                          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg mr-3 text-indigo-600">
                                              <MapPin className="h-4 w-4" />
                                          </div>
                                          <div>
                                              <p className="font-bold text-gray-900 dark:text-white text-sm">{g.region}</p>
                                              <p className="text-xs text-gray-500">{g.country}</p>
                                          </div>
                                      </div>
                                      <div className="text-right">
                                          <p className="font-bold text-indigo-600 dark:text-indigo-400">{g.roas}x</p>
                                          <p className="text-xs text-gray-400">ROAS</p>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              )}
          </div>
      );
  };

  // --- GOOGLE ADS DASHBOARD ---
  const GoogleDashboard = () => {
      const { keywords, campaigns } = data.google;
      return (
          <div className="space-y-6 animate-in fade-in">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <KpiCard title="Clics Búsqueda" value={kpi.google.clicks.toLocaleString()} trend={delta('google', 'clicks')} icon={MousePointer} colorClass="bg-blue-100 text-blue-600" />
                  <KpiCard title="Nivel Calidad Prom." value={kpi.google.qualityScore > 0 ? `${kpi.google.qualityScore.toFixed(1)}/10` : '—'} subValue="Ponderado por impresiones" trend={delta('google', 'qualityScore')} icon={Target} colorClass="bg-green-100 text-green-600" />
                  <KpiCard title="Conversiones" value={Math.round(kpi.google.conversions).toLocaleString()} trend={delta('google', 'conversions')} icon={Users} colorClass="bg-yellow-100 text-yellow-600" />
                  <KpiCard title="CPA Promedio" value={money(kpi.google.cpa, 2)} trend={delta('google', 'cpa')} tone="down" icon={DollarSign} colorClass="bg-red-100 text-red-600" />
             </div>
             {/* Similar to Meta but simplified for code brevity */}
          </div>
      );
  };

  // --- GA4 DASHBOARD (NEW) ---
  const GA4Dashboard = () => {
      const { sessions, revenue, users, conversionRate, sources, cities } = data.ga4;

      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <KpiCard title="Sesiones Totales" value={sessions.toLocaleString()} subValue="vs periodo anterior" trend={delta('ga4', 'sessions')} icon={MousePointer} colorClass="bg-indigo-100 text-indigo-600" />
                  <KpiCard title="Usuarios Únicos" value={users.toLocaleString()} subValue="Usuarios totales" trend={delta('ga4', 'users')} icon={Users} colorClass="bg-blue-100 text-blue-600" />
                  <KpiCard title="Ingresos Web" value={money(revenue)} subValue="E-commerce Tracking" trend={delta('ga4', 'revenue')} icon={DollarSign} colorClass="bg-green-100 text-green-600" />
                  <KpiCard title="Tasa Conversión" value={conversionRate} subValue="Sesiones con evento clave" trend={delta('ga4', 'conversionRate')} icon={Activity} colorClass="bg-yellow-100 text-yellow-600" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* TRAFFIC SOURCES TABLE */}
                  <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Fuentes de Tráfico (Adquisición)</h3>
                      <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                              <thead>
                                  <tr className="border-b border-gray-100 dark:border-slate-700">
                                      <th className="pb-3 text-gray-500">Fuente / Medio</th>
                                      <th className="pb-3 text-right text-gray-500">Sesiones</th>
                                      <th className="pb-3 text-right text-gray-500">Usuarios</th>
                                      <th className="pb-3 text-right text-gray-500">Ingresos</th>
                                      <th className="pb-3 text-right text-gray-500">Rebote</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {sources.map((src, i) => (
                                      <tr key={i} className="border-b border-gray-50 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                          <td className="py-3 font-medium text-gray-900 dark:text-white">{src.source} / {src.medium}</td>
                                          <td className="py-3 text-right text-gray-600 dark:text-gray-300">{src.sessions.toLocaleString()}</td>
                                          <td className="py-3 text-right text-gray-600 dark:text-gray-300">{src.users.toLocaleString()}</td>
                                          <td className="py-3 text-right font-medium text-green-600">${src.revenue.toLocaleString()}</td>
                                          <td className="py-3 text-right text-gray-600 dark:text-gray-300">{src.bounceRate}%</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {/* GEO MAP (List View) */}
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top Ciudades</h3>
                      <div className="space-y-4">
                          {cities.map((city, i) => (
                              <div key={i} className="flex items-center justify-between">
                                  <div className="flex items-center">
                                      <div className="bg-indigo-50 dark:bg-slate-700 p-2 rounded-lg mr-3">
                                          <Map className="h-4 w-4 text-indigo-500" />
                                      </div>
                                      <div>
                                          <p className="font-bold text-gray-900 dark:text-white text-sm">{city.city}</p>
                                          <p className="text-xs text-gray-500">{city.country}</p>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <p className="font-bold text-gray-900 dark:text-white text-sm">${city.revenue.toLocaleString()}</p>
                                      <div className="w-16 h-1 bg-gray-100 rounded-full mt-1">
                                          <div className="h-1 bg-indigo-500 rounded-full" style={{width: `${Math.random() * 100}%`}}></div>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  // --- LINKEDIN DASHBOARD (NEW) ---
  const LinkedInDashboard = () => {
      const { campaigns, demographics } = data.linkedin;
      
      const industries = demographics.filter(d => d.type === 'Industry');
      const functions = demographics.filter(d => d.type === 'JobFunction');

      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <KpiCard title="Gasto Total" value={money(kpi.linkedin.spend)} trend={delta('linkedin', 'spend')} tone="neutral" icon={DollarSign} colorClass="bg-blue-100 text-blue-600" />
                  <KpiCard title="Impresiones" value={Math.round(kpi.linkedin.impressions).toLocaleString()} trend={delta('linkedin', 'impressions')} icon={Eye} colorClass="bg-indigo-100 text-indigo-600" />
                  <KpiCard title="Clicks" value={Math.round(kpi.linkedin.clicks).toLocaleString()} trend={delta('linkedin', 'clicks')} icon={MousePointer} colorClass="bg-cyan-100 text-cyan-600" />
                  <KpiCard title="Leads B2B" value={Math.round(kpi.linkedin.conversions).toLocaleString()} trend={delta('linkedin', 'conversions')} icon={Briefcase} colorClass="bg-green-100 text-green-600" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* INDUSTRY CHART */}
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-4">Desglose por Industria</h3>
                      <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={industries} layout="vertical">
                                  <XAxis type="number" hide />
                                  <YAxis dataKey="name" type="category" width={140} tick={{fontSize: 11}} />
                                  <Tooltip cursor={{fill: 'transparent'}} />
                                  <Bar dataKey="spend" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>

                  {/* JOB FUNCTION CHART */}
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-4">Desglose por Función Laboral</h3>
                      <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie data={functions} dataKey="clicks" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8">
                                      {functions.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                  </Pie>
                                  <Tooltip />
                                  <Legend />
                              </PieChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  // --- TIKTOK DASHBOARD (NEW) ---
  const TikTokDashboard = () => {
      const { campaigns, videos } = data.tiktok;

      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <KpiCard title="Inversión" value={money(kpi.tiktok.spend)} trend={delta('tiktok', 'spend')} tone="neutral" icon={DollarSign} colorClass="bg-pink-100 text-pink-600" />
                  <KpiCard title="Video Views" value={(kpi.tiktok.views / 1000).toFixed(1) + 'k'} subValue="Top videos por gasto" trend={delta('tiktok', 'views')} icon={Video} colorClass="bg-black text-white" />
                  <KpiCard title="CPM" value={money(kpi.tiktok.cpm, 2)} subValue="Costo por mil impresiones" trend={delta('tiktok', 'cpm')} tone="down" icon={Target} colorClass="bg-cyan-100 text-cyan-600" />
                  <KpiCard title="Conversiones" value={Math.round(kpi.tiktok.conversions).toLocaleString()} trend={delta('tiktok', 'conversions')} icon={Smartphone} colorClass="bg-green-100 text-green-600" />
              </div>

              {/* VIRAL GALLERY */}
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Creativos Top Performance</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {videos.slice(0, 20).map(video => (
                      <AdCreativeCard key={video.id} ad={video} isVideo={true} />
                  ))}
              </div>
          </div>
      );
  };

  // --- KOMMO CRM DASHBOARD ---
  const KommoDashboard = () => {
      const { agents, salesHistory, lossReasons, pipelines } = data.kommo;
      
      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <KpiCard title="Valor Ganado" value={money(kpi.kommo.wonValue)} subValue={`${kpi.kommo.sales.toLocaleString()} ventas cerradas`} trend={delta('kommo', 'wonValue')} icon={Briefcase} colorClass="bg-indigo-100 text-indigo-600" />
                  <KpiCard title="Tasa Conversión Lead" value={`${kpi.kommo.leadConversion.toFixed(1)}%`} subValue={`Lead → Cliente (${kpi.kommo.leads.toLocaleString()} leads)`} trend={delta('kommo', 'leadConversion')} icon={Target} colorClass="bg-blue-100 text-blue-600" />
                  <KpiCard title="Oportunidades Activas" value={kpi.kommo.opportunities.toLocaleString()} trend={delta('kommo', 'opportunities')} icon={UserCheck} colorClass="bg-green-100 text-green-600" />
                  <KpiCard title="Leads Perdidos" value={kpi.kommo.lost.toLocaleString()} trend={delta('kommo', 'lost')} tone="down" icon={UserX} colorClass="bg-red-100 text-red-600" />
              </div>

              {/* SALES REP PERFORMANCE - PDF STYLE */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Ventas por Vendedor (Histórico Semanal)</h3>
                  <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={salesHistory[0]?.data.map((_, i) => {
                              const point: any = { name: salesHistory[0].data[i].date };
                              salesHistory.forEach(agent => {
                                  point[agent.agentName] = agent.data[i].value;
                              });
                              return point;
                          })}>
                              <defs>
                                {salesHistory.map((agent, i) => (
                                    <linearGradient key={agent.agentName} id={`color${i}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0}/>
                                    </linearGradient>
                                ))}
                              </defs>
                              <XAxis dataKey="name" />
                              <YAxis />
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <Tooltip />
                              <Legend />
                              {salesHistory.map((agent, i) => (
                                  <Area key={agent.agentName} type="monotone" dataKey={agent.agentName} stackId="1" stroke={COLORS[i % COLORS.length]} fill={`url(#color${i})`} />
                              ))}
                          </AreaChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* AGENT TABLE */}
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-4">Tabla de Líderes (Ventas)</h3>
                      <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                              <thead>
                                  <tr className="border-b border-gray-100 dark:border-slate-700">
                                      <th className="text-left py-2 font-medium text-gray-500">Agente</th>
                                      <th className="text-right py-2 font-medium text-gray-500">Valor ($)</th>
                                      <th className="text-right py-2 font-medium text-gray-500">Leads</th>
                                      <th className="text-right py-2 font-medium text-gray-500">Conv.</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {agents.map((agent, i) => (
                                      <tr key={agent.id} className="border-b border-gray-50 dark:border-slate-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                          <td className="py-3 flex items-center">
                                              <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mr-2">
                                                  {i + 1}
                                              </div>
                                              <span className="font-medium text-gray-900 dark:text-white">{agent.name}</span>
                                          </td>
                                          <td className="py-3 text-right font-mono text-gray-600 dark:text-gray-300">${agent.totalValue.toLocaleString()}</td>
                                          <td className="py-3 text-right text-gray-600 dark:text-gray-300">{agent.leads}</td>
                                          <td className="py-3 text-right font-bold text-green-600">{agent.conversionRate}%</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {/* LOSS REASONS */}
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-4">Razones de Pérdida</h3>
                      <div className="h-64 flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie
                                    data={lossReasons}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="count"
                                    nameKey="reason"
                                  >
                                      {lossReasons.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                  </Pie>
                                  <Tooltip />
                                  <Legend layout="vertical" verticalAlign="middle" align="right" />
                              </PieChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reportes Avanzados</h1>
            <p className="text-gray-500 dark:text-gray-400">Análisis granular para la toma de decisiones.</p>
        </div>
        <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
      </div>

      {/* Main Platform Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {visiblePlatforms.map((platform) => (
            <button
              key={platform}
              onClick={() => { setActiveTab(platform); setSubTab('overview'); }}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center
                ${activeTab === platform
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
              `}
            >
              {platform}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[500px]">
        {activeTab === Platform.Meta && <MetaDashboard />}
        {activeTab === Platform.GoogleAds && <GoogleDashboard />}
        {activeTab === Platform.Kommo && <KommoDashboard />}
        {activeTab === Platform.GA4 && <GA4Dashboard />}
        {activeTab === Platform.LinkedIn && <LinkedInDashboard />}
        {activeTab === Platform.TikTok && <TikTokDashboard />}
      </div>
    </div>
  );
};