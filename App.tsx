import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Reports } from './components/Reports';
import { Ads } from './components/Ads';
import { AIInsights } from './components/AIInsights';
import { HelpCenter } from './components/HelpCenter';
import { Connections } from './components/Connections';
import { CustomBuilder } from './components/CustomBuilder';
import { Settings } from './components/Settings';
import { Profile } from './components/Profile';
import { Notifications } from './components/Notifications';
import { SupportChat } from './components/SupportChat';
import { Bell, RefreshCw, Database, FlaskConical, Menu } from 'lucide-react';
import { DataProvider, useData } from './context/DataContext';
import { Login } from './components/Login';
import { SharedView } from './components/SharedView';
import { Api, UnauthorizedError } from './services/apiClient';

const AppContent: React.FC = () => {
  // Coming back from "Conectar con Google / Meta" lands on Conexiones to pick the account
  const [currentPage, setCurrentPage] = useState(() =>
    new URLSearchParams(window.location.search).has('oauth_target') ? 'connections' : 'dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [focusWidgetId, setFocusWidgetId] = useState<string | null>(null);

  const navigate = (page: string) => {
    setFocusWidgetId(null);
    setCurrentPage(page);
    window.scrollTo({ top: 0 });
  };
  
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
      if (theme === 'dark') {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  }, [theme]);

  // Use Global Data Context
  const { lastSync, isLoading, triggerSync, integrityReport, preferences } = useData();

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={navigate} focusWidgetId={focusWidgetId} />;
      case 'reports':
        return <Reports />;
      case 'ads':
        return <Ads onNavigate={navigate} />;
      case 'insights':
        return <AIInsights />;
      case 'connections':
        return <Connections />;
      case 'builder':
        return <CustomBuilder onSaved={(id) => { setCurrentPage('dashboard'); setFocusWidgetId(id); }} />;
      case 'help':
        return <HelpCenter />;
      case 'settings':
        return <Settings isDark={theme === 'dark'} setTheme={setTheme} />;
      case 'profile':
        return <Profile />;
      case 'notifications':
        return <Notifications />;
      default:
        return <Dashboard onNavigate={navigate} focusWidgetId={focusWidgetId} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F4F3EE] dark:bg-slate-900 transition-colors duration-300">
      {/* Sidebar Navigation */}
      <Sidebar activePage={currentPage} setPage={navigate} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        
        {/* Top Header */}
        <header className="bg-white dark:bg-slate-800 h-16 border-b border-[#E3E1D8] dark:border-slate-700 flex items-center justify-between gap-3 px-4 sm:px-8 sticky top-0 z-20 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
             <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menú" className="lg:hidden p-2 -ml-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700">
                <Menu className="h-5 w-5" />
             </button>
             <span className="text-gray-400 dark:text-gray-500 font-medium capitalize truncate">
                {currentPage === 'reports' ? 'Plataformas' : currentPage === 'ads' ? 'Anuncios' : currentPage === 'builder' ? 'Constructor' : currentPage}
             </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            
            {/* DEMO MODE BADGE */}
            {preferences.isDemoMode && (
                <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold flex items-center whitespace-nowrap border border-amber-200 dark:border-amber-800 animate-pulse">
                    <FlaskConical className="h-3 w-3 mr-1.5" />
                    <span className="sm:hidden">DEMO</span>
                    <span className="hidden sm:inline">MODO DEMO ACTIVO</span>
                </div>
            )}

            {/* Real-time Sync Indicator */}
            <div className="flex items-center space-x-4 sm:mr-4">
                <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Última Sincronización</p>
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-300">
                        {lastSync.toLocaleTimeString()}
                    </p>
                </div>
                <button 
                    onClick={() => triggerSync()}
                    disabled={isLoading}
                    className={`p-2 rounded-full border transition-all ${isLoading ? 'bg-indigo-50 dark:bg-indigo-900/50 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-gray-400'}`}
                    title="Forzar Actualización de Datos"
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Integrity Badge */}
            <div className={`hidden md:flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium border ${
                integrityReport.status === 'Healthy' 
                ? 'border-green-200 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' 
                : integrityReport.status === 'Warning' && integrityReport.checks.every(c => !c.startsWith('❌'))
                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                : 'border-red-200 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
            }`} title={integrityReport.checks.join('\n')}>
                <Database className="h-3 w-3 mr-1" />
                <span>{integrityReport.status === 'Healthy' ? 'Data Íntegra'
                    : integrityReport.checks.every(c => !c.startsWith('❌')) ? 'Datos guardados' : 'Error Data'}</span>
            </div>

            <div className="hidden md:block h-8 w-1 bg-gray-200 dark:bg-slate-700 rounded-full mx-2"></div>

            <button 
                onClick={() => setCurrentPage('notifications')}
                className="relative text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full border border-white dark:border-slate-800"></span>
            </button>
            
            <button 
                onClick={() => setCurrentPage('profile')}
                className="h-8 w-8 shrink-0 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold cursor-pointer hover:ring-2 ring-indigo-500 transition-all"
            >
              JD
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto relative bg-[#F4F3EE] dark:bg-slate-900">
          {isLoading && (
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-100 dark:bg-slate-800 overflow-hidden z-20">
                  <div className="h-full bg-indigo-600 animate-pulse w-1/3 mx-auto rounded-full"></div>
              </div>
          )}
          {renderPage()}
        </main>

      </div>
      
      {/* Floating AI Support Chat */}
      <SupportChat />
      
    </div>
  );
};

const PrivateApp: React.FC = () => {
    const [auth, setAuth] = useState<'checking' | 'in' | 'out'>('checking');
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        Api.me()
            .then(() => setAuth('in'))
            .catch((e) => {
                if (!(e instanceof UnauthorizedError)) setAuthError(e.message);
                setAuth('out');
            });
    }, []);

    if (auth === 'checking') return <div className="min-h-[100dvh] bg-[#F4F3EE] dark:bg-slate-900" />;
    if (auth === 'out') return <Login initialError={authError} onSuccess={() => { setAuthError(''); setAuth('in'); }} />;

    return (
        <DataProvider onUnauthorized={() => setAuth('out')}>
            <AppContent />
        </DataProvider>
    )
}

// Enlace compartido (/ver/<token>): vista de solo lectura, sin contraseña ni menú
const SHARE_PATH = /^\/ver\/([A-Za-z0-9_-]{20,64})\/?$/;

const App: React.FC = () => {
    const match = window.location.pathname.match(SHARE_PATH);
    if (match) {
        return (
            <DataProvider shareToken={match[1]} onUnauthorized={() => {}}>
                <SharedView />
            </DataProvider>
        );
    }
    return <PrivateApp />;
};

export default App;