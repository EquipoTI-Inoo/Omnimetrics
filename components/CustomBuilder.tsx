import React, { useState } from 'react';
import { Layout, Save, Plus, BarChart, PieChart, Table, CheckSquare, Maximize2 } from 'lucide-react';
import { Platform, WidgetConfig, ChartType } from '../types';
import { useData } from '../context/DataContext';
import { SCHEMA, WidgetEngine } from '../services/widgetEngine';
import { 
    BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    LineChart, Line, PieChart as RePieChart, Pie, Cell, CartesianGrid
} from 'recharts';

export const CustomBuilder: React.FC<{ onSaved: (widgetId: string) => void }> = ({ onSaved }) => {
  const { addWidget, data } = useData();

  // Builder State
  const [title, setTitle] = useState('Nuevo Gráfico');
  const [platform, setPlatform] = useState<Platform>(Platform.Meta);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

  // Helpers
  const currentSchema = SCHEMA[platform] || { dimensions: [], metrics: [] };
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const toggleDimension = (id: string) => {
      // Single dimension for now to keep charts simple, multiple for table
      if (chartType !== 'table') {
          setSelectedDimensions([id]);
      } else {
          if (selectedDimensions.includes(id)) setSelectedDimensions(prev => prev.filter(x => x !== id));
          else setSelectedDimensions(prev => [...prev, id]);
      }
  };

  const toggleMetric = (id: string) => {
      if (selectedMetrics.includes(id)) setSelectedMetrics(prev => prev.filter(x => x !== id));
      else setSelectedMetrics(prev => [...prev, id]);
  };

  // Preview Data Generator
  const previewConfig: WidgetConfig = {
      id: 'preview',
      title,
      dataSource: platform,
      chartType,
      dimensions: selectedDimensions,
      metrics: selectedMetrics,
      pinnedToDashboard: false
  };
  
  const chartData = WidgetEngine.processData(previewConfig, data);

  const handleSave = () => {
      if (selectedDimensions.length === 0 || selectedMetrics.length === 0) {
          alert("Debes seleccionar al menos 1 dimensión y 1 métrica.");
          return;
      }
      const newWidget: WidgetConfig = {
          ...previewConfig,
          id: Date.now().toString(),
          pinnedToDashboard: true
      };
      addWidget(newWidget);
      onSaved(newWidget.id);
  };

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-100px)] rounded-xl lg:rounded-none overflow-hidden border border-gray-200 dark:border-slate-700 lg:border-0 animate-in fade-in">
        
        {/* LEFT PANE: CONFIG */}
        <div className="w-full lg:w-80 lg:shrink-0 bg-white dark:bg-slate-800 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-slate-700 flex flex-col lg:overflow-y-auto">
            <div className="p-4 border-b dark:border-slate-700">
                <h2 className="font-bold text-gray-900 dark:text-white mb-4">1. Fuente de Datos</h2>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Plataforma</label>
                        <select 
                            value={platform} 
                            onChange={e => { setPlatform(e.target.value as Platform); setSelectedDimensions([]); setSelectedMetrics([]); }}
                            className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm"
                        >
                            {Object.values(Platform).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Gráfico</label>
                        <div className="grid grid-cols-4 gap-2">
                            {['table', 'bar', 'line', 'pie'].map((type) => (
                                <button 
                                    key={type}
                                    onClick={() => setChartType(type as ChartType)}
                                    className={`p-2 rounded border flex justify-center items-center ${chartType === type ? 'bg-indigo-100 border-indigo-500 text-indigo-600' : 'hover:bg-gray-50 dark:hover:bg-slate-700 dark:border-slate-600'}`}
                                >
                                    {type === 'table' && <Table className="h-5 w-5" />}
                                    {type === 'bar' && <BarChart className="h-5 w-5" />}
                                    {type === 'line' && <span className="font-bold text-xs">Line</span>}
                                    {type === 'pie' && <PieChart className="h-5 w-5" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 flex-1">
                <h2 className="font-bold text-gray-900 dark:text-white mb-4">2. Campos</h2>
                
                {/* Dimensions */}
                <div className="mb-5 lg:mb-6">
                    <h3 className="text-xs font-bold text-green-600 uppercase mb-2 flex items-center"><Layout className="h-3 w-3 mr-1"/> Dimensiones (Eje X)</h3>
                    <div className="flex flex-wrap gap-2 lg:block lg:space-y-1">
                        {currentSchema.dimensions.map(d => (
                            <button 
                                key={d.id}
                                onClick={() => toggleDimension(d.id)}
                                className={`lg:w-full text-left px-3 py-1.5 lg:py-2 rounded-full lg:rounded text-sm flex items-center gap-2 lg:justify-between group border ${selectedDimensions.includes(d.id) ? 'bg-green-50 text-green-700 font-bold border-green-200' : 'border-gray-200 dark:border-slate-600 lg:border-transparent hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'}`}
                            >
                                {d.label}
                                {selectedDimensions.includes(d.id) && <CheckSquare className="h-3 w-3" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Metrics */}
                <div>
                    <h3 className="text-xs font-bold text-blue-600 uppercase mb-2 flex items-center"><Maximize2 className="h-3 w-3 mr-1"/> Métricas (Eje Y)</h3>
                    <div className="flex flex-wrap gap-2 lg:block lg:space-y-1">
                        {currentSchema.metrics.map(m => (
                            <button 
                                key={m.id}
                                onClick={() => toggleMetric(m.id)}
                                className={`lg:w-full text-left px-3 py-1.5 lg:py-2 rounded-full lg:rounded text-sm flex items-center gap-2 lg:justify-between group border ${selectedMetrics.includes(m.id) ? 'bg-blue-50 text-blue-700 font-bold border-blue-200' : 'border-gray-200 dark:border-slate-600 lg:border-transparent hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'}`}
                            >
                                {m.label}
                                {selectedMetrics.includes(m.id) && <CheckSquare className="h-3 w-3" />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* MAIN PANE: PREVIEW */}
        <div className="flex-1 min-w-0 bg-gray-50 dark:bg-slate-900 p-4 sm:p-6 lg:p-8 lg:overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <input 
                        type="text" 
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full sm:w-auto min-w-0 flex-1 text-xl sm:text-2xl font-bold bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-gray-900 dark:text-white"
                    />
                    <button 
                        onClick={handleSave}
                        className="bg-indigo-600 text-white px-6 py-2.5 sm:py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center shrink-0 shadow-lg hover:shadow-indigo-500/30 transition-all"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        Guardar en Dashboard
                    </button>
                </div>

                {/* Canvas */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 min-h-[300px] sm:min-h-[400px] p-4 sm:p-6 flex flex-col">
                    {selectedDimensions.length === 0 || selectedMetrics.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <Layout className="h-16 w-16 mb-4 opacity-20" />
                            <p>Selecciona dimensiones y métricas para visualizar datos.</p>
                        </div>
                    ) : (
                        <div className="flex-1">
                            {chartType === 'table' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b dark:border-slate-700">
                                                {selectedDimensions.map(d => <th key={d} className="text-left p-2 text-gray-500">{WidgetEngine.getLabel(platform, d)}</th>)}
                                                {selectedMetrics.map(m => <th key={m} className="text-right p-2 text-gray-500">{WidgetEngine.getLabel(platform, m)}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {chartData.slice(0, 10).map((row, i) => (
                                                <tr key={i} className="border-b dark:border-slate-800">
                                                    {selectedDimensions.map(d => <td key={d} className="p-2 font-medium text-gray-900 dark:text-white">{row[d]}</td>)}
                                                    {selectedMetrics.map(m => <td key={m} className="p-2 text-right text-gray-600 dark:text-gray-300">{
                                                        typeof row[m] === 'number' ? row[m].toLocaleString() : row[m]
                                                    }</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {(chartType === 'bar' || chartType === 'line') && (
                                <ResponsiveContainer width="100%" height={350}>
                                    {chartType === 'bar' ? (
                                        <ReBarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey={selectedDimensions[0]} tick={{fontSize: 10}} />
                                            <YAxis />
                                            <Tooltip />
                                            {selectedMetrics.map((m, i) => (
                                                <Bar key={m} dataKey={m} name={WidgetEngine.getLabel(platform, m)} fill={COLORS[i % COLORS.length]} />
                                            ))}
                                        </ReBarChart>
                                    ) : (
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey={selectedDimensions[0]} tick={{fontSize: 10}} />
                                            <YAxis />
                                            <Tooltip />
                                            {selectedMetrics.map((m, i) => (
                                                <Line key={m} type="monotone" dataKey={m} name={WidgetEngine.getLabel(platform, m)} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
                                            ))}
                                        </LineChart>
                                    )}
                                </ResponsiveContainer>
                            )}
                            
                            {chartType === 'pie' && (
                                <ResponsiveContainer width="100%" height={350}>
                                    <RePieChart>
                                        <Pie 
                                            data={chartData} 
                                            dataKey={selectedMetrics[0]} 
                                            nameKey={selectedDimensions[0]} 
                                            cx="50%" cy="50%" 
                                            outerRadius={100} 
                                            fill="#8884d8"
                                            label
                                        >
                                            {chartData.map((entry, index) => (
                                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </RePieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>

    </div>
  );
};