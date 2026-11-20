import React, { useEffect, useState } from 'react';
import { BarChart3, LogOut, KeyRound } from 'lucide-react';
import { Api, AppUser, MyShare, SHARE_PAGE_LABELS } from '../services/apiClient';

/**
 * Inicio de una cuenta de cliente: solo ve los enlaces que un administrador le asignó.
 * Con un único enlace entra directo a él.
 */
export const ClientHome: React.FC<{ user: AppUser; onLogout: () => void }> = ({ user, onLogout }) => {
  const [links, setLinks] = useState<MyShare[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Api.myShares()
      .then(list => {
        if (list.length === 1) window.location.replace(`/ver/${list[0].token}`);
        else setLinks(list);
      })
      .catch(e => setError(e.message));
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#F4F3EE] dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 h-16 border-b border-[#E3E1D8] dark:border-slate-700 flex items-center justify-between gap-3 px-4 sm:px-8">
        <div className="flex items-center gap-2.5 min-w-0">
          <svg width="28" height="28" viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="8" fill="#2DD4BF" /><path d="M8 21V14M15 21V9M22 21V16" stroke="#14171C" strokeWidth="3" strokeLinecap="round" fill="none" /></svg>
          <span className="font-bold text-lg text-[#14171C] dark:text-white truncate">OmniMetrics</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <a href="/cuenta" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700">
            <KeyRound className="h-4 w-4" /> <span className="hidden sm:inline">{user.username}</span>
          </a>
          <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      </header>
      <main className="max-w-2xl mx-auto p-4 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Tus reportes</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Elige el reporte que quieres ver.</p>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {links === null && !error && <p className="text-sm text-gray-400">Cargando…</p>}
        {links?.length === 0 && (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6 text-sm text-gray-600 dark:text-gray-300">
            Todavía no tienes reportes disponibles. Pide a tu contacto que te comparta un enlace.
          </div>
        )}
        <ul className="space-y-3">
          {links?.map(l => (
            <li key={l.id}>
              <a href={`/ver/${l.token}`}
                className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 hover:border-indigo-400 transition-colors">
                <BarChart3 className="h-6 w-6 text-indigo-600 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{l.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {l.pages.map(p => SHARE_PAGE_LABELS[p]).join(' · ')}
                    {l.expiresAt ? ` · Disponible hasta ${new Date(l.expiresAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
};
