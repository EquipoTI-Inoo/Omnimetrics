import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, ShieldCheck, User as UserIcon, Eye, EyeOff, Pencil } from 'lucide-react';
import { Api, AppUser, ClientOptions, Role, ROLE_LABELS } from '../services/apiClient';
import { ClientAccountsPicker, EMPTY_PICK, PickerValue, pickFromAccounts, pickIncomplete, toAccountsInput } from './ClientAccountsPicker';

const PLATFORM_LABELS: Record<string, string> = { meta: 'Meta Ads', kommo: 'Kommo' };

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const MIN_PASSWORD = 8;

/** Gestionar cuentas: los administradores crean y eliminan cuentas de cliente y de administrador. */
export const Accounts: React.FC<{ currentUser: AppUser }> = ({ currentUser }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>('client');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Cuentas de Meta / Kommo para asignar a clientes (se cargan una vez, cuando hacen falta)
  const [pick, setPick] = useState<PickerValue>(EMPTY_PICK);
  const [options, setOptions] = useState<ClientOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const loadOptions = () => {
    if (options || optionsLoading) return;
    setOptionsLoading(true);
    Api.clientOptions().then(setOptions).catch(e => setOptionsError(e.message)).finally(() => setOptionsLoading(false));
  };
  useEffect(() => { if (role === 'client') loadOptions(); }, [role]);

  // Edición de las cuentas de un cliente existente
  const [editId, setEditId] = useState<string | null>(null);
  const [editPick, setEditPick] = useState<PickerValue>(EMPTY_PICK);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const startEdit = (u: AppUser) => {
    setEditId(u.id); setEditPick(pickFromAccounts(u.accounts)); setEditError(''); setConfirmId(null);
    loadOptions();
  };
  const saveEdit = async (u: AppUser) => {
    setEditBusy(true); setEditError(''); setNotice('');
    try {
      await Api.userSetAccounts(u.id, toAccountsInput(editPick));
      setEditId(null);
      setNotice(`Cuentas de "${u.username}" actualizadas.`);
      await load();
    } catch (err: any) { setEditError(err.message); } finally { setEditBusy(false); }
  };

  const load = () => Api.users().then(setUsers).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const cleanUsername = username.trim().toLowerCase();
  const usernameInvalid = cleanUsername !== '' && !USERNAME_RE.test(cleanUsername);
  const passwordShort = password !== '' && password.length < MIN_PASSWORD;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const u = await Api.userCreate(cleanUsername, password, role, role === 'client' ? toAccountsInput(pick) : {});
      setUsername(''); setPassword(''); setRole('client'); setPick(EMPTY_PICK);
      setNotice(`Cuenta "${u.username}" creada como ${ROLE_LABELS[u.role].toLowerCase()}. Comparte el usuario y la contraseña con esa persona.`);
      await load();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const remove = async (u: AppUser) => {
    setError(''); setNotice('');
    try {
      const { revokedShares } = await Api.userDelete(u.id);
      setConfirmId(null);
      setNotice(`Cuenta "${u.username}" eliminada${revokedShares ? ` junto con ${revokedShares} ${revokedShares === 1 ? 'enlace' : 'enlaces'}` : ''}.`);
      await load();
    } catch (err: any) { setError(err.message); }
  };

  const field = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-indigo-500';
  const groups: { role: Role; title: string; hint: string }[] = [
    { role: 'admin', title: 'Administradores', hint: 'Ven toda la app, conectan cuentas, crean enlaces y gestionan cuentas.' },
    { role: 'client', title: 'Clientes', hint: 'Solo pueden abrir los enlaces que les compartas desde Ajustes → Compartir por enlace, y solo ven las cuentas que les asignes.' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestionar cuentas</h1>
        <p className="text-gray-500 dark:text-gray-400">Crea o elimina las cuentas que pueden entrar a OmniMetrics.</p>
      </div>

      <form onSubmit={create} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <UserPlus className="h-5 w-5 mr-2 text-indigo-600" /> Nueva cuenta
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="new-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuario</label>
            <input id="new-username" value={username} onChange={e => setUsername(e.target.value)} maxLength={32}
              autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="ej: costanova" className={field} />
            <p className={`text-xs mt-1 ${usernameInvalid ? 'text-red-600' : 'text-gray-400'}`}>
              3 a 32 caracteres: minúsculas, números, punto, guion o guion bajo.
            </p>
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
            <div className="relative">
              <input id="new-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="new-password" className={`${field} pr-10`} />
              <button type="button" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2 top-1.5 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className={`text-xs mt-1 ${passwordShort ? 'text-red-600' : 'text-gray-400'}`}>Mínimo {MIN_PASSWORD} caracteres.</p>
          </div>
        </div>
        <fieldset className="mt-4">
          <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo de cuenta</legend>
          <div className="flex flex-wrap gap-2">
            {(['client', 'admin'] as Role[]).map(r => (
              <label key={r} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer select-none ${role === r
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300'}`}>
                <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} className="accent-indigo-600" />
                {ROLE_LABELS[r]}
              </label>
            ))}
          </div>
        </fieldset>
        {role === 'client' && (
          <fieldset className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
            <legend className="sr-only">Cuentas del cliente</legend>
            <ClientAccountsPicker idPrefix="new" options={options} loading={optionsLoading} error={optionsError} value={pick} onChange={setPick} />
          </fieldset>
        )}
        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
        {notice && <p className="text-sm text-green-700 dark:text-green-400 mt-4">{notice}</p>}
        <button type="submit" disabled={busy || !USERNAME_RE.test(cleanUsername) || password.length < MIN_PASSWORD || (role === 'client' && pickIncomplete(pick))}
          className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition disabled:opacity-50">
          {busy ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>

      {groups.map(g => {
        const list = users.filter(u => u.role === g.role);
        return (
          <section key={g.role} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              {g.role === 'admin' ? <ShieldCheck className="h-5 w-5 mr-2 text-indigo-600" /> : <UserIcon className="h-5 w-5 mr-2 text-indigo-600" />}
              {g.title} <span className="ml-2 text-sm font-medium text-gray-400">{list.length}</span>
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{g.hint}</p>
            {list.length === 0 ? (
              <p className="text-sm text-gray-400">Todavía no hay cuentas de este tipo.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-700">
                {list.map(u => {
                  const isMe = u.id === currentUser.id;
                  return (
                    <li key={u.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                          {u.username} {isMe && <span className="ml-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">(tú)</span>}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Creada {new Date(u.createdAt).toLocaleDateString()}{u.createdBy ? ` por ${u.createdBy}` : ''}
                        </p>
                        {u.role === 'client' && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {u.accounts?.length ? u.accounts.map(a => (
                              <span key={a.platform} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                                {PLATFORM_LABELS[a.platform] ?? a.platform}: {a.name}
                              </span>
                            )) : (
                              <span className="text-[11px] text-gray-400">Sin cuentas asignadas</span>
                            )}
                          </div>
                        )}
                      </div>
                      {!isMe && (confirmId === u.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-gray-600 dark:text-gray-300">
                            {u.role === 'client' ? '¿Eliminar? También se eliminan sus enlaces.' : '¿Eliminar esta cuenta?'}
                          </span>
                          <button onClick={() => remove(u)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700">Eliminar</button>
                          <button onClick={() => setConfirmId(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200">Cancelar</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {u.role === 'client' && editId !== u.id && (
                            <button onClick={() => startEdit(u)} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700">
                              <Pencil className="h-3.5 w-3.5" /> Editar cuentas
                            </button>
                          )}
                          <button onClick={() => setConfirmId(u.id)} aria-label={`Eliminar ${u.username}`} title="Eliminar"
                            className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                      {editId === u.id && (
                        <div className="w-full mt-2 p-4 rounded-lg bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700">
                          <ClientAccountsPicker idPrefix={`edit-${u.id}`} options={options} loading={optionsLoading} error={editError || optionsError}
                            value={editPick} onChange={setEditPick} current={u.accounts} />
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => saveEdit(u)} disabled={editBusy || pickIncomplete(editPick)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                              {editBusy ? 'Guardando…' : 'Guardar cuentas'}
                            </button>
                            <button onClick={() => setEditId(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200">Cancelar</button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
};
