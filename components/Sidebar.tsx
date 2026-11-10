import React from 'react';
import { LayoutDashboard, BarChart2, Sparkles, HelpCircle, Settings, Plug, Wrench, X, Megaphone } from 'lucide-react';
import { useData } from '../context/DataContext';

interface SidebarProps {
  activePage: string;
  setPage: (page: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, setPage, isOpen, onClose }) => {
  const { lastSync, integrityReport } = useData();
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reports', label: 'Plataformas', icon: BarChart2 },
    { id: 'ads', label: 'Anuncios', icon: Megaphone },
    { id: 'insights', label: 'Insights IA', icon: Sparkles },
    { id: 'connections', label: 'Conexiones', icon: Plug },
    { id: 'builder', label: 'Constructor', icon: Wrench },
    { id: 'help', label: 'Ayuda', icon: HelpCircle },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ];
  const healthy = integrityReport.status === 'Healthy';
  const go = (page: string) => { setPage(page); onClose(); };

  return (
    <>
    {/* Mobile backdrop */}
    <div onClick={onClose} aria-hidden="true"
      className={`fixed inset-0 bg-black/50 z-30 lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
    <aside className={`w-64 bg-[#14171C] text-[#C9CDD4] flex flex-col justify-between h-[100dvh] fixed left-0 top-0 z-40 px-3.5 py-5 overflow-y-auto transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2.5 px-2">
          <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="8" fill="#2DD4BF" /><path d="M8 21V14M15 21V9M22 21V16" stroke="#14171C" strokeWidth="3" strokeLinecap="round" fill="none" /></svg>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-[17px] text-white tracking-tight">OmniMetrics</span>
            <span className="text-[11px] text-[#9AA1AC] tracking-widest uppercase">Marketing + CRM</span>
          </div>
          <button onClick={onClose} aria-label="Cerrar menú" className="ml-auto p-1.5 rounded-lg text-[#9AA1AC] hover:text-white hover:bg-[#1D2229] lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button key={item.id} onClick={() => go(item.id)}
                className={`flex items-center gap-3 px-3 py-[11px] rounded-[10px] text-sm font-medium text-left transition-colors ${active ? 'bg-[#222831] text-white shadow-[inset_3px_0_0_#2DD4BF]' : 'hover:bg-[#1D2229] hover:text-white'}`}>
                <Icon className="h-[18px] w-[18px]" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="bg-[#1D2229] border border-[#2A313A] rounded-xl p-3.5 flex flex-col gap-2.5 mt-6">
        <div className="flex items-center gap-2 text-[#E6E8EC] font-semibold text-[13px]">
          <span className={`w-2 h-2 rounded-full ${healthy ? 'bg-[#2DD4BF]' : 'bg-[#F87171]'}`} />
          {healthy ? 'Datos íntegros' : 'Revisar datos'}
        </div>
        <div className="text-xs text-[#9AA1AC] leading-relaxed">Última sincronización<br />{lastSync.toLocaleTimeString()}</div>
        <button onClick={() => go('connections')} className="text-xs font-semibold text-[#2DD4BF] text-left">Administrar conexiones →</button>
      </div>
    </aside>
    </>
  );
};
