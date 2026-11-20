import React from 'react';
import { AppUser } from '../services/apiClient';
import { AccountCard } from './ChangePassword';

export const Profile: React.FC<{ user: AppUser }> = ({ user }) => (
  <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in">
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mi cuenta</h1>
      <p className="text-gray-500 dark:text-gray-400">Tu usuario y tu contraseña de acceso.</p>
    </div>
    <AccountCard user={user} />
  </div>
);
