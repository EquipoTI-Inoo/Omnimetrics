import React from 'react';
import { Bell, CheckCircle, AlertTriangle, Info, Clock } from 'lucide-react';

export const Notifications: React.FC = () => {
  const notifications = [
      { id: 1, type: 'success', title: 'Sincronización Completada', msg: 'Los datos de Meta Ads se actualizaron correctamente.', time: 'Hace 5 min' },
      { id: 2, type: 'warning', title: 'Token por Expirar', msg: 'La credencial de Google Ads caduca en 2 días.', time: 'Hace 2 horas' },
      { id: 3, type: 'info', title: 'Nuevo Reporte Disponible', msg: 'El análisis de IA semanal está listo para revisión.', time: 'Ayer' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notificaciones</h1>
                <p className="text-gray-500 dark:text-gray-400">Mantente al día con lo que sucede en tu cuenta.</p>
            </div>
            <button className="text-sm text-indigo-600 font-medium hover:underline">Marcar todo como leído</button>
        </div>

        <div className="space-y-4">
            {notifications.map(notif => (
                <div key={notif.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 flex items-start space-x-4">
                    <div className={`p-2 rounded-full flex-shrink-0 ${
                        notif.type === 'success' ? 'bg-green-100 text-green-600' :
                        notif.type === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-blue-100 text-blue-600'
                    }`}>
                        {notif.type === 'success' ? <CheckCircle className="h-5 w-5" /> :
                         notif.type === 'warning' ? <AlertTriangle className="h-5 w-5" /> :
                         <Info className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">{notif.title}</h3>
                            <span className="flex items-center text-xs text-gray-400">
                                <Clock className="h-3 w-3 mr-1" />
                                {notif.time}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{notif.msg}</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};