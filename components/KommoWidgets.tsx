import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { KommoPipeline, LossReason } from '../types';

// --- Pipeline selection (remembered per browser) ---

export const ALL_PIPELINES = 'all';
const STORAGE_KEY = 'omni.kommo.pipeline';

const readStored = (key: string): string | null => {
    try { return localStorage.getItem(`${STORAGE_KEY}.${key}`); } catch { return null; }
};
const writeStored = (key: string, value: string) => {
    try { localStorage.setItem(`${STORAGE_KEY}.${key}`, value); } catch { /* storage unavailable */ }
};

/**
 * Selected pipeline id, falling back to `fallback` when the stored one no longer exists.
 * `scope` keeps the Dashboard and Plataformas selections independent.
 */
export const usePipelineSelection = (pipelines: KommoPipeline[], scope: string, allowAll: boolean) => {
    const [selected, setSelected] = useState<string | null>(() => readStored(scope));
    const valid = (id: string | null) => !!id && ((allowAll && id === ALL_PIPELINES) || pipelines.some(p => p.id === id));
    const fallback = allowAll ? ALL_PIPELINES : pipelines[0]?.id ?? '';
    const current = valid(selected) ? selected! : fallback;
    const change = (id: string) => { setSelected(id); writeStored(scope, id); };
    return [current, change] as const;
};

type KommoData = {
    pipelines: KommoPipeline[];
    agents: any[];
    channels: any[];
    salesHistory: any[];
    lossReasons: LossReason[];
};

/** Kommo data narrowed to one pipeline (or untouched for "all" / data without per-pipeline stats). */
export const scopeKommo = <T extends KommoData>(kommo: T, pipelineId: string): T => {
    if (pipelineId === ALL_PIPELINES) return kommo;
    const p = kommo.pipelines.find(x => x.id === pipelineId);
    if (!p) return { ...kommo, pipelines: [], agents: [], salesHistory: [], lossReasons: [] };
    return {
        ...kommo,
        pipelines: [p],
        agents: p.agents ?? kommo.agents,
        lossReasons: p.lossReasons ?? kommo.lossReasons,
        salesHistory: p.salesHistory ?? kommo.salesHistory,
    };
};

export const PipelineSelect: React.FC<{
    pipelines: KommoPipeline[];
    value: string;
    onChange: (id: string) => void;
    allowAll?: boolean;
    className?: string;
}> = ({ pipelines, value, onChange, allowAll, className = '' }) => (
    <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Pipeline de Kommo"
        className={`max-w-full bg-white dark:bg-slate-800 border border-[#D5D2C7] dark:border-slate-600 text-[#14171C] dark:text-white text-[13px] font-semibold rounded-lg h-9 px-2.5 outline-none focus:border-indigo-500 ${className}`}
    >
        {allowAll && <option value={ALL_PIPELINES}>Todos los pipelines</option>}
        {pipelines.map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.archived ? ' (archivado)' : ''}</option>
        ))}
    </select>
);

// --- Loss reasons donut + scrollable legend ---

// Enough distinct hues that neighbouring reasons never share a color
const PALETTE = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#84cc16',
    '#f97316', '#14b8a6', '#a855f7', '#e11d48', '#3b82f6', '#22c55e', '#eab308', '#d946ef',
];
const colorAt = (i: number) => i < PALETTE.length ? PALETTE[i] : `hsl(${(i * 137.5) % 360} 65% 55%)`;

const pct = (count: number, total: number) => total > 0 ? (count / total * 100) : 0;
const fmtPct = (v: number) => `${v < 10 ? v.toFixed(1) : v.toFixed(0)}%`;

export const LossReasonsChart: React.FC<{ reasons: LossReason[] }> = ({ reasons }) => {
    const [active, setActive] = useState<number | null>(null);
    const total = reasons.reduce((s, r) => s + r.count, 0);

    if (total === 0) {
        return <div className="h-48 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">Sin leads perdidos en este periodo.</div>;
    }

    const focus = active != null ? reasons[active] : null;

    return (
        <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-stretch">
            {/* Donut */}
            <div className="relative w-[220px] h-[220px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={reasons}
                            dataKey="count"
                            nameKey="reason"
                            cx="50%"
                            cy="50%"
                            innerRadius={66}
                            outerRadius={98}
                            paddingAngle={reasons.length > 1 ? 1 : 0}
                            minAngle={2}
                            stroke="none"
                            isAnimationActive={false}
                            onMouseEnter={(_: unknown, i: number) => setActive(i)}
                            onMouseLeave={() => setActive(null)}
                        >
                            {reasons.map((r, i) => (
                                <Cell key={r.reason} fill={colorAt(i)} fillOpacity={active == null || active === i ? 1 : 0.25} className="cursor-pointer outline-none" />
                            ))}
                        </Pie>
                        <Tooltip
                            wrapperStyle={{ zIndex: 20 }}
                            contentStyle={{ borderRadius: 10, border: '1px solid #E3E1D8', fontSize: 13 }}
                            formatter={(v: any, name: any) => [`${Number(v).toLocaleString()} (${fmtPct(pct(Number(v), total))})`, name]}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {/* Center label: hovered reason or the total */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-14">
                    {focus ? (
                        <>
                            <span className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{fmtPct(pct(focus.count, total))}</span>
                            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{focus.count.toLocaleString()} leads</span>
                        </>
                    ) : (
                        <>
                            <span className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{total.toLocaleString()}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">perdidos</span>
                        </>
                    )}
                </div>
            </div>

            {/* Legend: scrolls when there are many reasons */}
            <ul className="w-full min-w-0 flex-1 max-h-[260px] overflow-y-auto pr-1 text-[13px]" onMouseLeave={() => setActive(null)}>
                {reasons.map((r, i) => {
                    const share = pct(r.count, total);
                    const isActive = active === i;
                    return (
                        <li
                            key={r.reason}
                            onMouseEnter={() => setActive(i)}
                            title={`${r.reason}: ${r.count.toLocaleString()} (${fmtPct(share)})`}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-default transition-colors ${isActive ? 'bg-gray-100 dark:bg-slate-700' : ''} ${active != null && !isActive ? 'opacity-50' : ''}`}
                        >
                            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: colorAt(i) }} />
                            <span className="flex-1 min-w-0 truncate text-gray-800 dark:text-gray-200">{r.reason}</span>
                            <span className="tabular-nums text-right text-gray-500 dark:text-gray-400">{r.count.toLocaleString()}</span>
                            <span className="w-12 tabular-nums text-right font-semibold text-gray-900 dark:text-white">{fmtPct(share)}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};
