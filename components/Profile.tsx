import React from 'react';
import { User, Mail, Shield, Key } from 'lucide-react';

export const Profile: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mi Perfil</h1>
            <p className="text-gray-500 dark:text-gray-400">Gestiona tu información personal y de seguridad.</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
            <div className="px-6 pb-6">
                <div className="relative flex justify-between items-end -mt-12 mb-6">
                    <div className="h-24 w-24 rounded-full border-4 border-white dark:border-slate-800 bg-indigo-100 flex items-center justify-center text-indigo-700 text-3xl font-bold shadow-md">
                        JD
                    </div>
                    <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm">
                        Guardar Cambios
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre Completo</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input type="text" defaultValue="John Doe" className="pl-9 w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-700" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo Electrónico</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input type="email" defaultValue="admin@omnimetrics.ai" className="pl-9 w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-700" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
                        <div className="relative">
                            <Shield className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input type="text" defaultValue="Administrador" disabled className="pl-9 w-full border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-50 dark:bg-slate-800 dark:text-gray-400" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
                        <button className="flex items-center text-sm text-indigo-600 font-medium hover:underline mt-2">
                            <Key className="h-4 w-4 mr-2" />
                            Cambiar Contraseña
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};