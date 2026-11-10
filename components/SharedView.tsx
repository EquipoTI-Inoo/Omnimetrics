import React, { useEffect, useState } from 'react';
import { Eye, RefreshCw, AlertCircle, LayoutDashboard, BarChart2, Megaphone } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Dashboard } from './Dashboard';
import { Reports } from './Reports';
import { Ads } from './Ads';
import { SharePage, SHARE_PAGE_LABELS } from '../services/apiClient';

const PAGE_ICONS: Record<SharePage, React.ElementType> = { dashboard: LayoutDashboard, reports: BarChart2, ads: Megaphone };

/** La pestaña abierta va en ?tab=, para que el visitante pueda recargar o guardar el enlace sin perderla */
const initialTab = (): SharePage | null => {
  const t = new URLSearchParams(window.location.search).get('tab');
  return t === 'dashboard' || t === 'reports' || t === 'ads' ? t : null;
};

/**
 * Vista pública de solo lectura (/ver/<token>). Muestra solo las pestañas que eligió quien creó el enlace
 * (Dashboard, Plataformas y/o Anuncios), sin menú lateral, ajustes ni conexiones.
 */
export const SharedView: React.FC = () => {
  const { lastSync, isLoading, triggerSync, integrityReport, shareInfo } = useData();
  const pages = shareInfo?.pages ?? [];
  const [tab, setTab] = useState<SharePage | null>(initialTab);
  // Una pestaña no permitida (o ninguna en la URL) cae en la primera permitida
  const active: SharePage | undefined = tab && pages.includes(tab) ? tab : pages[0];

  const go = (page: SharePage) => {
    setTab(page);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', page);
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0 });
  };

  // No indexar la página ni filtrar el token del enlace por el header Referer
  useEffect(() => {
    document.title = 'OmniMetrics · Vista compartida';
    const add = (name: string, content: string) => {
      const m = document.createElement('meta');
      m.name = name; m.content = content;
      document.head.appendChild(m);
      return m;
    };
    const tags = [add('robots', 'noindex, nofollow'), add('referrer', 'no-referrer')];
    return () => tags.forEach(t => t.remove());
  }, []);

  const failed = integrityReport.status === 'Error';

  return (
    <div className="min-h-screen bg-[#F4F3EE] dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 h-16 border-b border-[#E3E1D8] dark:border-slate-700 flex items-center justify-between gap-3 px-4 sm:px-8 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg font-bold text-[#14171C] dark:text-white truncate">{shareInfo?.label || 'OmniMetrics'}</span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600 whitespace-nowrap">
            <Eye className="h-3 w-3" /> Solo lectura
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Última actualización</p>
            <p className="text-xs font-mono text-gray-600 dark:text-gray-300">{lastSync.toLocaleTimeString()}</p>
          </div>
          <button
            onClick={() => triggerSync()}
            disabled={isLoading}
            aria-label="Actualizar datos"
            className="p-2 rounded-full border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {pages.length > 1 && (
        <nav aria-label="Secciones" className="bg-white dark:bg-slate-800 border-b border-[#E3E1D8] dark:border-slate-700 px-4 sm:px-8 sticky top-16 z-10 overflow-x-auto">
          <div className="max-w-7xl mx-auto flex gap-1">
            {pages.map(p => {
              const Icon = PAGE_ICONS[p];
              const on = p === active;
              return (
                <button key={p} onClick={() => go(p)} aria-current={on ? 'page' : undefined}
                  className={`flex items-center gap-2 px-3 sm:px-4 h-12 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${on
                    ? 'border-[#0B8A6A] text-[#14171C] dark:text-white dark:border-teal-400'
                    : 'border-transparent text-[#5A606B] dark:text-gray-400 hover:text-[#14171C] dark:hover:text-white'}`}>
                  <Icon className="h-4 w-4" />{SHARE_PAGE_LABELS[p]}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto relative">
        {failed && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{integrityReport.checks[0]?.replace(/^❌\s*/, '') || 'No se pudo cargar la información.'}</span>
          </div>
        )}
        {!shareInfo && isLoading && <p className="text-sm text-[#5A606B] dark:text-gray-400">Cargando…</p>}
        {active === 'dashboard' && <Dashboard onNavigate={() => {}} readOnly />}
        {active === 'reports' && <Reports />}
        {active === 'ads' && <Ads />}
      </main>
    </div>
  );
};
