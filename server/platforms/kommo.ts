import { ApiError, DateRangeQuery, FetchOptions, RateLimitError, TimeoutError, fetchJson, num } from '../lib/http';
import { bucketOf, bucketsFor, granularity, shortLabel } from '../lib/dates';

// Kommo's built-in terminal statuses, identical in every pipeline
const WON = 142;
const LOST = 143;

const cleanSubdomain = (input: string) =>
    input.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.(kommo|amocrm)\.com$/, '').trim();

// Kommo allows ~7 requests/second per account: never more than 4 at once
const MAX_PARALLEL = 4;
let running = 0;
const queue: (() => void)[] = [];
const slot = async () => {
    if (running >= MAX_PARALLEL) await new Promise<void>(r => queue.push(r));
    running++;
};
const release = () => { running--; queue.shift()?.(); };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** GET to Kommo with a concurrency cap and up to 2 retries on throttling (429) or timeouts. */
const api = async (creds: Record<string, string>, path: string): Promise<any> => {
    for (let attempt = 0; ; attempt++) {
        await slot();
        try {
            return await fetchJson<any>(`https://${creds.subdomain}.${creds.domain}/api/v4/${path}`, {
                headers: { Authorization: `Bearer ${creds.token}` },
            }, 60_000);
        } catch (e: any) {
            const throttled = /^429\b/.test(e.message || '');
            if (attempt < 2 && (throttled || e instanceof TimeoutError)) {
                await sleep(1500 * (attempt + 1));
                continue;
            }
            if (throttled) throw new RateLimitError('Kommo limitó temporalmente las consultas. Se libera sola en unos minutos.');
            if (e instanceof TimeoutError) {
                throw new ApiError('Kommo tardó demasiado en responder. Prueba con un rango de fechas más corto; la app reintentará en la próxima sincronización.', 504);
            }
            throw e;
        } finally {
            release();
        }
    }
};

/** Kommo answers 204 (empty body) when a list has no items; fetchJson turns that into {}. */
const embedded = (res: any, key: string): any[] => res?._embedded?.[key] || [];

export const Kommo = {
    async connect(input: Record<string, string>) {
        const token = input.token?.trim().replace(/^Bearer\s+/i, '');
        const subdomain = cleanSubdomain(input.subdomain || '');
        if (!token || !subdomain) throw new ApiError('Subdominio y Token de larga duración son requeridos.');

        // Legacy accounts still live on amocrm.com; report the kommo.com error if both fail
        let firstError: unknown;
        for (const domain of ['kommo.com', 'amocrm.com']) {
            try {
                const acc = await api({ token, subdomain, domain }, 'account');
                return {
                    credentials: { token, subdomain, domain },
                    info: { account: acc.name || subdomain, accountId: `${subdomain}.${domain}` },
                };
            } catch (e) { firstError ??= e; }
        }
        // Kommo redirects subdomains that don't exist to its homepage (www.kommo.com)
        if (/no JSON\) de www\./.test((firstError as any)?.message || '')) {
            throw new ApiError(`No existe una cuenta de Kommo con el subdominio "${subdomain}". Copia el que aparece en la barra del navegador cuando entras a Kommo (lo que va antes de .kommo.com).`);
        }
        throw firstError;
    },

    /**
     * Speed: pages are requested 3 at a time instead of one by one, loss reasons come from one small
     * list instead of being embedded in every lead, and the "closed" query only asks for won leads.
     * light (previous period, only used for the % badges) skips the closed-deals history altogether.
     */
    async fetch(creds: Record<string, string>, range: DateRangeQuery, opts: FetchOptions = {}) {
        const from = Math.floor(new Date(`${range.start}T00:00:00`).getTime() / 1000);
        const to = Math.floor(new Date(`${range.end}T23:59:59`).getTime() / 1000);

        // Max 20 pages x 250 leads per query, fetched in waves of 3 pages
        const listLeads = async (filter: string) => {
            const out: any[] = [];
            for (let first = 1; first <= 20; first += 3) {
                const pages = [first, first + 1, first + 2].filter(p => p <= 20);
                const batches = await Promise.all(pages.map(page =>
                    api(creds, `leads?limit=250&page=${page}&${filter}`).then(res => embedded(res, 'leads'))));
                for (const b of batches) out.push(...b);
                if (batches.some(b => b.length < 250)) break;
            }
            return out;
        };

        const [usersRes, pipesRes, reasonsRes] = await Promise.all([
            api(creds, 'users?limit=250'),
            api(creds, 'leads/pipelines'),
            api(creds, 'leads/loss_reasons?limit=250').catch(() => ({})),
        ]);
        const users = new Map<number, string>(embedded(usersRes, 'users').map((u: any) => [u.id, u.name]));
        const reasonName = new Map<number, string>(embedded(reasonsRes, 'loss_reasons').map((r: any) => [r.id, r.name]));
        const wonFilter = embedded(pipesRes, 'pipelines')
            .map((p: any, i: number) => `filter[statuses][${i}][pipeline_id]=${p.id}&filter[statuses][${i}][status_id]=${WON}`).join('&');

        // leads: created in the range (pipeline, agents, channels). closed: won in the range (sales over time).
        const [leads, closed] = await Promise.all([
            listLeads(`filter[created_at][from]=${from}&filter[created_at][to]=${to}`),
            opts.light || !wonFilter ? Promise.resolve([] as any[])
                : listLeads(`filter[closed_at][from]=${from}&filter[closed_at][to]=${to}&${wonFilter}`),
        ]);

        const agentsOf = (set: any[]) => {
            const stats = new Map<number, { leads: number; sales: number; value: number }>();
            for (const l of set) {
                const s = stats.get(l.responsible_user_id) || { leads: 0, sales: 0, value: 0 };
                s.leads++;
                if (l.status_id === WON) { s.sales++; s.value += num(l.price); }
                stats.set(l.responsible_user_id, s);
            }
            return [...stats.entries()].map(([uid, s]) => ({
                id: String(uid),
                name: users.get(uid) || `Usuario ${uid}`,
                leads: s.leads,
                sales: s.sales,
                avgResponseTime: '-',
                conversionRate: s.leads > 0 ? +(s.sales / s.leads * 100).toFixed(2) : 0,
                totalValue: s.value,
            })).sort((a, b) => b.totalValue - a.totalValue || b.leads - a.leads);
        };

        const lossReasonsOf = (set: any[]) => {
            const reasons = new Map<string, number>();
            for (const l of set) {
                if (l.status_id !== LOST) continue;
                const name = reasonName.get(l.loss_reason_id) || embedded(l, 'loss_reason')[0]?.name || 'Sin motivo';
                reasons.set(name, (reasons.get(name) || 0) + 1);
            }
            return [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
        };

        // Won deals per agent, bucketed by close date (all agents share the same buckets for the chart)
        const g = granularity(range.start, range.end);
        const buckets = bucketsFor(range.start, range.end);
        const localIso = (unix: number) => {
            const d = new Date(unix * 1000);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const salesHistoryOf = (set: any[]) => {
            const perAgent = new Map<number, Map<string, { sales: number; value: number }>>();
            for (const l of set) {
                if (l.status_id !== WON || !l.closed_at) continue;
                const agent = perAgent.get(l.responsible_user_id) || new Map();
                const key = bucketOf(localIso(l.closed_at), g);
                const b = agent.get(key) || { sales: 0, value: 0 };
                b.sales++;
                b.value += num(l.price);
                agent.set(key, b);
                perAgent.set(l.responsible_user_id, agent);
            }
            return [...perAgent.entries()].map(([uid, byBucket]) => ({
                agentName: users.get(uid) || `Usuario ${uid}`,
                data: buckets.map(b => ({ date: shortLabel(b), sales: byBucket.get(b)?.sales || 0, value: byBucket.get(b)?.value || 0 })),
            }));
        };

        // Each pipeline carries its own stats so the UI can switch between them.
        // Archived pipelines are only listed when they still have leads in the range.
        const pipelines = embedded(pipesRes, 'pipelines')
            .map((p: any) => {
                const own = leads.filter(l => l.pipeline_id === p.id);
                const ownClosed = closed.filter(l => l.pipeline_id === p.id);
                return {
                    id: String(p.id),
                    name: p.name,
                    archived: !!p.is_archive,
                    leadCount: own.length,
                    stages: embedded(p, 'statuses').map((s: any) => {
                        const inStage = own.filter(l => l.status_id === s.id);
                        return {
                            id: String(s.id),
                            name: s.name,
                            count: inStage.length,
                            value: inStage.reduce((sum, l) => sum + num(l.price), 0),
                            color: s.color || '#cccccc',
                        };
                    }),
                    agents: agentsOf(own),
                    lossReasons: lossReasonsOf(own),
                    salesHistory: opts.light ? [] : salesHistoryOf(ownClosed),
                };
            })
            .filter((p: any) => !p.archived || p.leadCount > 0);

        const agents = agentsOf(leads);
        const lossReasons = lossReasonsOf(leads);
        const salesHistory = salesHistoryOf(closed);

        // Channel = UTM source captured by Kommo, else the lead's first tag
        const channelStats = new Map<string, { count: number; won: number }>();
        for (const l of leads) {
            const utm = (l.custom_fields_values || []).find((f: any) => f.field_code === 'UTM_SOURCE')?.values?.[0]?.value;
            const name = utm || embedded(l, 'tags')[0]?.name || 'Sin origen';
            const c = channelStats.get(name) || { count: 0, won: 0 };
            c.count++;
            if (l.status_id === WON) c.won++;
            channelStats.set(name, c);
        }
        const channels = [...channelStats.entries()]
            .map(([name, c]) => ({ name, count: c.count, conversionRate: +(c.won / c.count * 100).toFixed(1) }))
            .sort((a, b) => b.count - a.count).slice(0, 10);

        return { kommo: { pipelines, agents, channels, salesHistory, lossReasons } };
    },
};
