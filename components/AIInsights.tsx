import React, { useState } from 'react';
import { Sparkles, ArrowRight, Zap, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { generateMarketingInsights } from '../services/geminiService';
import { useData } from '../context/DataContext';
import { AIAnalysisResult } from '../types';

export const AIInsights: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const { data, blendedMetrics } = useData();

  const handleAnalyze = async () => {
    setLoading(true);
    
    // Analyze whatever is loaded (demo or connected platforms) for the selected date range
    const context = {
        resumen: blendedMetrics,
        metaAds: data.meta.campaigns,
        googleAds: data.google.campaigns,
        linkedinAds: data.linkedin.campaigns,
        tiktokAds: data.tiktok.campaigns,
        ga4: { sessions: data.ga4.sessions, revenue: data.ga4.revenue, users: data.ga4.users, conversionRate: data.ga4.conversionRate },
        crmPipeline: data.kommo.pipelines,
        crmAgentes: data.kommo.agents,
    };

    try {
        const analysis = await generateMarketingInsights(context, "Maximizar ROAS y Conversión");
        setResult(analysis);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-full mb-4">
            <Sparkles className="h-8 w-8 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Optimización Inteligente con Gemini</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Utiliza la potencia de Google Gemini para analizar tus campañas de Meta, Google y datos de CRM en segundos.
          Detecta fugas de presupuesto y oportunidades de escala.
        </p>
        
        {!result && !loading && (
            <button 
                onClick={handleAnalyze}
                className="mt-6 px-8 py-4 bg-indigo-600 text-white rounded-full font-bold text-lg hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center mx-auto"
            >
                <Zap className="mr-2 h-5 w-5" />
                Ejecutar Análisis Completo
            </button>
        )}

        {loading && (
            <div className="flex flex-col items-center justify-center mt-8 space-y-4">
                <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                <p className="text-gray-500 font-medium">Analizando millones de puntos de datos...</p>
            </div>
        )}
      </div>

      {result && (
        <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white p-6 rounded-xl border-l-4 border-indigo-500 shadow-md">
                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center">
                    <BrainIcon className="h-5 w-5 mr-2 text-indigo-600" />
                    Diagnóstico General
                </h3>
                <p className="text-gray-700 leading-relaxed">{result.rawAnalysis}</p>
                <div className="mt-4 flex items-center">
                    <span className="text-sm font-medium text-gray-500 mr-2">Prioridad de Acción:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        result.priority === 'Alta' ? 'bg-red-100 text-red-700' : 
                        result.priority === 'Media' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-green-100 text-green-800'
                    }`}>
                        {result.priority}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Trends */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <TrendingUp className="h-5 w-5 mr-2 text-blue-500" />
                        Tendencias Detectadas
                    </h3>
                    <ul className="space-y-3">
                        {result.trends.map((trend, i) => (
                            <li key={i} className="flex items-start">
                                <div className="h-2 w-2 mt-2 rounded-full bg-blue-400 mr-3"></div>
                                <span className="text-gray-600 text-sm">{trend}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Optimizations */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <Zap className="h-5 w-5 mr-2 text-amber-500" />
                        Sugerencias de Optimización
                    </h3>
                    <ul className="space-y-3">
                        {result.optimizations.map((opt, i) => (
                            <li key={i} className="flex items-start bg-amber-50 p-3 rounded-lg border border-amber-100">
                                <ArrowRight className="h-4 w-4 mt-1 text-amber-600 mr-3 flex-shrink-0" />
                                <span className="text-gray-800 text-sm font-medium">{opt}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="flex justify-center pt-6">
                <button 
                    onClick={() => { setResult(null); }}
                    className="text-gray-500 hover:text-indigo-600 text-sm font-medium underline"
                >
                    Reiniciar Análisis
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

// Simple internal icon component for this file
const BrainIcon = ({className}: {className?: string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.97-1.364"/><path d="M17.97 16.636A4 4 0 0 1 16 18"/></svg>
);