import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, LogOut, ArrowLeft } from 'lucide-react';
import { Api, AppUser, ROLE_LABELS } from '../services/apiClient';

const MIN_PASSWORD = 8;

/** Formulario para cambiar la contraseña propia. Al guardar, se cierran las sesiones en otros dispositivos. */
export const ChangePasswordForm: React.FC<{ onChanged?: (user: AppUser) => void }> = ({ onChanged }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const tooShort = next !== '' && next.length < MIN_PASSWORD;
  const mismatch = confirm !== '' && confirm !== next;
  const valid = current !== '' && next.length >= MIN_PASSWORD && next === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setDone(false);
    try {
      const { user } = await Api.changePassword(current, next);
      setCurrent(''); setNext(''); setConfirm('');
      setDone(true);
      onChanged?.(user);
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const field = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-indigo-500';
  const type = show ? 'text' : 'password';

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="pw-current" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña actual</label>
        <input id="pw-current" type={type} autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className={field} />
      </div>
      <div>
        <label htmlFor="pw-new" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nueva contraseña</label>
        <input id="pw-new" type={type} autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} className={field} />
        <p className={`text-xs mt-1 ${tooShort ? 'text-red-600' : 'text-gray-400'}`}>Mínimo {MIN_PASSWORD} caracteres.</p>
      </div>
      <div>
        <label htmlFor="pw-confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repite la nueva contraseña</label>
        <input id="pw-confirm" type={type} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={field} />
        {mismatch && <p className="text-xs mt-1 text-red-600">No coincide con la nueva contraseña.</p>}
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 select-none cursor-pointer w-fit">
        <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} className="accent-indigo-600" />
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} Mostrar contraseñas
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700 dark:text-green-400">Contraseña actualizada. Se cerró la sesión en tus otros dispositivos.</p>}
      <button type="submit" disabled={busy || !valid}
        className="self-start bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition disabled:opacity-50">
        {busy ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  );
};

/** Tarjeta "Mi cuenta": datos de la cuenta + cambio de contraseña. */
export const AccountCard: React.FC<{ user: AppUser; onChanged?: (user: AppUser) => void }> = ({ user, onChanged }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
    <div className="flex items-center gap-4 mb-6">
      <div className="h-14 w-14 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 text-xl font-bold uppercase">
        {user.username.slice(0, 2)}
      </div>
      <div>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{user.username}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{ROLE_LABELS[user.role]}</p>
      </div>
    </div>
    <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center">
      <KeyRound className="h-5 w-5 mr-2 text-indigo-600" /> Cambiar contraseña
    </h2>
    <ChangePasswordForm onChanged={onChanged} />
  </div>
);

/** Página completa: obligatoria para contraseñas temporales, o "Mi cuenta" para clientes (/cuenta). */
export const ChangePasswordPage: React.FC<{ user: AppUser; forced?: boolean; onChanged: (user: AppUser) => void; onLogout: () => void }> =
  ({ user, forced, onChanged, onLogout }) => (
    <div className="min-h-[100dvh] bg-[#F4F3EE] dark:bg-slate-900 p-4 sm:p-8">
      <div className="max-w-lg mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          {forced ? <span /> : (
            <a href="/" className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Volver
            </a>
          )}
          <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-slate-800">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
        {forced && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-bold mb-1">Cambia tu contraseña para continuar</p>
            Estás usando una contraseña temporal. Elige una nueva de al menos {MIN_PASSWORD} caracteres.
          </div>
        )}
        <AccountCard user={user} onChanged={onChanged} />
      </div>
    </div>
  );
