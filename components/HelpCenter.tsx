import React from 'react';
import { Book, HelpCircle, Plug, BarChart, Server, Database } from 'lucide-react';

export const HelpCenter: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Centro de Ayuda y Documentación</h1>
        <p className="text-gray-500 mt-2">Guías técnicas para la arquitectura de datos de OmniMetrics AI</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Connection Guide */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center mb-4">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    <Plug className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Fase 1: Extracción (API)</h2>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
                Cómo obtener las credenciales OAuth y Tokens para cada plataforma.
            </p>
            <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start">
                    <span className="font-bold mr-2 text-blue-600">Meta:</span>
                    Crea una App en <em className="bg-gray-100 px-1">developers.facebook.com</em> para obtener App ID y Token de Marketing API.
                </li>
                <li className="flex items-start">
                    <span className="font-bold mr-2 text-green-600">Google:</span>
                    Configura un proyecto en Google Cloud Console, habilita Google Ads API y descarga el JSON de credenciales.
                </li>
            </ul>
        </div>

        {/* Warehouse Guide */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center mb-4">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                    <Server className="h-6 w-6 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Fase 2: Centralización (BigQuery)</h2>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
                OmniMetrics funciona mejor con un Data Warehouse centralizado.
            </p>
            <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start">
                    <span className="font-bold mr-2">•</span>
                    Configuramos el pipeline ETL (Extract, Transform, Load) para volcar la data cruda en tu proyecto de BigQuery.
                </li>
                <li className="flex items-start">
                    <span className="font-bold mr-2">•</span>
                    Esto permite almacenar años de historial sin ralentizar el dashboard, que consulta vistas optimizadas.
                </li>
            </ul>
        </div>
      </div>

      {/* FAQ Accordion */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center">
            <HelpCircle className="h-5 w-5 text-gray-500 mr-2" />
            <h2 className="text-lg font-bold text-gray-900">Preguntas Frecuentes de Arquitectura</h2>
        </div>
        
        <div className="divide-y divide-gray-100">
            <details className="group p-6">
                <summary className="flex justify-between items-center font-medium cursor-pointer list-none">
                    <span className="text-gray-900">¿Por qué necesito un Data Warehouse intermedio?</span>
                    <span className="transition group-open:rotate-180">
                        <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24" className="text-gray-500"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                </summary>
                <p className="text-gray-600 mt-3 text-sm group-open:animate-fadeIn">
                    Conectar el dashboard directamente a las APIs (Meta, Google) es lento y propenso a errores de límite de tasa (Rate Limits). El "Camino Correcto" es descargar los datos a BigQuery primero, limpiarlos y luego visualizarlos. Esto garantiza velocidad y consistencia.
                </p>
            </details>
            <details className="group p-6">
                <summary className="flex justify-between items-center font-medium cursor-pointer list-none">
                    <span className="text-gray-900">¿Cómo funciona la IA sobre BigQuery?</span>
                    <span className="transition group-open:rotate-180">
                        <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24" className="text-gray-500"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                </summary>
                <p className="text-gray-600 mt-3 text-sm group-open:animate-fadeIn">
                    Gemini analiza los esquemas JSON agregados que generamos desde tu Warehouse. Al tener los datos estructurados y limpios en SQL, la IA puede detectar patrones de estacionalidad y correlaciones de costos mucho más precisas.
                </p>
            </details>
            <details className="group p-6">
                <summary className="flex justify-between items-center font-medium cursor-pointer list-none">
                    <span className="text-gray-900">¿Qué pasa si falla la extracción de datos?</span>
                    <span className="transition group-open:rotate-180">
                        <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24" className="text-gray-500"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                </summary>
                <p className="text-gray-600 mt-3 text-sm group-open:animate-fadeIn">
                    El sistema de Pipeline tiene reintentos automáticos (exponential backoff). Si las credenciales caducan, recibirás una alerta en el panel de Conexiones y el dashboard mostrará la última data exitosa disponible en el Warehouse.
                </p>
            </details>
        </div>
      </div>
    </div>
  );
};