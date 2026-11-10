import { RateLimitError } from './http';

/**
 * Caché en memoria de lo que devuelve cada plataforma, por conexión + rango de fechas.
 *
 * - Evita repetir la misma consulta: refrescar, cambiar de pestaña, el periodo anterior y las visitas
 *   a enlaces compartidos reutilizan el resultado durante SYNC_CACHE_MINUTES (10 por defecto).
 * - Une consultas idénticas simultáneas en una sola.
 * - Si la plataforma limita las consultas (RateLimitError), sirve el último resultado bueno (hasta 24 h)
 *   y deja de llamarla durante unos minutos, porque insistir alarga el bloqueo.
 */

const TTL = () => Math.max(1, Number(process.env.SYNC_CACHE_MINUTES) || 10) * 60_000;
const FORCE_MIN_AGE = 60_000;      // "Actualizar" ignora la caché solo si tiene más de 1 minuto
const STALE_MAX_AGE = 24 * 3600_000;
const COOLDOWN = 5 * 60_000;       // pausa tras un bloqueo

interface Entry { at: number; value: Record<string, unknown> }

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<Record<string, unknown>>>();
const cooldownUntil = new Map<string, number>();

export interface CachedResult {
    value: Record<string, unknown>;
    /** Presente cuando se sirvieron datos guardados porque la plataforma no respondió */
    staleWarning?: string;
}

const ago = (ms: number) => {
    const min = Math.round(ms / 60_000);
    return min < 1 ? 'hace menos de un minuto' : min < 60 ? `hace ${min} min` : `hace ${Math.round(min / 60)} h`;
};

export const SyncCache = {
    /**
     * @param scope  identifica la conexión (plataforma + fecha de conexión): reconectar empieza de cero
     * @param key    scope + rango + modo
     */
    async get(scope: string, key: string, fetcher: () => Promise<Record<string, unknown>>, opts: { force?: boolean } = {}): Promise<CachedResult> {
        const now = Date.now();
        const hit = entries.get(key);
        const age = hit ? now - hit.at : Infinity;
        if (hit && age < TTL() && !(opts.force && age > FORCE_MIN_AGE)) return { value: hit.value };

        const stale = (e: RateLimitError): CachedResult => {
            if (hit && age < STALE_MAX_AGE) {
                return { value: hit.value, staleWarning: `${e.message} Mostrando los datos guardados ${ago(age)}.` };
            }
            throw e;
        };

        const blocked = cooldownUntil.get(scope);
        if (blocked && blocked > now) {
            return stale(new RateLimitError(`La plataforma limitó las consultas; se volverá a intentar en ${Math.ceil((blocked - now) / 60_000)} min.`));
        }

        let pending = inflight.get(key);
        if (!pending) {
            pending = fetcher().finally(() => inflight.delete(key));
            inflight.set(key, pending);
        }
        try {
            const value = await pending;
            entries.set(key, { at: Date.now(), value });
            cooldownUntil.delete(scope);
            if (entries.size > 300) entries.delete(entries.keys().next().value!);
            return { value };
        } catch (e) {
            if (e instanceof RateLimitError) {
                cooldownUntil.set(scope, Date.now() + COOLDOWN);
                return stale(e);
            }
            throw e;
        }
    },

    /** Al desconectar o reconectar una plataforma */
    clear(scopePrefix: string) {
        for (const k of entries.keys()) if (k.startsWith(scopePrefix)) entries.delete(k);
        for (const k of cooldownUntil.keys()) if (k.startsWith(scopePrefix)) cooldownUntil.delete(k);
    },
};
