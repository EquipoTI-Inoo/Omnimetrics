import React, { useEffect, useMemo, useState } from 'react';
import {
    Megaphone, Search, LayoutGrid, List, ArrowDownWideNarrow, ArrowUpNarrowWide, Download, Info,
    Video, Image as ImageIcon, ExternalLink, ArrowUpRight, ArrowDownRight, Plug, X,
} from 'lucide-react';
import { Platform } from '../types';
import { useData } from '../context/DataContext';
import { DateRangePicker } from './DateRangePicker';
import { pctChange } from '../services/kpis';
import {
    AdRow, AdStatus, SortKey, SORT_OPTIONS, sortOption, sortAds, collectAds, formatMetric, compact, adsToCsv,
} from '../services/ads';

// --- Constants ---

const PLATFORM_STYLE: Partial<Record<Platform, { label: string; badge: string; dot: string }>> = {
    [Platform.Meta]: { label: 'Meta', badge: 'bg-[#E7F0FE] text-[#1A56C4] dark:bg-blue-900/40 dark:text-blue-300', dot: '#1877F2' },
    [Platform.GoogleAds]: { label: 'Google Ads', badge: 'bg-[#FFF1CC] text-[#6B4400] dark:bg-amber-900/40 dark:text-amber-300', dot: '#F4B400' },
    [Platform.LinkedIn]: { label: 'LinkedIn', badge: 'bg-[#E1F0F8] text-[#0A5C8F] dark:bg-sky-900/40 dark:text-sky-300', dot: '#0A66C2' },
    [Platform.TikTok]: { label: 'TikTok', badge: 'bg-[#14171C] text-white dark:bg-slate-600', dot: '#14171C' },
};

const STATUS_LABEL: Record<AdStatus, { label: string; dot: string }> = {
    Active: { label: 'Activo', dot: 'bg-[#10B981]' },
    Paused: { label: 'Pausado', dot: 'bg-[#F59E0B]' },
    Ended: { label: 'Finalizado', dot: 'bg-gray-400' },
    Unknown: { label: 'Sin estado', dot: 'bg-gray-300' },
};

/** One-click shortcuts for the most common orders */
const QUICK_SORTS: { key: SortKey; label: string }[] = [
    { key: 'visits', label: 'Más visitas' },
    { key: 'interactions', label: 'Más interacciones' },
    { key: 'conversions', label: 'Más conversiones' },
    { key: 'roas', label: 'Mejor ROAS' },
    { key: 'cpa', label: 'Menor CPA' },
    { key: 'spend', label: 'Mayor inversión' },
];

/** Columns of the table view (the active sort metric is added if it isn't one of them) */
const TABLE_COLUMNS: SortKey[] = ['visits', 'interactions', 'impressions', 'ctr', 'spend', 'conversions', 'cpa', 'roas'];
/** Secondary metrics on each card */
const CARD_METRICS: SortKey[] = ['visits', 'interactions', 'spend', 'conversions', 'ctr', 'impressions'];

const PAGE = 24;
const PREFS_KEY = 'omni_ads_view_v1';

type StatusFilter = 'all' | 'Active' | 'Paused' | 'Ended';
interface ViewPrefs { sortKey: SortKey; dir: 'asc' | 'desc'; view: 'grid' | 'table' }

const loadPrefs = (): ViewPrefs => {
    const fallback: ViewPrefs = { sortKey: 'visits', dir: 'desc', view: 'grid' };
    try {
        const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
        return {
            sortKey: SORT_OPTIONS.some(o => o.key === p.sortKey) ? p.sortKey : fallback.sortKey,
            dir: p.dir === 'asc' ? 'asc' : 'desc',
            view: p.view === 'table' ? 'table' : 'grid',
        };
    } catch { return fallback; }
};

const defaultDir = (key: SortKey): 'asc' | 'desc' => key === 'name' || sortOption(key).lowerIsBetter ? 'asc' : 'desc';

// --- Small pieces ---

const Delta: React.FC<{ value: number | null; invert?: boolean; flat?: boolean; hideZero?: boolean }> = ({ value, invert, flat, hideZero }) => {
    if (value == null || (hideZero && value === 0)) return null;
    const good = invert ? value <= 0 : value >= 0;
    const cls = value === 0 || flat ? 'bg-[#ECEAE2] text-[#4A505A] dark:bg-slate-700 dark:text-gray-300'
        : good ? 'bg-[#DDF5EC] text-[#0B5A44] dark:bg-emerald-900/40 dark:text-emerald-300'
        : 'bg-[#FCE4E1] text-[#A3201A] dark:bg-red-900/40 dark:text-red-300';
    return (
        <span title="vs periodo anterior" className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums inline-flex items-center gap-0.5 ${cls}`}>
            {value >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(value)}%
        </span>
    );
};

const PlatformBadge: React.FC<{ platform: Platform; className?: string }> = ({ platform, className = '' }) => {
    const s = PLATFORM_STYLE[platform];
    return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${s?.badge || ''} ${className}`}>{s?.label || platform}</span>;
};

const StatusPill: React.FC<{ status: AdStatus }> = ({ status }) => (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#5A606B] dark:text-gray-400 whitespace-nowrap">
        <span className={`h-2 w-2 rounded-full ${STATUS_LABEL[status].dot}`} />{STATUS_LABEL[status].label}
    </span>
);

/** Creative preview. Ad platforms' thumbnail URLs expire, so a broken image falls back to an icon. */
const AdThumb: React.FC<{ ad: AdRow; className?: string; small?: boolean }> = ({ ad, className = '', small }) => {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [ad.thumbnail]);
    if (ad.thumbnail && !failed) {
        return <img src={ad.thumbnail} alt="" loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
    }
    // Google search ads have no image: show them as a mini search result
    if (!small && ad.platform === Platform.GoogleAds && (ad.format === 'Búsqueda' || ad.format === 'Texto')) {
        let host = '';
        try { host = ad.url ? new URL(ad.url).host.replace(/^www\./, '') : ''; } catch { /* keep empty */ }
        return (
            <div className={`bg-[#F8F7F3] dark:bg-slate-900 p-4 flex flex-col justify-center gap-1 ${className}`}>
                <span className="text-[11px] text-[#5A606B] dark:text-gray-400"><b className="font-semibold">Patrocinado</b>{host && ` · ${host}`}</span>
                <span className="text-[15px] leading-snug text-[#1A0DAB] dark:text-blue-300 line-clamp-2">{ad.name}</span>
            </div>
        );
    }
    const Icon = ad.isVideo ? Video : ImageIcon;
    return (
        <div className={`bg-[#F1EFE8] dark:bg-slate-700 flex items-center justify-center ${className}`}>
            <Icon className={`${small ? 'h-5 w-5' : 'h-10 w-10'} text-[#B5B1A5] dark:text-slate-500`} />
        </div>
    );
};

/** neutral: no comparison badge. flat: badge without good/bad colour (e.g. spend) */
const Stat: React.FC<{ title: string; value: string; sub?: string; delta?: number | null; invert?: boolean; neutral?: boolean; flat?: boolean }> =
    ({ title, value, sub, delta, invert, neutral, flat }) => (
    <article className="bg-white dark:bg-slate-800 border border-[#E3E1D8] dark:border-slate-700 rounded-2xl p-4 flex flex-col gap-2 min-w-0">
        <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-[#5A606B] dark:text-gray-400 font-medium">{title}</span>
            {!neutral && <Delta value={delta ?? null} invert={invert} flat={flat} />}
        </div>
        <div className="text-2xl font-bold tracking-tight tabular-nums text-[#14171C] dark:text-white truncate">{value}</div>
        {sub && <div className="text-xs text-[#5A606B] dark:text-gray-400 truncate">{sub}</div>}
    </article>
);

// --- Main ---

interface AdsProps { onNavigate?: (page: string) => void }

export const Ads: React.FC<AdsProps> = ({ onNavigate }) => {
    const { data, previousData, dateRange, setDateRange, preferences, isLoading } = useData();

    const [prefs, setPrefs] = useState<ViewPrefs>(loadPrefs);
    useEffect(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private mode */ } }, [prefs]);
    const { sortKey, dir, view } = prefs;

    const [query, setQuery] = useState('');
    const [platforms, setPlatforms] = useState<Platform[]>([]); // empty = all
    const [status, setStatus] = useState<StatusFilter>('all');
    const [limit, setLimit] = useState(PAGE);

    const isVisible = (p: Platform) => preferences.visiblePlatforms[p] !== false;
    const allRows = useMemo(() => collectAds(data).filter(r => isVisible(r.platform)), [data, preferences.visiblePlatforms]);
    const prevRows = useMemo(() => previousData ? collectAds(previousData).filter(r => isVisible(r.platform)) : null, [previousData, preferences.visiblePlatforms]);
    const prevByKey = useMemo(() => new Map((prevRows || []).map(r => [r.key, r])), [prevRows]);

    const availablePlatforms = useMemo(() => {
        const counts = new Map<Platform, number>();
        allRows.forEach(r => counts.set(r.platform, (counts.get(r.platform) || 0) + 1));
        return [...counts.entries()];
    }, [allRows]);

    const matches = (r: AdRow) => {
        if (platforms.length && !platforms.includes(r.platform)) return false;
        if (status !== 'all' && r.status !== status) return false;
        const q = query.trim().toLowerCase();
        return !q || r.name.toLowerCase().includes(q) || r.campaign.toLowerCase().includes(q) || r.format.toLowerCase().includes(q);
    };

    const filtered = useMemo(() => allRows.filter(matches), [allRows, platforms, status, query]);
    const sorted = useMemo(() => sortAds(filtered, sortKey, dir), [filtered, sortKey, dir]);
    const prevFiltered = useMemo(() => prevRows ? prevRows.filter(matches) : null, [prevRows, platforms, status, query]);
    useEffect(() => setLimit(PAGE), [sortKey, dir, platforms, status, query, data]);

    const opt = sortOption(sortKey);
    const missing = sortKey === 'name' ? 0 : filtered.filter(r => r[sortKey] == null).length;
    const maxValue = sortKey === 'name' ? 0 : Math.max(0, ...filtered.map(r => (r[sortKey] as number | null) ?? 0));

    const setSort = (key: SortKey, direction?: 'asc' | 'desc') =>
        setPrefs(p => ({ ...p, sortKey: key, dir: direction || defaultDir(key) }));
    const onHeaderClick = (key: SortKey) =>
        key === sortKey ? setPrefs(p => ({ ...p, dir: p.dir === 'asc' ? 'desc' : 'asc' })) : setSort(key);
    const togglePlatform = (p: Platform) => setPlatforms(cur => cur.includes(p) ? cur.filter(x => x !== p) : [...cur, p]);

    // Totals of what's on screen, with the same filters applied to the previous period
    const totals = (rows: AdRow[]) => ({
        count: rows.length,
        active: rows.filter(r => r.status === 'Active').length,
        visits: rows.reduce((s, r) => s + r.visits, 0),
        interactions: rows.reduce((s, r) => s + (r.interactions || 0), 0),
        spend: rows.reduce((s, r) => s + r.spend, 0),
        conversions: rows.reduce((s, r) => s + r.conversions, 0),
    });
    const t = totals(filtered);
    const pt = prevFiltered ? totals(prevFiltered) : null;

    const adDelta = (ad: AdRow, key: SortKey) => {
        if (key === 'name') return null;
        const prev = prevByKey.get(ad.key);
        return prev ? pctChange(ad[key] as number ?? NaN, prev[key] as number | null) : null;
    };

    const exportCsv = () => {
        const blob = new Blob(['﻿' + adsToCsv(sorted)], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `anuncios_${dateRange.startDate.toISOString().slice(0, 10)}_${dateRange.endDate.toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const hasFilters = platforms.length > 0 || status !== 'all' || query.trim() !== '';
    const clearFilters = () => { setPlatforms([]); setStatus('all'); setQuery(''); };

    const visible = sorted.slice(0, limit);
    const groups = [...new Set(SORT_OPTIONS.map(o => o.group))];
    const tableCols = TABLE_COLUMNS.includes(sortKey) || sortKey === 'name' ? TABLE_COLUMNS : [sortKey, ...TABLE_COLUMNS];
    const chip = (active: boolean) => `h-9 px-3 rounded-full text-[13px] font-semibold border transition-colors whitespace-nowrap ${active
        ? 'bg-[#14171C] text-white border-[#14171C] dark:bg-teal-400 dark:text-slate-900 dark:border-teal-400'
        : 'bg-white dark:bg-slate-800 text-[#3A3F47] dark:text-gray-300 border-[#D5D2C7] dark:border-slate-600 hover:border-[#14171C] dark:hover:border-gray-400'}`;

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-20 text-[14px]">
            {/* HEADER */}
            <div className="flex flex-wrap justify-between items-end gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14171C] dark:text-white">Anuncios</h1>
                    <p className="text-[#5A606B] dark:text-gray-400 mt-1.5">
                        Todos tus anuncios en un solo lugar, ordenados por lo que más te importa · {dateRange.label}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
                    <button onClick={exportCsv} disabled={sorted.length === 0}
                        className="h-11 px-4 rounded-xl border border-[#D5D2C7] dark:border-slate-700 bg-white dark:bg-slate-800 text-[13px] font-semibold text-[#14171C] dark:text-white flex items-center gap-2 hover:bg-[#F8F7F3] dark:hover:bg-slate-700 disabled:opacity-50">
                        <Download className="h-4 w-4" /> Exportar CSV
                    </button>
                </div>
            </div>

            {/* EMPTY: nothing connected / no ads */}
            {allRows.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 border border-[#E3E1D8] dark:border-slate-700 rounded-2xl p-10 flex flex-col items-center text-center gap-3">
                    {isLoading ? (
                        <p className="text-[#5A606B] dark:text-gray-400">Cargando anuncios…</p>
                    ) : (
                        <>
                            <div className="h-12 w-12 rounded-2xl bg-[#DDF5EC] dark:bg-teal-900/40 flex items-center justify-center">
                                <Megaphone className="h-6 w-6 text-[#0B6B5A] dark:text-teal-300" />
                            </div>
                            <h2 className="text-lg font-bold text-[#14171C] dark:text-white">No hay anuncios en este periodo</h2>
                            <p className="text-[#5A606B] dark:text-gray-400 max-w-md">
                                {onNavigate
                                    ? 'Conecta Meta Ads, Google Ads, LinkedIn Ads o TikTok Ads, o amplía el rango de fechas. Solo aparecen los anuncios con actividad en las fechas elegidas.'
                                    : 'Solo aparecen los anuncios con actividad en las fechas elegidas. Prueba con un rango de fechas más amplio.'}
                            </p>
                            {onNavigate && (
                                <button onClick={() => onNavigate('connections')}
                                    className="mt-2 h-10 px-4 rounded-xl bg-[#14171C] text-white text-[13px] font-semibold flex items-center gap-2 hover:bg-[#222831]">
                                    <Plug className="h-4 w-4" /> Ir a Conexiones
                                </button>
                            )}
                        </>
                    )}
                </div>
            ) : (
            <>
            {/* KPIs of what's shown */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <Stat title="Anuncios" value={t.count.toLocaleString()} sub={`${t.active} activos`} neutral />
                <Stat title="Visitas" value={compact(t.visits)} sub={`Costo/visita ${formatMetric(t.visits ? t.spend / t.visits : null, 'money')}`} delta={pt && pctChange(t.visits, pt.visits)} />
                <Stat title="Interacciones" value={compact(t.interactions)} sub="Likes, comentarios, compartidos…" delta={pt && pctChange(t.interactions, pt.interactions)} />
                <Stat title="Inversión" value={formatMetric(t.spend, 'money')} sub="En los anuncios mostrados" delta={pt && pctChange(t.spend, pt.spend)} flat />
                <Stat title="Conversiones" value={compact(t.conversions)} sub={`CPA ${formatMetric(t.conversions ? t.spend / t.conversions : null, 'money')}`} delta={pt && pctChange(t.conversions, pt.conversions)} />
            </section>

            {/* TOOLBAR */}
            <section className="bg-white dark:bg-slate-800 border border-[#E3E1D8] dark:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
                {/* Sort */}
                <div className="flex flex-col gap-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5A606B] dark:text-gray-400">Ordenar por</span>
                    <div className="flex flex-wrap items-center gap-2">
                        {QUICK_SORTS.map(q => (
                            <button key={q.key} onClick={() => setSort(q.key)} className={chip(sortKey === q.key && dir === defaultDir(q.key))}>
                                {q.label}
                            </button>
                        ))}
                        <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
                            <select value={sortKey} onChange={e => setSort(e.target.value as SortKey)} aria-label="Criterio de orden"
                                className="min-w-0 flex-1 sm:flex-none h-9 bg-white dark:bg-slate-800 border border-[#D5D2C7] dark:border-slate-600 text-[#14171C] dark:text-white text-[13px] font-semibold rounded-xl px-3 outline-none">
                                {groups.map(g => (
                                    <optgroup key={g} label={g}>
                                        {SORT_OPTIONS.filter(o => o.group === g).map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                            <button onClick={() => setPrefs(p => ({ ...p, dir: p.dir === 'asc' ? 'desc' : 'asc' }))}
                                title="Invertir orden"
                                className="shrink-0 h-9 px-3 rounded-xl border border-[#D5D2C7] dark:border-slate-600 text-[13px] font-semibold text-[#14171C] dark:text-white flex items-center gap-1.5 hover:bg-[#F8F7F3] dark:hover:bg-slate-700 whitespace-nowrap">
                                {dir === 'desc' ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpNarrowWide className="h-4 w-4" />}
                                {sortKey === 'name' ? (dir === 'asc' ? 'A → Z' : 'Z → A') : (
                                    <>
                                        <span className="hidden sm:inline">{dir === 'desc' ? 'Mayor a menor' : 'Menor a mayor'}</span>
                                        <span className="sm:hidden">{dir === 'desc' ? 'Mayor' : 'Menor'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-[#ECEAE2] dark:border-slate-700">
                    <div className="relative w-full sm:w-64">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA1AC]" />
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar anuncio o campaña"
                            className="w-full h-9 pl-9 pr-3 rounded-xl border border-[#D5D2C7] dark:border-slate-600 bg-white dark:bg-slate-900 text-[13px] text-[#14171C] dark:text-white outline-none focus:border-[#14171C] dark:focus:border-teal-400" />
                    </div>
                    {availablePlatforms.length > 1 && availablePlatforms.map(([p, n]) => (
                        <button key={p} onClick={() => togglePlatform(p)} className={`${chip(platforms.includes(p))} flex items-center gap-1.5`}>
                            <span className="h-2 w-2 rounded-full" style={{ background: PLATFORM_STYLE[p]?.dot }} />
                            {PLATFORM_STYLE[p]?.label || p} <span className="opacity-60 tabular-nums">{n}</span>
                        </button>
                    ))}
                    <select value={status} onChange={e => setStatus(e.target.value as StatusFilter)} aria-label="Estado"
                        className="h-9 bg-white dark:bg-slate-800 border border-[#D5D2C7] dark:border-slate-600 text-[#14171C] dark:text-white text-[13px] font-semibold rounded-xl px-3 outline-none">
                        <option value="all">Todos los estados</option>
                        <option value="Active">Activos</option>
                        <option value="Paused">Pausados</option>
                        <option value="Ended">Finalizados</option>
                    </select>
                    {hasFilters && (
                        <button onClick={clearFilters} className="h-9 px-2 text-[13px] font-semibold text-[#0B6B5A] dark:text-teal-300 flex items-center gap-1">
                            <X className="h-3.5 w-3.5" /> Limpiar
                        </button>
                    )}
                    <div className="ml-auto flex bg-[#F1EFE8] dark:bg-slate-900 p-1 rounded-xl" role="group" aria-label="Vista">
                        {([['grid', LayoutGrid, 'Tarjetas'], ['table', List, 'Tabla']] as const).map(([v, Icon, label]) => (
                            <button key={v} onClick={() => setPrefs(p => ({ ...p, view: v }))} aria-pressed={view === v} title={label}
                                className={`h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-[12px] font-semibold ${view === v ? 'bg-white dark:bg-slate-700 text-[#14171C] dark:text-white shadow-sm' : 'text-[#5A606B] dark:text-gray-400'}`}>
                                <Icon className="h-4 w-4" /><span className="hidden sm:inline">{label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* How the active metric is measured + ads without it */}
                {(opt.help || missing > 0) && (
                    <div className="flex items-start gap-2 text-xs text-[#5A606B] dark:text-gray-400 bg-[#F8F7F3] dark:bg-slate-900 rounded-xl px-3 py-2.5">
                        <Info className="h-4 w-4 shrink-0 mt-px" />
                        <span>
                            {opt.help && <><b className="text-[#14171C] dark:text-gray-200">{opt.label}:</b> {opt.help} </>}
                            {missing > 0 && <>{missing} {missing === 1 ? 'anuncio no reporta' : 'anuncios no reportan'} esta métrica y {missing === 1 ? 'aparece' : 'aparecen'} al final.</>}
                        </span>
                    </div>
                )}
            </section>

            {/* RESULTS */}
            {sorted.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 border border-[#E3E1D8] dark:border-slate-700 rounded-2xl p-10 text-center text-[#5A606B] dark:text-gray-400">
                    Ningún anuncio coincide con los filtros.{' '}
                    <button onClick={clearFilters} className="font-semibold text-[#0B6B5A] dark:text-teal-300">Limpiar filtros</button>
                </div>
            ) : view === 'grid' ? (
                <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                    {visible.map((ad, i) => {
                        const value = sortKey === 'name' ? null : ad[sortKey] as number | null;
                        const secondary = CARD_METRICS.filter(k => k !== sortKey).slice(0, 4);
                        return (
                            <article key={ad.key} className="bg-white dark:bg-slate-800 border border-[#E3E1D8] dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col min-w-0 hover:shadow-md transition-shadow">
                                <div className="relative">
                                    <AdThumb ad={ad} className="w-full h-40" />
                                    <span className="absolute top-2.5 left-2.5 bg-white/95 dark:bg-slate-900/90 text-[#14171C] dark:text-white text-xs font-bold px-2 py-0.5 rounded-full tabular-nums shadow-sm">#{i + 1}</span>
                                    <PlatformBadge platform={ad.platform} className="absolute top-2.5 right-2.5 shadow-sm" />
                                </div>
                                <div className="p-4 flex flex-col gap-3 flex-1">
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-[#14171C] dark:text-white leading-snug line-clamp-2 break-words" title={ad.name}>{ad.name}</h3>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-[#5A606B] dark:text-gray-400 min-w-0">
                                            <StatusPill status={ad.status} />
                                            {(ad.format || ad.campaign) && <span className="truncate" title={ad.campaign}>· {[ad.format, ad.campaign].filter(Boolean).join(' · ')}</span>}
                                        </div>
                                    </div>

                                    {sortKey !== 'name' && (
                                        <div className="bg-[#F8F7F3] dark:bg-slate-900 rounded-xl p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-semibold text-[#5A606B] dark:text-gray-400">{opt.short}</span>
                                                <Delta value={adDelta(ad, sortKey)} invert={opt.lowerIsBetter} hideZero />
                                            </div>
                                            <div className="text-2xl font-bold tabular-nums text-[#14171C] dark:text-white mt-0.5">{formatMetric(value, opt.format)}</div>
                                            {!opt.lowerIsBetter && maxValue > 0 && (
                                                <div className="h-1.5 bg-[#E3E1D8] dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                                                    <div className="h-full bg-[#0B8A6A] dark:bg-teal-400 rounded-full" style={{ width: `${Math.max(2, ((value ?? 0) / maxValue) * 100)}%` }} />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 mt-auto">
                                        {secondary.map(k => {
                                            const o = sortOption(k);
                                            return (
                                                <div key={k} className="min-w-0">
                                                    <dt className="text-[11px] text-[#9AA1AC]">{o.short}</dt>
                                                    <dd className="text-[13px] font-semibold tabular-nums text-[#3A3F47] dark:text-gray-200 truncate">
                                                        {o.format === 'number' ? compact(ad[k] as number | null) : formatMetric(ad[k] as number | null, o.format)}
                                                    </dd>
                                                </div>
                                            );
                                        })}
                                    </dl>
                                    {ad.url && (
                                        <a href={ad.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#0B6B5A] dark:text-teal-300 flex items-center gap-1 truncate">
                                            <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Ver destino
                                        </a>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </section>
            ) : (
                <section className="bg-white dark:bg-slate-800 border border-[#E3E1D8] dark:border-slate-700 rounded-2xl overflow-x-auto">
                    <table className="w-full text-[13px] min-w-[960px]">
                        <thead>
                            <tr className="text-left text-[#5A606B] dark:text-gray-400 border-b border-[#E3E1D8] dark:border-slate-700">
                                <th className="py-3 pl-4 pr-2 font-semibold w-10">#</th>
                                <th className="py-3 px-2 font-semibold">
                                    <button onClick={() => onHeaderClick('name')} className={`font-semibold ${sortKey === 'name' ? 'text-[#14171C] dark:text-white' : ''}`}>
                                        Anuncio {sortKey === 'name' && (dir === 'asc' ? '↑' : '↓')}
                                    </button>
                                </th>
                                <th className="py-3 px-2 font-semibold">Plataforma</th>
                                <th className="py-3 px-2 font-semibold">Estado</th>
                                {tableCols.map(k => {
                                    const o = sortOption(k);
                                    const active = k === sortKey;
                                    return (
                                        <th key={k} className={`py-3 px-2 font-semibold text-right whitespace-nowrap ${active ? 'bg-[#F8F7F3] dark:bg-slate-900' : ''}`}>
                                            <button onClick={() => onHeaderClick(k)} title={o.help || `Ordenar por ${o.label}`}
                                                className={`font-semibold hover:text-[#14171C] dark:hover:text-white ${active ? 'text-[#14171C] dark:text-white' : ''}`}>
                                                {o.short} {active && (dir === 'desc' ? '↓' : '↑')}
                                            </button>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((ad, i) => (
                                <tr key={ad.key} className="border-b border-[#F1EFE8] dark:border-slate-700/60 last:border-0 hover:bg-[#FBFAF7] dark:hover:bg-slate-700/40">
                                    <td className="py-2.5 pl-4 pr-2 text-[#9AA1AC] tabular-nums">{i + 1}</td>
                                    <td className="py-2.5 px-2">
                                        <div className="flex items-center gap-3 min-w-0 max-w-[340px]">
                                            <AdThumb ad={ad} small className="h-10 w-10 rounded-lg shrink-0" />
                                            <div className="min-w-0">
                                                <div className="font-semibold text-[#14171C] dark:text-white truncate" title={ad.name}>{ad.name}</div>
                                                <div className="text-xs text-[#5A606B] dark:text-gray-400 truncate" title={ad.campaign}>{[ad.format, ad.campaign].filter(Boolean).join(' · ') || '—'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-2"><PlatformBadge platform={ad.platform} /></td>
                                    <td className="py-2.5 px-2"><StatusPill status={ad.status} /></td>
                                    {tableCols.map(k => {
                                        const o = sortOption(k);
                                        const active = k === sortKey;
                                        return (
                                            <td key={k} className={`py-2.5 px-2 text-right tabular-nums whitespace-nowrap ${active ? 'bg-[#F8F7F3] dark:bg-slate-900 font-bold text-[#14171C] dark:text-white' : 'text-[#3A3F47] dark:text-gray-300'}`}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {active && <Delta value={adDelta(ad, k)} invert={o.lowerIsBetter} hideZero />}
                                                    {formatMetric(ad[k] as number | null, o.format)}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {sorted.length > limit && (
                <div className="flex justify-center">
                    <button onClick={() => setLimit(l => l + PAGE)}
                        className="h-10 px-5 rounded-xl border border-[#D5D2C7] dark:border-slate-700 bg-white dark:bg-slate-800 text-[13px] font-semibold text-[#14171C] dark:text-white hover:bg-[#F8F7F3] dark:hover:bg-slate-700">
                        Mostrar más ({sorted.length - limit} restantes)
                    </button>
                </div>
            )}
            </>
            )}
        </div>
    );
};
