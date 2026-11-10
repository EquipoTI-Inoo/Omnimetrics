import React, { useEffect, useState } from 'react';
import { Link2, Copy, Check, Trash2, Eye } from 'lucide-react';
import { Api, ShareLink, SharePage, SHARE_PAGE_LABELS } from '../services/apiClient';

const ALL_PAGES = Object.keys(SHARE_PAGE_LABELS) as SharePage[];
/** Enlaces creados antes de poder elegir pestañas solo muestran el dashboard */
const pagesOf = (s: ShareLink): SharePage[] => s.pages?.length ? s.pages : ['dashboard'];

const linkFor = (s: ShareLink) => `${window.location.origin}/ver/${s.token}`;
const isExpired = (s: ShareLink) => !!s.expiresAt && new Date(s.expiresAt).getTime() <= Date.now();

/** Gestión de enlaces para compartir el dashboard (solo lectura) desde Ajustes. */
export const ShareLinks: React.FC = () => {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState('');
  const [pages, setPages] = useState<SharePage[]>(ALL_PAGES);
  const togglePage = (p: SharePage) =>
    setPages(cur => cur.includes(p) ? cur.filter(x => x !== p) : ALL_PAGES.filter(x => x === p || cur.includes(x)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => Api.shares().then(setLinks).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true); setError('');
    try {
      await Api.shareCreate(label.trim(), days ? Number(days) : undefined, pages);
      setLabel(''); setDays(''); setPages(ALL_PAGES);
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const revoke = async (s: ShareLink) => {
    if (!window.confirm(`¿Revocar "${s.label}"? Quien tenga este enlace dejará de poder verlo.`)) return;
    try { await Api.shareRevoke(s.id); await load(); } catch (e: any) { setError(e.message); }
  };

  const copy = async (s: ShareLink) => {
    const url = linkFor(s);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copia el enlace:', url);
    }
    setCopied(s.id);
    setTimeout(() => setCopied(c => (c === s.id ? null : c)), 2000);
  };

  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center">
        <Link2 className="h-5 w-5 mr-2 text-indigo-600" />
        Compartir por enlace
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Crea un enlace de solo lectura y elige qué pestañas puede ver quien lo abra. No necesita contraseña y no tendrá acceso a
        conexiones, ajustes, Insights IA ni al Constructor.
      </p>

      {isLocal && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
          Estás usando la app en <b>{window.location.host}</b>: el enlace solo abrirá en este computador. Para que otros lo abran, publica la app
          (o usa un túnel) y crea el enlace desde esa dirección.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input value={label} onChange={e => setLabel(e.target.value)} maxLength={60} placeholder="Nombre (ej: Cliente Costa Nova)"
          aria-label="Nombre del enlace"
          className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" />
        <select value={days} onChange={e => setDays(e.target.value)} aria-label="Vigencia"
          className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-700 outline-none">
          <option value="">Sin vencimiento</option>
          <option value="7">Vence en 7 días</option>
          <option value="30">Vence en 30 días</option>
          <option value="90">Vence en 90 días</option>
        </select>
        <button onClick={create} disabled={busy || pages.length === 0}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition disabled:opacity-50 whitespace-nowrap">
          {busy ? 'Creando…' : 'Crear enlace'}
        </button>
      </div>

      <fieldset className="mb-4">
        <legend className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Pestañas visibles en el enlace</legend>
        <div className="flex flex-wrap gap-2">
          {ALL_PAGES.map(p => (
            <label key={p} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer select-none ${pages.includes(p)
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
              : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300'}`}>
              <input type="checkbox" checked={pages.includes(p)} onChange={() => togglePage(p)} className="accent-indigo-600" />
              {SHARE_PAGE_LABELS[p]}
            </label>
          ))}
        </div>
        {pages.length === 0 && <p className="text-xs text-red-600 mt-2">Elige al menos una pestaña.</p>}
      </fieldset>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      {links.length === 0 ? (
        <p className="text-sm text-gray-400">Todavía no has creado enlaces.</p>
      ) : (
        <ul className="space-y-3">
          {links.map(s => (
            <li key={s.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{s.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-x-3">
                    <span>Creado {new Date(s.createdAt).toLocaleDateString()}</span>
                    <span className={isExpired(s) ? 'text-red-600 font-semibold' : ''}>
                      {s.expiresAt ? (isExpired(s) ? 'Vencido' : `Vence ${new Date(s.expiresAt).toLocaleDateString()}`) : 'Sin vencimiento'}
                    </span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{s.views} {s.views === 1 ? 'visita' : 'visitas'}</span>
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {pagesOf(s).map(p => (
                      <span key={p} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">{SHARE_PAGE_LABELS[p]}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => copy(s)} disabled={isExpired(s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40">
                    {copied === s.id ? <><Check className="h-3.5 w-3.5 text-green-600" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar enlace</>}
                  </button>
                  <button onClick={() => revoke(s)} aria-label={`Revocar ${s.label}`} title="Revocar"
                    className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <input readOnly value={linkFor(s)} onFocus={e => e.currentTarget.select()} aria-label="Enlace"
                className="mt-2 w-full text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded px-2 py-1.5" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
