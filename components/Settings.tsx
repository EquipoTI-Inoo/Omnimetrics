import React, { useState } from 'react';
import { Moon, Sun, Monitor, Bell, Globe, Layout, Target, Eye, EyeOff, FlaskConical } from 'lucide-react';
import { BusinessGoal, Platform } from '../types';
import { useData } from '../context/DataContext';
import { ShareLinks } from './ShareLinks';

interface SettingsProps {
    isDark: boolean;
    setTheme: (theme: 'light' | 'dark') => void;
}

export const Settings: React.FC<SettingsProps> = ({ isDark, setTheme }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [language, setLanguage] = useState('es');
  
  const { preferences, updatePreferences } = useData();

  const handleGoalChange = (goal: BusinessGoal) => {
      updatePreferences({ ...preferences, defaultGoal: goal });
  };

  const togglePlatform = (platform: string) => {
      const newVisible = { ...preferences.visiblePlatforms, [platform]: !preferences.visiblePlatforms[platform] };
      updatePreferences({ ...preferences, visiblePlatforms: newVisible });
  };

  const toggleDemoMode = () => {
      updatePreferences({ ...preferences, isDemoMode: !preferences.isDemoMode });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración</h1>
        <p className="text-gray-500 dark:text-gray-400">Personaliza tu experiencia en OmniMetrics.</p>
      </div>

      {/* DEMO MODE SECTION */}
      <div className={`rounded-xl shadow-sm border p-6 transition-colors ${
          preferences.isDemoMode 
          ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' 
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
      }`}>
          <div className="flex items-center justify-between">
              <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${preferences.isDemoMode ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                      <FlaskConical className="h-6 w-6" />
                  </div>
                  <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Modo de Prueba (Demo)</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-lg">
                          Activa esta opción para ver el dashboard funcionando con <strong>datos simulados</strong>. 
                          Útil para demostraciones o familiarizarse con la plataforma sin conectar APIs reales.
                          Tus credenciales reales no se borrarán.
                      </p>
                  </div>
              </div>
              
              <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={preferences.isDemoMode} 
                    onChange={toggleDemoMode}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
          </div>
      </div>

      {/* Dashboard Customization Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <Layout className="h-5 w-5 mr-2 text-indigo-600" />
              Personalización del Dashboard
          </h3>
          
          <div className="space-y-6">
              {/* Business Goal Selector */}
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                      <Target className="h-4 w-4 mr-2" />
                      Objetivo de Negocio Principal
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.values(BusinessGoal).map((goal) => (
                          <button
                            key={goal}
                            onClick={() => handleGoalChange(goal)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                                preferences.defaultGoal === goal 
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-400 ring-1 ring-indigo-500' 
                                : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                            }`}
                          >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold">{goal}</span>
                                {preferences.defaultGoal === goal && <div className="h-2 w-2 rounded-full bg-indigo-500"></div>}
                              </div>
                          </button>
                      ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                      Esto determina qué métricas se priorizan en el Dashboard General.
                  </p>
              </div>

              <div className="h-px bg-gray-100 dark:bg-slate-700"></div>

              {/* Platform Visibility */}
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                      <Eye className="h-4 w-4 mr-2" />
                      Plataformas Visibles
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.values(Platform).map((platform) => {
                          const isVisible = preferences.visiblePlatforms[platform] !== false;
                          return (
                              <button 
                                key={platform}
                                onClick={() => togglePlatform(platform)}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                                    isVisible 
                                    ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' 
                                    : 'bg-gray-50 border-gray-200 text-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-500'
                                }`}
                              >
                                  <span className="font-medium">{platform}</span>
                                  {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                              </button>
                          )
                      })}
                  </div>
              </div>
          </div>
      </div>

      {/* Theme Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <Monitor className="h-5 w-5 mr-2 text-indigo-600" />
              Apariencia
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <button 
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${!isDark ? 'border-indigo-600 bg-indigo-50 dark:bg-slate-700' : 'border-gray-200 dark:border-slate-600 hover:border-gray-300'}`}
              >
                  <Sun className={`h-8 w-8 mb-2 ${!isDark ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${!isDark ? 'text-indigo-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Claro</span>
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${isDark ? 'border-indigo-600 bg-indigo-50 dark:bg-slate-700' : 'border-gray-200 dark:border-slate-600 hover:border-gray-300'}`}
              >
                  <Moon className={`h-8 w-8 mb-2 ${isDark ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${isDark ? 'text-indigo-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Oscuro</span>
              </button>
          </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <Bell className="h-5 w-5 mr-2 text-indigo-600" />
              Notificaciones
          </h3>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-700">
              <div>
                  <p className="font-medium text-gray-900 dark:text-gray-200">Alertas de Sincronización</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Recibe avisos si una API se desconecta.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={notificationsEnabled} onChange={e => setNotificationsEnabled(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
          </div>
          <div className="flex items-center justify-between py-3">
              <div>
                  <p className="font-medium text-gray-900 dark:text-gray-200">Reportes Semanales</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Resumen de rendimiento por email.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
          </div>
      </div>

       {/* Share links */}
       <ShareLinks />

       {/* Language Section */}
       <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <Globe className="h-5 w-5 mr-2 text-indigo-600" />
              Idioma y Región
          </h3>
          <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Idioma de la Plataforma</label>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="pt">Português</option>
              </select>
          </div>
       </div>
    </div>
  );
};