import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { DateRange } from '../types';

interface DateRangePickerProps {
    dateRange: DateRange;
    onChange: (range: DateRange) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ dateRange, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustom(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);

  const handlePreset = (days: number | 'today' | 'yesterday' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisSemester' | 'thisYear', label: string) => {
      const end = new Date();
      const start = new Date();
      
      if (typeof days === 'number') {
        start.setDate(end.getDate() - days);
      } else {
        switch (days) {
            case 'today':
                break; 
            case 'yesterday':
                start.setDate(end.getDate() - 1);
                end.setDate(end.getDate() - 1);
                break;
            case 'thisMonth':
                start.setDate(1);
                break;
            case 'lastMonth':
                start.setMonth(start.getMonth() - 1);
                start.setDate(1);
                end.setDate(0);
                break;
            case 'thisQuarter':
                const currMonth = start.getMonth();
                const qStartMonth = Math.floor(currMonth / 3) * 3;
                start.setMonth(qStartMonth);
                start.setDate(1);
                break;
            case 'thisSemester':
                const sStartMonth = start.getMonth() < 6 ? 0 : 6;
                start.setMonth(sStartMonth);
                start.setDate(1);
                break;
            case 'thisYear':
                start.setMonth(0);
                start.setDate(1);
                break;
        }
      }

      onChange({ startDate: start, endDate: end, label });
      setIsOpen(false);
      setShowCustom(false);
  };

  const applyCustom = () => {
      if (!customStart || !customEnd) return;
      const start = new Date(customStart);
      const end = new Date(customEnd);
      if (start > end) {
          alert("La fecha de inicio no puede ser posterior a la fecha final.");
          return;
      }
      onChange({
          startDate: start,
          endDate: end,
          label: `Personalizado`
      });
      setIsOpen(false);
      setShowCustom(false);
  };

  return (
    <div className="relative" ref={menuRef}>
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-700 dark:text-gray-200 font-medium text-sm"
        >
            <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>{dateRange.label}</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>

        {isOpen && (
            <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 z-50 overflow-hidden animate-in zoom-in-95 duration-200">
                {!showCustom ? (
                    <div className="p-2 space-y-1">
                            <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Rangos Predefinidos</div>
                            <button onClick={() => handlePreset('today', 'Hoy')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700 text-sm text-gray-900 dark:text-gray-200">Hoy</button>
                            <button onClick={() => handlePreset('yesterday', 'Ayer')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700 text-sm text-gray-900 dark:text-gray-200">Ayer</button>
                            <button onClick={() => handlePreset(7, 'Últimos 7 días')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700 text-sm text-gray-900 dark:text-gray-200">Últimos 7 días</button>
                            <button onClick={() => handlePreset('thisMonth', 'Este Mes')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700 text-sm text-gray-900 dark:text-gray-200">Este Mes</button>
                            <button onClick={() => handlePreset('lastMonth', 'Mes Anterior')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700 text-sm text-gray-900 dark:text-gray-200">Mes Anterior</button>
                            <button onClick={() => handlePreset('thisQuarter', 'Este Trimestre')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700 text-sm text-gray-900 dark:text-gray-200">Este Trimestre</button>
                            <button onClick={() => handlePreset('thisSemester', 'Este Semestre')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700 text-sm text-gray-900 dark:text-gray-200">Este Semestre</button>
                            <button onClick={() => handlePreset('thisYear', 'Este Año')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700 text-sm text-gray-900 dark:text-gray-200">Este Año</button>
                            <div className="h-px bg-gray-100 dark:bg-slate-700 my-1"></div>
                            <button
                                onClick={() => setShowCustom(true)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 font-bold text-indigo-600 dark:text-indigo-400"
                            >
                                Personalizado...
                            </button>
                    </div>
                ) : (
                    <div className="p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Rango Personalizado</h3>
                            <button onClick={() => setShowCustom(false)} className="text-gray-400"><X className="h-4 w-4" /></button>
                        </div>
                        <label className="block text-xs text-gray-500 mb-1">Inicio</label>
                        <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-full mb-2 border rounded p-2 text-sm text-gray-900 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                        <label className="block text-xs text-gray-500 mb-1">Fin</label>
                        <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-full mb-2 border rounded p-2 text-sm text-gray-900 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                        <button onClick={applyCustom} className="w-full py-2 bg-indigo-600 text-white rounded font-bold text-sm hover:bg-indigo-700">Aplicar</button>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};