import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { Api } from '../services/apiClient';

export const Login: React.FC<{ onSuccess: () => void; initialError?: string }> = ({ onSuccess, initialError }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError || '');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await Api.login(password);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#F4F3EE] dark:bg-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white dark:bg-slate-800 border border-[#E3E1D8] dark:border-slate-700 rounded-2xl p-6 sm:p-8 flex flex-col gap-5">
        <div className="flex items-center gap-2.5">
          <svg width="34" height="34" viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="8" fill="#2DD4BF" /><path d="M8 21V14M15 21V9M22 21V16" stroke="#14171C" strokeWidth="3" strokeLinecap="round" fill="none" /></svg>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-lg text-[#14171C] dark:text-white tracking-tight">OmniMetrics</span>
            <span className="text-[11px] text-[#5A606B] dark:text-gray-400 tracking-widest uppercase">Marketing + CRM</span>
          </div>
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-[#14171C] dark:text-white mb-1.5">Contraseña de acceso</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input id="password" type="password" autoFocus autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full pl-9 pr-3 h-10 border border-[#D5D2C7] dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-[#14171C] dark:text-white outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>
        {error && <p className="text-sm text-[#A3201A] bg-[#FCE4E1] rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading || !password}
          className="h-10 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50 hover:bg-indigo-700 transition-colors">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
};
