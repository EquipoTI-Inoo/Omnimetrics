import React, { useEffect, useState } from 'react';
import {
    AlertCircle, BarChart2, CheckCircle, Clock, Database, ExternalLink, Facebook,
    Linkedin, LogIn, Search, ShieldCheck, Video,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { Api, ConnectionStatus, OAuthAccount } from '../services/apiClient';

interface Field { key: string; label: string; secret?: boolean; optional?: boolean }
interface PlatformDef {
    id: string;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    help: { url: string; text: string };
    fields: Field[];
}

// Campos compartidos por Google Ads / GA4 cuando se conectan a mano
const OAUTH_FIELDS: Field[] = [
    { key: 'clientId', label: 'Client ID' },
    { key: 'clientSecret', label: 'Client Secret', secret: true },
    { key: 'refreshToken', label: 'Refresh Token', secret: true },
];

const PLATFORMS: PlatformDef[] = [
    {
        id: 'meta', name: 'Meta Ads', icon: Facebook,
        description: 'Campañas, anuncios, demografía y regiones.',
        help: { url: 'https://business.facebook.com/settings/system-users', text: 'Crear token de System User (Business Manager › Usuarios del sistema)' },
        fields: [],
    },
    {
        id: 'google', name: 'Google Ads', icon: Search,
        description: 'Campañas de Búsqueda/Display y palabras clave.',
        help: { url: 'https://developers.google.com/google-ads/api/docs/get-started/introduction', text: 'Guía: Developer Token + credenciales OAuth' },
        fields: [
            ...OAUTH_FIELDS,
            { key: 'developerToken', label: 'Developer Token', secret: true },
            { key: 'customerId', label: 'Customer ID (123-456-7890)' },
            { key: 'loginCustomerId', label: 'Manager (MCC) ID — opcional', optional: true },
        ],
    },
    {
        id: 'ga4', name: 'Google Analytics 4', icon: BarChart2,
        description: 'Sesiones, ingresos, fuentes y ciudades.',
        help: { url: 'https://developers.google.com/oauthplayground', text: 'Obtener Refresh Token (OAuth Playground, scope analytics.readonly)' },
        fields: [...OAUTH_FIELDS, { key: 'propertyId', label: 'Property ID (Admin › Detalles de la propiedad)' }],
    },
    {
        id: 'linkedin', name: 'LinkedIn Ads', icon: Linkedin,
        description: 'Campañas B2B y generación de leads.',
        help: { url: 'https://www.linkedin.com/developers/tools/oauth/token-generator', text: 'Generar token (scope r_ads_reporting, r_ads)' },
        fields: [
            { key: 'token', label: 'Access Token', secret: true },
            { key: 'accountId', label: 'Ad Account ID' },
        ],
    },
    {
        id: 'tiktok', name: 'TikTok Ads', icon: Video,
        description: 'Campañas de video.',
        help: { url: 'https://business-api.tiktok.com/portal/apps', text: 'Portal TikTok for Business Developers' },
        fields: [
            { key: 'token', label: 'Access Token', secret: true },
            { key: 'advertiserId', label: 'Advertiser ID' },
        ],
    },
    {
        id: 'kommo', name: 'Kommo CRM', icon: Database,
        description: 'Pipeline, agentes y motivos de pérdida.',
        help: { url: 'https://www.kommo.com/developers/content/oauth/step-by-step/', text: 'Ajustes › Centro de integraciones › Crear integración › Llaves y alcances › Generar token de larga duración' },
        fields: [
            { key: 'subdomain', label: 'Subdominio (ej: miempresa, de miempresa.kommo.com)' },
            { key: 'token', label: 'Token de larga duración', secret: true },
        ],
    },
];

const OAUTH_TARGETS = ['google', 'ga4', 'meta'];

const inputCls = 'w-full border border-gray-300 dark:border-slate-600 p-2 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-slate-700';
const btnCls = 'w-full bg-indigo-600 text-white p-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition disabled:opacity-50';

type Msg = { id: string; type: 'success' | 'error'; msg: string };
type MetaStep = 'token' | 'portfolios' | 'accounts';
interface Picker { target: string; grant: string; identity?: string; accounts: OAuthAccount[] }

const HelpLink: React.FC<{ url: string; text: string }> = ({ url, text }) => (
    <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center p-3 mb-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors border border-indigo-100 dark:border-indigo-800">
        <ExternalLink className="h-3 w-3 mr-2 flex-shrink-0" />{text}
    </a>
);

export const Connections: React.FC = () => {
    const { triggerSync } = useData();
    const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({});
    const [loadError, setLoadError] = useState('');
    const [open, setOpen] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<Msg | null>(null);
    const [form, setForm] = useState<Record<string, string>>({});

    // Asistente de Meta con token manual
    const [metaStep, setMetaStep] = useState<MetaStep>('token');
    const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
    const [business, setBusiness] = useState<{ id: string; name: string } | null>(null);
    const [adAccounts, setAdAccounts] = useState<{ id: string; account_id: string; name: string; currency: string }[]>([]);
    const [adAccount, setAdAccount] = useState<string | null>(null);

    // "Conectar con un clic"
    const [providers, setProviders] = useState<Record<string, boolean>>({});
    const [manual, setManual] = useState(false);
    const [picker, setPicker] = useState<Picker | null>(null);
    const [picked, setPicked] = useState<OAuthAccount | null>(null);

    const load = async () => {
        try {
            const list = await Api.listConnections();
            setConnections(Object.fromEntries(list.map(c => [c.platform, c])));
            setLoadError('');
        } catch (e: any) {
            setLoadError(e.message);
        }
    };

    const run = async (id: string, fn: () => Promise<void>) => {
        setBusy(true);
        setMessage(null);
        try { await fn(); } catch (e: any) { setMessage({ id, type: 'error', msg: e.message }); } finally { setBusy(false); }
    };

    // Al montar: estado de conexiones + retorno del login OAuth (?oauth_target=…&oauth_grant=… | &oauth_error=…)
    useEffect(() => {
        load();
        Api.oauthProviders().then(setProviders).catch(() => setProviders({}));
        const params = new URLSearchParams(window.location.search);
        const target = params.get('oauth_target');
        if (!target) return;
        window.history.replaceState(null, '', window.location.pathname);
        setOpen(target);
        const error = params.get('oauth_error');
        const grant = params.get('oauth_grant');
        if (error) setMessage({ id: target, type: 'error', msg: error });
        if (grant) {
            run(target, async () => {
                const res = await Api.oauthAccounts(grant);
                setPicker({ target, grant, identity: res.identity, accounts: res.accounts });
                if (res.accounts.length === 1) setPicked(res.accounts[0]);
            });
        }
    }, []);

    const connectPicked = (id: string) => run(id, async () => {
        if (!picker || !picked) return;
        const res = await Api.oauthConnect(picker.grant, picked);
        setPicker(null);
        setPicked(null);
        setMessage({ id, type: 'success', msg: `Conectado a ${res.info.account || picked.name}.` });
        await load();
        triggerSync();
    });

    const connectManual = (id: string, fields: Record<string, string>) => run(id, async () => {
        const res = await Api.connect(id, fields);
        setMessage({ id, type: 'success', msg: `Conectado${res.info.account ? ` a ${res.info.account}` : ''}.` });
        setForm({});
        await load();
        triggerSync();
    });

    const disconnect = (id: string) => run(id, async () => {
        await Api.disconnect(id);
        setMetaStep('token');
        await load();
        triggerSync();
    });

    const verifyMetaToken = () => run('meta', async () => {
        if (!form.token) throw new Error('Ingresa tu token de acceso.');
        setBusinesses(await Api.metaBusinesses(form.token));
        setMetaStep('portfolios');
    });

    const pickBusiness = (b: { id: string; name: string } | null) => run('meta', async () => {
        setBusiness(b);
        setAdAccount(null);
        setAdAccounts(await Api.metaAdAccounts(form.token, b?.id));
        setMetaStep('accounts');
    });

    const toggle = (id: string) => {
        setOpen(open === id ? null : id);
        setMessage(null);
        setForm({});
        setMetaStep('token');
        setManual(false);
    };

    const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

    const renderPicker = (p: PlatformDef) => {
        const pk = picker!;
        const groups = [...new Set(pk.accounts.map(a => a.group || ''))];
        return (
            <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Sesión iniciada{pk.identity && <> como <span className="font-semibold text-gray-700 dark:text-gray-200">{pk.identity}</span></>}.
                    {' '}Elige {p.id === 'ga4' ? 'la propiedad' : 'la cuenta'}:
                </p>
                {pk.accounts.length === 0 ? (
                    <p className="text-xs text-red-600">
                        {p.id === 'ga4' ? 'Esta cuenta de Google no tiene propiedades de GA4.' : 'No se encontraron cuentas publicitarias con acceso para este usuario.'}
                    </p>
                ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {groups.map(g => (
                            <div key={g} className="space-y-1.5">
                                {g && <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{g}</p>}
                                {pk.accounts.filter(a => (a.group || '') === g).map(a => (
                                    <button key={`${a.loginCustomerId || ''}/${a.id}`} onClick={() => setPicked(a)}
                                        className={`${inputCls} text-left flex justify-between gap-2 ${picked?.id === a.id && picked?.loginCustomerId === a.loginCustomerId ? 'ring-2 ring-indigo-500 border-transparent' : 'hover:bg-gray-50 dark:hover:bg-slate-600'}`}>
                                        <span className="truncate">{a.name}</span>
                                        <span className="text-gray-400 text-xs shrink-0">{a.id}{a.currency ? ` · ${a.currency}` : ''}</span>
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex gap-2">
                    <button onClick={() => { setPicker(null); setPicked(null); }}
                        className="px-3 border border-gray-300 dark:border-slate-600 rounded-lg text-sm dark:text-gray-200">Cancelar</button>
                    <button onClick={() => connectPicked(p.id)} disabled={!picked || busy} className={btnCls}>
                        {busy ? 'Conectando…' : 'Conectar'}
                    </button>
                </div>
            </div>
        );
    };

    const renderManual = (p: PlatformDef) => {
        if (p.id === 'meta') {
            return (
                <>
                    {metaStep === 'token' && (
                        <>
                            <input type="password" value={form.token || ''} onChange={e => setField('token', e.target.value)} placeholder="Access Token" className={inputCls} />
                            <button onClick={verifyMetaToken} disabled={busy} className={btnCls}>{busy ? 'Verificando…' : 'Verificar token'}</button>
                        </>
                    )}
                    {metaStep === 'portfolios' && (
                        <>
                            <p className="text-xs font-bold text-gray-500">Selecciona el negocio:</p>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                <button onClick={() => pickBusiness(null)} className={`${inputCls} text-left hover:bg-gray-50`}>Mis cuentas (sin negocio)</button>
                                {businesses.map(b => (
                                    <button key={b.id} onClick={() => pickBusiness(b)} className={`${inputCls} text-left hover:bg-gray-50`}>{b.name}</button>
                                ))}
                            </div>
                        </>
                    )}
                    {metaStep === 'accounts' && (
                        <>
                            <p className="text-xs font-bold text-gray-500">Selecciona la cuenta publicitaria:</p>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {adAccounts.length === 0 && <p className="text-xs text-gray-500">No se encontraron cuentas con este token.</p>}
                                {adAccounts.map(a => (
                                    <button key={a.id} onClick={() => setAdAccount(a.id)}
                                        className={`${inputCls} text-left ${adAccount === a.id ? 'ring-2 ring-indigo-500 border-transparent' : ''}`}>
                                        {a.name} <span className="text-gray-400 text-xs">· {a.currency}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setMetaStep('portfolios')} className="px-3 border border-gray-300 rounded-lg text-sm">Atrás</button>
                                <button disabled={!adAccount || busy} className={btnCls}
                                    onClick={() => connectManual('meta', { token: form.token, adAccountId: adAccount!, businessName: business?.name || '' })}>
                                    {busy ? 'Conectando…' : 'Conectar'}
                                </button>
                            </div>
                        </>
                    )}
                </>
            );
        }
        const missing = p.fields.some(f => !f.optional && !form[f.key]?.trim());
        return (
            <form onSubmit={e => { e.preventDefault(); connectManual(p.id, form); }} className="space-y-3">
                {p.fields.map(f => (
                    <input key={f.key} type={f.secret ? 'password' : 'text'} autoComplete="off" value={form[f.key] || ''}
                        onChange={e => setField(f.key, e.target.value)} placeholder={f.label} aria-label={f.label} className={inputCls} />
                ))}
                <button type="submit" disabled={busy || missing} className={btnCls}>{busy ? 'Validando…' : `Conectar ${p.name}`}</button>
            </form>
        );
    };

    const renderConnect = (p: PlatformDef) => {
        if (picker?.target === p.id) return renderPicker(p);
        if (!OAUTH_TARGETS.includes(p.id)) return <><HelpLink {...p.help} />{renderManual(p)}</>;

        const label = p.id === 'meta' ? 'Meta' : 'Google';
        const ready = providers[p.id];
        return (
            <>
                {ready ? (
                    <a href={Api.oauthStartUrl(p.id)}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white p-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition">
                        <LogIn className="h-4 w-4" /> Iniciar sesión con {label}
                    </a>
                ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg p-3">
                        Para conectar con un clic, configura {p.id === 'meta'
                            ? 'META_APP_ID y META_APP_SECRET'
                            : `GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET${p.id === 'google' ? ' (y GOOGLE_ADS_DEVELOPER_TOKEN)' : ''}`} en .env.local (ver LEEME-LOCAL.md).
                    </p>
                )}
                {ready && !manual ? (
                    <button onClick={() => setManual(true)} className="w-full text-xs text-gray-500 dark:text-gray-400 hover:underline">
                        o conectar pegando un token manualmente
                    </button>
                ) : (
                    <><HelpLink {...p.help} />{renderManual(p)}</>
                )}
            </>
        );
    };

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conexiones API</h1>
                <p className="text-gray-500 dark:text-gray-400">Administra las integraciones con tus fuentes de datos y CRM.</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3" /> Las credenciales se validan y guardan cifradas en el servidor; nunca se almacenan en el navegador.
                </p>
            </div>

            {loadError && <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">{loadError}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {PLATFORMS.map(p => {
                    const conn = connections[p.id];
                    const isOpen = open === p.id;
                    const Icon = p.icon;
                    const expiresAt = conn?.info.expiresAt;
                    return (
                        <div key={p.id} className={`flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-sm border transition-all duration-300 ${isOpen ? 'ring-2 ring-indigo-500 border-transparent shadow-md' : 'border-gray-200 dark:border-slate-700 hover:shadow-md'}`}>
                            <div className="p-5 sm:p-6 pb-4">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-700"><Icon className="h-8 w-8 text-gray-700 dark:text-gray-200" /></div>
                                    <div className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${conn ? (conn.lastError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700') : 'bg-gray-100 text-gray-500'}`}>
                                        {conn ? (conn.lastError ? 'Error' : 'Activo') : 'Inactivo'}
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{p.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {conn?.info.account
                                        ? <>Cuenta: <span className="font-medium text-gray-700 dark:text-gray-200">{conn.info.account}</span></>
                                        : p.description}
                                </p>
                            </div>

                            {isOpen ? (
                                <div className="p-5 sm:p-6 pt-0 animate-in fade-in slide-in-from-top-4 flex-1">
                                    <div className="h-px bg-gray-100 dark:bg-slate-700 mb-4" />
                                    {conn ? (
                                        <div className="text-center py-2">
                                            {conn.lastError
                                                ? <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                                                : <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />}
                                            <p className="text-gray-900 dark:text-white font-bold mb-1">
                                                {conn.lastError ? 'Error en la última sincronización' : 'Sincronización activa'}
                                            </p>
                                            {conn.lastError && <p className="text-xs text-red-600 mb-2 break-words">{conn.lastError}</p>}
                                            <p className="text-xs text-gray-500 mb-1">ID: {conn.info.accountId || '—'}{conn.info.business ? ` · ${conn.info.business}` : ''}</p>
                                            {conn.info.identity && <p className="text-xs text-gray-500 mb-1">Conectado como {conn.info.identity}</p>}
                                            {expiresAt && (
                                                <p className={`text-xs mb-1 flex items-center justify-center gap-1 ${new Date(expiresAt).getTime() - Date.now() < 7 * 864e5 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                    <Clock className="h-3 w-3" /> El acceso vence el {new Date(expiresAt).toLocaleDateString()} — vuelve a conectar antes
                                                </p>
                                            )}
                                            <p className="text-xs text-gray-500 mb-4">
                                                Última sincronización: {conn.lastSync ? new Date(conn.lastSync).toLocaleString() : 'pendiente'}
                                            </p>
                                            <button onClick={() => disconnect(p.id)} disabled={busy} className="text-red-600 text-sm font-medium hover:underline">Desconectar</button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">{renderConnect(p)}</div>
                                    )}
                                    {message && message.id === p.id && (
                                        <div className={`mt-3 p-2 text-xs rounded border break-words ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                            {message.msg}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 pt-0 mt-auto">
                                    <button onClick={() => toggle(p.id)}
                                        className="w-full py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                                        {conn ? 'Administrar conexión' : 'Conectar'}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
