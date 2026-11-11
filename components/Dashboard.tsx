import React, { useState, useEffect } from 'react';
import { BusinessGoal } from '../types';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, ComposedChart, Line, LineChart, PieChart, Pie, Cell
} from 'recharts';
import { Plus, Trash2, Activity, Sparkles, ArrowUpRight, ArrowDownRight, ArrowDown } from 'lucide-react';
import { useData } from '../context/DataContext';
import { DateRangePicker } from './DateRangePicker';
import { WidgetEngine } from '../services/widgetEngine';
import { pctChange } from '../services/kpis';
import { PipelineSelect, usePipelineSelection } from './KommoWidgets';

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const compact = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n));

const Spark: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  const mn = Math.min(...values), mx = Math.max(...values);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${(i * 96 / (values.length - 1)).toFixed(1)} ${(28 - (v - mn) / (mx - mn || 1) * 24).toFixed(1)}`).join(' ');
  return <svg width="96" height="32" viewBox="0 0 96 32" aria-hidden="true"><path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
};

// change: % vs previous period (null = nothing to compare). invert: a drop is the good direction. neutral: no judgement.
const StatCard = ({ title, value, change, sub, color, spark, invert, neutral }: any) => {
  const good = invert ? change <= 0 : change >= 0;
  const badge = change === 0 || neutral ? 'bg-[#ECEAE2] text-[#4A505A]' : good ? 'bg-[#DDF5EC] text-[#0B5A44]' : 'bg-[#FCE4E1] text-[#A3201A]';
  return (
    <article className="bg-white dark:bg-slate-800 border border-[#E3E1D8] dark:border-slate-700 rounded-2xl p-5 flex flex-col gap-3.5 min-w-0">
      <div className="flex justify-between items-center gap-2">
        <span className="text-[#5A606B] dark:text-gray-400 font-medium">{title}</span>
        {change != null && (
          <span title="vs periodo anterior" className={`text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums flex items-center gap-0.5 ${badge}`}>
            {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(change)}%
          </span>
        )}
      </div>
      <div className="text-[28px] sm:text-[32px] font-bold tracking-tight break-all tabular-nums leading-none text-[#14171C] dark:text-white">{value}</div>
      <div className="flex justify-between items-end gap-2.5">
        <span className="text-xs text-[#5A606B] dark:text-gray-400 leading-snug">{sub}</span>
        {spark && <span title={`Evolución en el periodo (${spark.length} puntos)`}><Spark values={spark} color={color} /></span>}
      </div>
    </article>
  );
};

const Card: React.FC<{ title: string; subtitle?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ title, subtitle, className = '', children }) => (
  <article className={`bg-white dark:bg-slate-800 border border-[#E3E1D8] dark:border-slate-700 rounded-2xl p-6 flex flex-col gap-4 min-w-0 ${className}`}>
    <div>
      <h2 className="text-lg font-bold text-[#14171C] dark:text-white">{title}</h2>
      {subtitle && <div className="text-[13px] text-[#5A606B] dark:text-gray-400 mt-1">{subtitle}</div>}
    </div>
    {children}
  </article>
);

interface DashboardProps {
  onNavigate: (page: string) => void;
  /** Widget just saved from the Constructor: scrolled into view and briefly highlighted */
  focusWidgetId?: string | null;
  /** Vista compartida: sin botones para crear o eliminar gráficos */
  readOnly?: boolean;
}

const WIDGET_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, focusWidgetId, readOnly }) => {
  const { data, blendedMetrics: bm, previousBlended: pbm, dateRange, setDateRange, preferences, customWidgets, removeWidget } = useData();
  const [selectedGoal, setSelectedGoal] = useState<BusinessGoal>(preferences.defaultGoal);
  useEffect(() => { setSelectedGoal(preferences.defaultGoal); }, [preferences.defaultGoal]);
  useEffect(() => {
    if (focusWidgetId) document.getElementById(`widget-${focusWidgetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusWidgetId]);

  // Funnel: each stage is a count from its real source; what matters is the rate between steps
  // (values differ by orders of magnitude, so bars sized by volume would say nothing) and its cost.
  const kommoConnected = data.kommo.pipelines.length > 0;
  const crmSales = data.kommo.agents.reduce((s, a) => s + a.sales, 0);
  const rate = (a: number, b: number) => b > 0 ? a / b * 100 : null;
  const fmtRate = (r: number | null) => r == null ? '—' : `${r < 10 ? r.toFixed(2) : r.toFixed(1)}%`;
  const costPer = (n: number) => n > 0 && bm.totalSpend > 0 ? bm.totalSpend / n : null;
  const salesStep = (() => {
    const r = rate(crmSales, bm.totalConversions);
    return r != null && r > 100
      ? { rate: null, label: 'más ventas que conversiones: incluye ventas no atribuidas a anuncios' }
      : { rate: r, label: 'se cierra como venta' };
  })();
  const funnel: { name: string; source: string; value: number; color: string; cost: number | null; costLabel: string; step?: { rate: number | null; label: string } }[] = [
    { name: 'Impresiones', source: 'Veces que se mostraron tus anuncios', value: bm.totalImpressions, color: '#14171C',
      cost: costPer(bm.totalImpressions / 1000), costLabel: 'CPM' },
    { name: 'Clics', source: 'Visitas desde los anuncios', value: bm.totalClicks, color: '#0B8A6A',
      cost: costPer(bm.totalClicks), costLabel: 'CPC',
      step: { rate: rate(bm.totalClicks, bm.totalImpressions), label: 'hace clic (CTR)' } },
    { name: 'Conversiones', source: 'Reportadas por las plataformas de anuncios', value: bm.totalConversions, color: '#2F5BEA',
      cost: costPer(bm.totalConversions), costLabel: 'CPA',
      step: { rate: rate(bm.totalConversions, bm.totalClicks), label: 'convierte (tasa de conversión)' } },
    ...(kommoConnected ? [{
      name: 'Ventas ganadas', source: 'Cerradas en Kommo (todas las fuentes)', value: crmSales, color: '#C98400',
      cost: costPer(crmSales), costLabel: 'Costo por venta', step: salesStep,
    }] : []),
  ];

  const sum = (arr: any[], k: string) => arr.reduce((s, c) => s + c[k], 0);
  const channels = [
    { channel: 'Meta Ads', color: '#2F5BEA', cs: data.meta.campaigns },
    { channel: 'Google Ads', color: '#C98400', cs: data.google.campaigns },
    { channel: 'LinkedIn', color: '#0E8FA8', cs: data.linkedin.campaigns },
    { channel: 'TikTok', color: '#8A3FC9', cs: data.tiktok.campaigns },
  ].map(c => ({ ...c, spend: sum(c.cs, 'spend'), conv: sum(c.cs, 'conversions') }))
   .filter(c => c.spend > 0)
   // Spend-weighted ROAS across the channel's campaigns
   .map(c => ({ ...c, cpa: c.conv > 0 ? c.spend / c.conv : 0, roas: c.cs.reduce((s, x) => s + (x.roas || 0) * x.spend, 0) / c.spend }));
  const maxSpend = Math.max(1, ...channels.map(c => c.spend));
  const best = [...channels].sort((a, b) => b.roas - a.roas)[0];
  const worst = [...channels].sort((a, b) => a.roas - b.roas)[0];

  // Daily trend from all platforms; ranges over 45 days are grouped by week (starting Monday)
  const weekly = data.trend.length > 45;
  const buckets = new Map<string, { spend: number; revenue: number; impressions: number; clicks: number; conversions: number }>();
  for (const p of data.trend) {
    let key = p.date;
    if (weekly) {
      const d = new Date(`${p.date}T00:00:00`);
      d.setDate(d.getDate() - (d.getDay() + 6) % 7);
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    const b = buckets.get(key) || { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 };
    b.spend += p.spend;
    b.revenue += p.revenue;
    b.impressions += p.impressions || 0;
    b.clicks += p.clicks || 0;
    b.conversions += p.conversions || 0;
    buckets.set(key, b);
  }
  const trendData = [...buckets.entries()].map(([date, b]) => ({
    name: `${weekly ? 'Sem ' : ''}${date.slice(8, 10)}/${date.slice(5, 7)}`,
    spend: Math.round(b.spend),
    roas: b.spend > 0 ? +(b.revenue / b.spend).toFixed(2) : null,
  }));
  const hasTrend = trendData.some(t => t.spend > 0);
  // Sparklines follow the same buckets as the trend chart. No real data -> no line (never a placeholder shape).
  const sparkOf = (vals: number[]) => vals.length >= 2 && vals.some(v => v > 0) ? vals : null;
  const bucketList = [...buckets.values()];
  const spendSpark = sparkOf(bucketList.map(b => b.spend));
  const revenueSpark = sparkOf(bucketList.map(b => b.revenue));
  const conversionsSpark = sparkOf(bucketList.map(b => b.conversions));
  // CTR per bucket; buckets without impressions are skipped instead of drawn as 0%
  const ctrSpark = sparkOf(bucketList.filter(b => b.impressions > 0).map(b => b.clicks / b.impressions * 100));

  const [pipelineId, setPipelineId] = usePipelineSelection(data.kommo.pipelines, 'dashboard', false);
  const pipeline = data.kommo.pipelines.find(p => p.id === pipelineId);
  // Open stages: active leads right now (like Kommo's board). Won/lost: closed within the period,
  // shown apart so thousands of lost leads don't flatten the scale of the open stages.
  const allStages = pipeline?.stages || [];
  const stages = allStages.filter(s => !s.closed);
  const wonStage = allStages.find(s => s.closed === 'won');
  const lostStage = allStages.find(s => s.closed === 'lost');
  const activeLeads = stages.reduce((s, st) => s + st.count, 0);
  const maxStage = Math.max(1, ...stages.map(s => s.count));
  const negotiation = stages.reduce((s, st) => s + (st.value || 0), 0);

  const ctrDelta = pctChange(bm.blendedCtr, pbm?.blendedCtr);

  const roasBadge = (r: number) => r >= 3 ? 'bg-[#DDF5EC] text-[#0B5A44]' : r >= 1.5 ? 'bg-[#FFF1CC] text-[#6B4400]' : 'bg-[#FCE4E1] text-[#A3201A]';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 text-[14px]">
      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14171C] dark:text-white">Dashboard ejecutivo</h1>
          <p className="text-[#5A606B] dark:text-gray-400 mt-1.5">Visión unificada de rendimiento · objetivo: <span className="font-semibold text-[#0B6B5A] dark:text-teal-300">{selectedGoal}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
          <select value={selectedGoal} onChange={(e) => setSelectedGoal(e.target.value as BusinessGoal)}
            aria-label="Objetivo de negocio"
            className="bg-white dark:bg-slate-800 border border-[#D5D2C7] dark:border-slate-700 text-[#14171C] dark:text-white text-[13px] font-semibold rounded-xl h-11 px-3 outline-none">
            {Object.values(BusinessGoal).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Inversión total" value={money(bm.totalSpend)} change={pctChange(bm.totalSpend, pbm?.totalSpend)} neutral color="#2F5BEA" sub="Todas las fuentes" spark={spendSpark} />
        <StatCard title="Ingresos" value={money(bm.totalRevenue)} change={pctChange(bm.totalRevenue, pbm?.totalRevenue)} color="#0B8A6A" sub={`ROAS combinado ${bm.blendedRoas.toFixed(2)}x`} spark={revenueSpark} />
        <StatCard title="Conversiones" value={bm.totalConversions.toLocaleString()} change={pctChange(bm.totalConversions, pbm?.totalConversions)} color="#8A3FC9" sub={`CPA $${bm.blendedCpa.toFixed(2)}`} spark={conversionsSpark} />
        <StatCard title="CTR promedio" value={`${bm.blendedCtr.toFixed(2)}%`} change={pctChange(bm.blendedCtr, pbm?.blendedCtr)} color="#C98400" sub={`${bm.totalClicks.toLocaleString()} clics`} spark={ctrSpark} />
      </section>

      {/* TENDENCIA + EMBUDO */}
      <section className="flex flex-wrap gap-4 items-stretch">
        <Card title="Inversión vs. ROAS" subtitle={`Evolución ${weekly ? 'semanal' : 'diaria'} del periodo, todas las fuentes combinadas`} className="flex-[2_1_560px]">
          <div className="h-64 sm:h-72">
            {!hasTrend ? (
              <div className="h-full flex items-center justify-center text-center text-[13px] text-[#5A606B] dark:text-gray-400 px-6">
                Sin inversión registrada en este periodo. Conecta una plataforma de anuncios o cambia el rango de fechas.
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEAE2" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => '$' + compact(v)} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 'auto']} tickFormatter={(v) => v + 'x'} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E3E1D8' }}
                  formatter={(v: any, name: any) => name === 'ROAS' ? [`${v}x`, name] : [money(Number(v)), name]} />
                <Legend />
                <Bar yAxisId="left" dataKey="spend" name="Inversión" fill="#C9D5FB" stroke="#2F5BEA" maxBarSize={38} />
                <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS" stroke="#D4600F" strokeWidth={3} connectNulls
                  dot={trendData.length <= 31 ? { r: 3, fill: '#fff' } : false} />
              </ComposedChart>
            </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card title="Embudo de conversión" subtitle="Cuántos avanzan a cada paso y cuánto cuesta cada uno" className="flex-[1_1_320px]">
          <div className="flex flex-col">
            {funnel.map(f => (
              <React.Fragment key={f.name}>
                {f.step && (
                  <div className="flex items-center gap-2 pl-4 py-1.5 text-[12px] text-[#5A606B] dark:text-gray-400">
                    <ArrowDown className="h-3.5 w-3.5 shrink-0" />
                    {f.step.rate != null && <span className="font-bold tabular-nums text-[#14171C] dark:text-white">{fmtRate(f.step.rate)}</span>}
                    <span className="leading-snug">{f.step.label}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 rounded-xl border border-[#ECEAE2] dark:border-slate-700 pl-3 pr-4 py-2.5">
                  <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: f.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">{f.name}</div>
                    <div className="text-[11px] text-[#5A606B] dark:text-gray-400 leading-snug">{f.source}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold tabular-nums leading-tight" title={f.value.toLocaleString()}>{compact(f.value)}</div>
                    <div className="text-[11px] text-[#5A606B] dark:text-gray-400 tabular-nums">
                      {f.costLabel} {f.cost == null ? '—' : `$${f.cost.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            ))}
            {!kommoConnected && (
              <p className="text-[11px] text-[#5A606B] dark:text-gray-400 mt-3">Conecta Kommo para ver cuántas conversiones terminan en venta.</p>
            )}
          </div>
        </Card>
      </section>

      {/* CANALES + PIPELINE */}
      <section className="flex flex-wrap gap-4 items-stretch">
        <Card title="Rendimiento por canal" subtitle="Compara inversión, costo por adquisición y retorno" className="flex-[2_1_560px]">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[560px]">
              <thead><tr className="text-[#5A606B] text-xs text-left">
                <th className="py-2 font-medium">Canal</th><th className="py-2 px-2 font-medium w-[28%]">Inversión</th>
                <th className="py-2 px-2 font-medium text-right">Conv.</th><th className="py-2 px-2 font-medium text-right">CPA</th><th className="py-2 font-medium text-right">ROAS</th>
              </tr></thead>
              <tbody>
                {channels.map(c => (
                  <tr key={c.channel} className="border-t border-[#ECEAE2] dark:border-slate-700">
                    <td className="py-3.5"><span className="inline-flex items-center gap-2.5 font-semibold"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: c.color }} />{c.channel}</span></td>
                    <td className="py-3.5 px-2"><div className="flex items-center gap-2.5"><div className="flex-1 bg-[#F0EEE7] dark:bg-slate-700 rounded-md h-2 overflow-hidden"><div className="h-full rounded-md" style={{ width: (c.spend / maxSpend * 100) + '%', background: c.color }} /></div><span className="font-mono min-w-[64px] text-right">{money(c.spend)}</span></div></td>
                    <td className="py-3.5 px-2 text-right tabular-nums">{c.conv.toLocaleString()}</td>
                    <td className="py-3.5 px-2 text-right tabular-nums">${c.cpa.toFixed(2)}</td>
                    <td className="py-3.5 text-right"><span className={`inline-block min-w-[52px] text-center px-2 py-0.5 rounded-full font-semibold tabular-nums ${roasBadge(c.roas)}`}>{c.roas.toFixed(1)}x</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Pipeline Kommo" className="flex-[1_1_320px]"
          subtitle={data.kommo.pipelines.length > 1
            ? <PipelineSelect pipelines={data.kommo.pipelines} value={pipelineId} onChange={setPipelineId} className="w-full mt-1" />
            : (pipeline?.name || 'Sin pipeline')}>
          <div className="flex justify-between items-baseline text-[12px] text-[#5A606B] dark:text-gray-400 -mb-1">
            <span>Leads activos hoy, por etapa</span>
            <span className="font-semibold tabular-nums text-[#14171C] dark:text-white">{activeLeads.toLocaleString()}</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {stages.map(s => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="w-[88px] sm:w-[104px] shrink-0 text-[13px] truncate" title={s.name}>{s.name}</span>
                <div className="flex-1 bg-[#F0EEE7] dark:bg-slate-700 rounded-md h-[22px] overflow-hidden"><div className="h-full rounded-md" style={{ width: (s.count / maxStage * 100) + '%', background: s.color }} /></div>
                <span className="w-10 text-right font-mono text-xs">{s.count}</span>
              </div>
            ))}
          </div>
          {(wonStage || lostStage) && (
            <div className="grid grid-cols-2 gap-2.5">
              {[{ s: wonStage, label: 'Ganadas', tone: 'bg-[#DDF5EC] text-[#0B5A44]' }, { s: lostStage, label: 'Perdidas', tone: 'bg-[#FCE4E1] text-[#A3201A]' }]
                .filter(x => x.s).map(({ s, label, tone }) => (
                  <div key={label} className={`rounded-xl px-3 py-2 ${tone}`}>
                    <div className="text-[11px] font-medium">{label} en el periodo</div>
                    <div className="text-lg font-bold tabular-nums leading-tight">{s!.count.toLocaleString()}</div>
                  </div>
                ))}
            </div>
          )}
          <div className="mt-auto border-t border-[#ECEAE2] dark:border-slate-700 pt-3.5 flex justify-between text-[13px]">
            <span className="text-[#5A606B]" title="Suma del valor de los leads activos">Valor en pipeline</span><span className="font-bold tabular-nums">{money(negotiation)}</span>
          </div>
        </Card>
      </section>

      {/* IA */}
      {best && worst && (
        <section className="bg-[#14171C] text-[#E6E8EC] rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2.5"><Sparkles className="h-5 w-5 text-[#2DD4BF]" /><h2 className="text-lg font-bold text-white">Qué haría hoy</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="bg-[#1D2229] border border-[#2A313A] rounded-xl p-[18px] flex flex-col gap-2.5">
              <span className="self-start text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#4A1B17] text-[#FFB4AB]">Prioridad alta</span>
              <h3 className="text-[15px] font-semibold text-white">Mueve presupuesto de {worst.channel} a {best.channel}</h3>
              <p className="text-[13px] leading-relaxed text-[#B4BAC4]">{worst.channel} rinde {worst.roas.toFixed(1)}x de ROAS frente a {best.roas.toFixed(1)}x en {best.channel}.</p>
            </div>
            <div className="bg-[#1D2229] border border-[#2A313A] rounded-xl p-[18px] flex flex-col gap-2.5">
              <span className="self-start text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#4A3A12] text-[#F6D77E]">Prioridad media</span>
              <h3 className="text-[15px] font-semibold text-white">Revisa el CTR promedio</h3>
              <p className="text-[13px] leading-relaxed text-[#B4BAC4]">El CTR combinado es {bm.blendedCtr.toFixed(2)}%{ctrDelta != null && ctrDelta !== 0 ? ` y ${ctrDelta < 0 ? 'bajó' : 'subió'} ${Math.abs(ctrDelta)}% vs el periodo anterior` : ''}. Prueba variantes de creativos en las campañas de mayor inversión.</p>
            </div>
            <div className="bg-[#1D2229] border border-[#2A313A] rounded-xl p-[18px] flex flex-col gap-2.5">
              <span className="self-start text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#12383A] text-[#8FE3D6]">Seguimiento</span>
              <h3 className="text-[15px] font-semibold text-white">Cuida el cierre en ventas</h3>
              <p className="text-[13px] leading-relaxed text-[#B4BAC4]">Compara la tasa de cierre por agente en Plataformas › Kommo para detectar dónde se pierden leads.</p>
            </div>
          </div>
        </section>
      )}

      {/* ROW 4: CUSTOM WIDGETS SECTION (DYNAMIC) */}
      <div className="space-y-6">
          <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center">
                  <Activity className="h-6 w-6 mr-2 text-indigo-600" />
                  Tableros Personalizados
              </h2>
              {customWidgets.length > 0 && (
                  <span className="text-sm text-gray-500">{customWidgets.length} widgets activos</span>
              )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {customWidgets.map((widget) => {
                  const widgetData = WidgetEngine.processData(widget, data);
                  
                  return (
                    <div key={widget.id} id={`widget-${widget.id}`} className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border overflow-hidden relative group transition-shadow duration-700 ${focusWidgetId === widget.id ? 'border-indigo-400 ring-2 ring-indigo-400' : 'border-gray-100 dark:border-slate-700'}`}>
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white">{widget.title}</h3>
                            {!readOnly && <button onClick={() => removeWidget(widget.id)} aria-label="Eliminar gráfico" title="Eliminar gráfico" className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500">
                                <Trash2 className="h-4 w-4" />
                            </button>}
                        </div>
                        <div className="p-4 overflow-x-auto max-h-80">
                            {/* RENDER BASED ON CHART TYPE */}
                            {widget.chartType === 'table' ? (
                                <table className="w-full text-xs text-left">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-slate-900/50 sticky top-0">
                                        <tr>
                                            {widget.dimensions.map(d => <th key={d} className="px-4 py-2">{WidgetEngine.getLabel(widget.dataSource, d)}</th>)}
                                            {widget.metrics.map(m => <th key={m} className="px-4 py-2 text-right">{WidgetEngine.getLabel(widget.dataSource, m)}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                        {widgetData.slice(0, 8).map((row, i) => (
                                            <tr key={i}>
                                                {widget.dimensions.map(d => <td key={d} className="px-4 py-2 text-gray-600 dark:text-gray-300 font-medium">{row[d]}</td>)}
                                                {widget.metrics.map(m => <td key={m} className="px-4 py-2 text-gray-600 dark:text-gray-300 text-right">{
                                                    typeof row[m] === 'number' ? row[m].toLocaleString() : row[m]
                                                }</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : widgetData.length === 0 ? (
                                <div className="h-[250px] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 text-center px-4">
                                    Sin datos de {widget.dataSource} para este periodo.
                                </div>
                            ) : widget.chartType === 'pie' ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie data={widgetData} dataKey={widget.metrics[0]} nameKey={widget.dimensions[0]} innerRadius={50} outerRadius={90} paddingAngle={2}>
                                            {widgetData.map((_, i) => <Cell key={i} fill={WIDGET_COLORS[i % WIDGET_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : widget.chartType === 'line' ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={widgetData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey={widget.dimensions[0]} tick={{fontSize: 10}} />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        {widget.metrics.map((m, i) => (
                                            <Line key={m} type="monotone" dataKey={m} name={WidgetEngine.getLabel(widget.dataSource, m)} stroke={WIDGET_COLORS[i % WIDGET_COLORS.length]} strokeWidth={2} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={widgetData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey={widget.dimensions[0]} tick={{fontSize: 10}} />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        {widget.metrics.map((m, i) => (
                                            <Bar key={m} dataKey={m} name={WidgetEngine.getLabel(widget.dataSource, m)} fill={WIDGET_COLORS[i % WIDGET_COLORS.length]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                  );
              })}
              
              {/* Add Widget CTA */}
              {!readOnly && <button type="button" onClick={() => onNavigate('builder')} className="bg-gray-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-700 flex flex-col items-center justify-center p-8 text-center hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group h-64">
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                      <Plus className="h-8 w-8 text-indigo-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Agregar Gráfico Personalizado</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                      Crea tablas y gráficos a medida en el Constructor.
                  </p>
                  <span className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium group-hover:bg-indigo-700">Ir al Constructor</span>
              </button>}
          </div>
      </div>

    </div>
  );
};