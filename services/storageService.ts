import { AppPreferences, BusinessGoal, Platform, CustomWidget } from "../types";

// Browser storage for UI preferences and custom widgets only.
// API credentials live encrypted on the backend (server/).
const LEGACY_CONNECTIONS_KEY = 'omni_metrics_connections_v1';
const PREFS_KEY = 'omni_metrics_preferences_v1';
const WIDGETS_KEY = 'omni_metrics_custom_widgets_v1';

// Remove plaintext tokens saved by earlier versions
try { localStorage.removeItem(LEGACY_CONNECTIONS_KEY); } catch { /* storage unavailable */ }

export const StorageService = {
    // --- PREFERENCES ---
    getPreferences: (): AppPreferences => {
        const stored = localStorage.getItem(PREFS_KEY);
        if (stored) return JSON.parse(stored);
        
        // Default Preferences
        return {
            defaultGoal: BusinessGoal.Ecommerce,
            visiblePlatforms: Object.values(Platform).reduce((acc, p) => ({...acc, [p]: true}), {}),
            isDemoMode: true // Demo por defecto para la primera prueba local (cámbialo en Ajustes)
        };
    },

    savePreferences: (prefs: AppPreferences) => {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    },

    // --- CUSTOM WIDGETS ---
    getCustomWidgets: (): CustomWidget[] => {
        const stored = localStorage.getItem(WIDGETS_KEY);
        return stored ? JSON.parse(stored) : [];
    },

    saveCustomWidgets: (widgets: CustomWidget[]) => {
        localStorage.setItem(WIDGETS_KEY, JSON.stringify(widgets));
    }
};