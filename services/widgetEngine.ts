import { Platform, WidgetConfig, CampaignData, GA4Source, AgentPerformance, AdData } from '../types';

// Define available fields for each platform
export const SCHEMA = {
    [Platform.Meta]: {
        dimensions: [
            { id: 'name', label: 'Nombre Campaña' },
            { id: 'status', label: 'Estado' },
            { id: 'id', label: 'ID Campaña' }
        ],
        metrics: [
            { id: 'spend', label: 'Inversión', format: 'currency' },
            { id: 'impressions', label: 'Impresiones', format: 'number' },
            { id: 'clicks', label: 'Clics', format: 'number' },
            { id: 'conversions', label: 'Conversiones', format: 'number' },
            { id: 'roas', label: 'ROAS', format: 'number' },
            { id: 'ctr', label: 'CTR %', format: 'percent' },
            { id: 'cpa', label: 'CPA', format: 'currency' }
        ]
    },
    [Platform.GoogleAds]: {
        dimensions: [
            { id: 'name', label: 'Nombre Campaña' },
            { id: 'status', label: 'Estado' }
        ],
        metrics: [
            { id: 'spend', label: 'Costo', format: 'currency' },
            { id: 'clicks', label: 'Clics', format: 'number' },
            { id: 'conversions', label: 'Conv.', format: 'number' },
            { id: 'ctr', label: 'CTR', format: 'percent' }
        ]
    },
    [Platform.GA4]: {
        dimensions: [
            { id: 'source', label: 'Fuente' },
            { id: 'medium', label: 'Medio' },
            { id: 'city', label: 'Ciudad' }
        ],
        metrics: [
            { id: 'sessions', label: 'Sesiones', format: 'number' },
            { id: 'users', label: 'Usuarios', format: 'number' },
            { id: 'revenue', label: 'Ingresos', format: 'currency' },
            { id: 'bounceRate', label: 'Rebote', format: 'percent' }
        ]
    },
    [Platform.Kommo]: {
        dimensions: [
            { id: 'name', label: 'Agente' },
            { id: 'id', label: 'ID Agente' }
        ],
        metrics: [
            { id: 'leads', label: 'Leads Totales', format: 'number' },
            { id: 'sales', label: 'Ventas Cerradas', format: 'number' },
            { id: 'totalValue', label: 'Valor Total', format: 'currency' },
            { id: 'conversionRate', label: 'Tasa Cierre', format: 'percent' }
        ]
    },
    [Platform.LinkedIn]: {
         dimensions: [{ id: 'name', label: 'Campaña' }],
         metrics: [{ id: 'spend', label: 'Gasto' }, { id: 'conversions', label: 'Leads' }]
    },
    [Platform.TikTok]: {
         dimensions: [{ id: 'name', label: 'Campaña' }],
         metrics: [{ id: 'spend', label: 'Gasto' }, { id: 'views', label: 'Vistas' }]
    }
};

/**
 * The Brain: Aggregates raw data based on Widget Config
 */
export const WidgetEngine = {
    processData: (config: WidgetConfig, rawData: any): any[] => {
        const sourceData = getRawSourceData(config.dataSource, rawData);
        if (!sourceData || sourceData.length === 0) return [];

        // Simple aggregation: Return raw list if dimensions match
        // In a full BI tool, this would do GroupBy. For now, we map 1:1 or return the list.
        
        // Handling GA4 Sources specifically as they are a different shape
        if (config.dataSource === Platform.GA4) {
             return sourceData.map((row: any) => {
                 const newRow: any = {};
                 // If dimensions include 'source' or 'medium', use them
                 config.dimensions.forEach(d => {
                     newRow[d] = row[d] || row.city || 'Unknown'; // Fallback for city vs source
                 });
                 config.metrics.forEach(m => {
                     newRow[m] = row[m] || 0;
                 });
                 return newRow;
             });
        }

        return sourceData.map((row: any) => {
            const newRow: any = {};
            config.dimensions.forEach(d => newRow[d] = row[d]);
            config.metrics.forEach(m => newRow[m] = row[m]);
            return newRow;
        });
    },

    getLabel: (platform: Platform, fieldId: string) => {
        const schema = SCHEMA[platform];
        if (!schema) return fieldId;
        const field = [...schema.dimensions, ...schema.metrics].find(f => f.id === fieldId);
        return field?.label || fieldId;
    },

    getFormat: (platform: Platform, fieldId: string) => {
        const schema = SCHEMA[platform];
        if (!schema) return 'number';
        const field = [...schema.dimensions, ...schema.metrics].find(f => f.id === fieldId);
        return (field as any)?.format || 'number';
    }
};

// Helper to extract the right array from the huge GlobalData object
const getRawSourceData = (platform: Platform, globalData: any) => {
    switch (platform) {
        case Platform.Meta: return globalData.meta.campaigns;
        case Platform.GoogleAds: return globalData.google.campaigns;
        case Platform.LinkedIn: return globalData.linkedin.campaigns;
        case Platform.TikTok: return globalData.tiktok.campaigns;
        case Platform.Kommo: return globalData.kommo.agents; // Defaulting to Agents for widgets
        case Platform.GA4: 
             // Determine if we need sources or cities based on assumption (could be improved)
             return globalData.ga4.sources.length > 0 ? globalData.ga4.sources : globalData.ga4.cities;
        default: return [];
    }
};