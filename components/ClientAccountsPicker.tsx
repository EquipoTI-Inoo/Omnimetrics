import React from 'react';
import { AssignedAccount, ClientAccountsInput, ClientOptions } from '../services/apiClient';

/** Elección de cuentas de un cliente (ambas opcionales) */
export interface PickerValue {
  metaId: string;
  /** '' = ninguna, '__new__' = otra cuenta (subdominio + token), o el accountId de una conocida */
  kommo: string;
  subdomain: string;
  token: string;
}

export const EMPTY_PICK: PickerValue = { metaId: '', kommo: '', subdomain: '', token: '' };

export const pickFromAccounts = (accounts: AssignedAccount[] = []): PickerValue => ({
  ...EMPTY_PICK,
  metaId: accounts.find(a => a.platform === 'meta')?.accountId || '',
  kommo: accounts.find(a => a.platform === 'kommo')?.accountId || '',
});

export const toAccountsInput = (v: PickerValue): ClientAccountsInput => ({
  meta: v.metaId ? { adAccountId: v.metaId } : null,
  kommo: v.kommo === '__new__' ? { subdomain: v.subdomain.trim(), token: v.token.trim() } : v.kommo ? { accountId: v.kommo } : null,
});

export const pickIncomplete = (v: PickerValue) => v.kommo === '__new__' && (!v.subdomain.trim() || !v.token.trim());

const field = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-indigo-500';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

export const ClientAccountsPicker: React.FC<{
  options: ClientOptions | null;
  loading: boolean;
  error?: string;
  value: PickerValue;
  onChange: (v: PickerValue) => void;
  /** Cuentas que ya tiene asignadas (para mostrarlas aunque ya no aparezcan en las listas) */
  current?: AssignedAccount[];
  idPrefix: string;
}> = ({ options, loading, error, value, onChange, current = [], idPrefix }) => {
  const set = (patch: Partial<PickerValue>) => onChange({ ...value, ...patch });

  // Agrupa las cuentas de Meta por negocio
  const metaAccounts = options?.meta.accounts ?? [];
  const groups = [...new Set(metaAccounts.map(a => a.group || 'Cuentas'))];
  const currentMeta = current.find(a => a.platform === 'meta');
  const metaMissing = currentMeta && !metaAccounts.some(a => a.id === currentMeta.accountId);

  const kommoOptions = options?.kommo ?? [];
  const currentKommo = current.find(a => a.platform === 'kommo');
  const kommoMissing = currentKommo && !kommoOptions.some(k => k.accountId === currentKommo.accountId);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label htmlFor={`${idPrefix}-meta`} className={labelCls}>Cuenta de Meta Ads <span className="text-gray-400 font-normal">(opcional)</span></label>
        <select id={`${idPrefix}-meta`} value={value.metaId} onChange={e => set({ metaId: e.target.value })} disabled={loading} className={field}>
          <option value="">{loading ? 'Cargando cuentas…' : 'Sin cuenta de Meta'}</option>
          {metaMissing && <option value={currentMeta!.accountId}>{currentMeta!.name} (actual)</option>}
          {groups.map(g => (
            <optgroup key={g} label={g}>
              {metaAccounts.filter(a => (a.group || 'Cuentas') === g).map(a => (
                <option key={a.id} value={a.id}>{a.name}{a.currency ? ` · ${a.currency}` : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {!loading && options && !options.meta.connected && (
          <p className="text-xs text-gray-400 mt-1">Conecta Meta en Conexiones para ver tus cuentas publicitarias.</p>
        )}
        {!loading && options?.meta.connected && metaAccounts.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">No se pudieron listar las cuentas de Meta. Revisa la conexión de Meta.</p>
        )}
      </div>

      <div>
        <label htmlFor={`${idPrefix}-kommo`} className={labelCls}>Cuenta de Kommo <span className="text-gray-400 font-normal">(opcional)</span></label>
        <select id={`${idPrefix}-kommo`} value={value.kommo} onChange={e => set({ kommo: e.target.value })} disabled={loading} className={field}>
          <option value="">{loading ? 'Cargando cuentas…' : 'Sin cuenta de Kommo'}</option>
          {kommoMissing && <option value={currentKommo!.accountId}>{currentKommo!.name} (actual)</option>}
          {kommoOptions.map(k => <option key={k.accountId} value={k.accountId}>{k.name} · {k.accountId}</option>)}
          <option value="__new__">Otra cuenta de Kommo…</option>
        </select>
        {value.kommo === '__new__' && (
          <div className="mt-2 flex flex-col gap-2">
            <input value={value.subdomain} onChange={e => set({ subdomain: e.target.value })} placeholder="Subdominio (ej: miempresa)"
              aria-label="Subdominio de Kommo" autoComplete="off" spellCheck={false} className={field} />
            <input value={value.token} onChange={e => set({ token: e.target.value })} placeholder="Token de larga duración" type="password"
              aria-label="Token de Kommo" autoComplete="off" className={field} />
          </div>
        )}
      </div>

      {error && <p className="sm:col-span-2 text-xs text-red-600">{error}</p>}
      <p className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400">
        Si asignas cuentas, los enlaces de este cliente mostrarán <b>solo</b> esas cuentas. Si no asignas ninguna, sus enlaces muestran
        las cuentas que estaban conectadas al crear cada enlace.
      </p>
    </div>
  );
};
