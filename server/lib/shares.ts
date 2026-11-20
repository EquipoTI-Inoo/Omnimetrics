import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths';
import { encrypt, decrypt, safeEqual } from './crypto';
import type { StoredConnection } from './store';

/**
 * Enlaces para compartir el dashboard en modo solo lectura.
 * Se guardan cifrados (mismo esquema que las conexiones) en server/data/shares.enc.
 * El token del enlace es aleatorio (192 bits) e imposible de adivinar.
 *
 * Cada enlace se asigna a una cuenta de cliente (solo ella y los administradores pueden abrirlo)
 * y guarda una copia de las cuentas conectadas al momento de crearlo: si luego el administrador
 * conecta otras cuentas, el enlace sigue mostrando las métricas originales.
 */
/** Pestañas que un enlace puede mostrar */
export const SHARE_PAGES = ['dashboard', 'reports', 'ads'] as const;
export type SharePage = typeof SHARE_PAGES[number];

export interface Share {
    id: string;
    token: string;
    label: string;
    /** Pestañas visibles. Los enlaces creados antes de esta opción no lo tienen: solo ven el dashboard. */
    pages?: SharePage[];
    /** Cliente que puede abrir el enlace. Los enlaces antiguos no lo tienen: solo los abren administradores. */
    clientId?: string;
    /** Copia de las conexiones (con credenciales) al crear el enlace. Nunca se envía al navegador. */
    connections?: StoredConnection[];
    createdAt: string;
    createdBy?: string;
    expiresAt?: string;
    lastViewedAt?: string;
    views: number;
}

/** Lo que se puede enviar al navegador: sin credenciales, solo qué cuentas incluye */
export type PublicShare = Omit<Share, 'connections'> & { accounts: { platform: string; name: string }[] };

const FILE = path.join(DATA_DIR, 'shares.enc');

const readAll = (): Share[] => {
    if (!fs.existsSync(FILE)) return [];
    return JSON.parse(decrypt(fs.readFileSync(FILE, 'utf8')));
};

const writeAll = (all: Share[]) => {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, encrypt(JSON.stringify(all)), { mode: 0o600 });
    fs.renameSync(tmp, FILE);
};

const accountName = (c: StoredConnection) =>
    c.info.account || c.info.accountId || c.platform;

export const toPublicShare = ({ connections, ...rest }: Share): PublicShare => ({
    ...rest,
    accounts: (connections || []).map(c => ({ platform: c.platform, name: String(accountName(c)) })),
});

export const Shares = {
    list: (): Share[] => readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

    create: (opts: {
        label: string; expiresInDays?: number; pages: SharePage[];
        clientId: string; connections: StoredConnection[]; createdBy: string;
    }): Share => {
        const share: Share = {
            id: crypto.randomBytes(6).toString('hex'),
            token: crypto.randomBytes(24).toString('base64url'),
            label: opts.label,
            pages: opts.pages,
            clientId: opts.clientId,
            // Copia profunda: cambios posteriores en las conexiones no afectan al enlace
            connections: JSON.parse(JSON.stringify(opts.connections)),
            createdAt: new Date().toISOString(),
            createdBy: opts.createdBy,
            expiresAt: opts.expiresInDays ? new Date(Date.now() + opts.expiresInDays * 864e5).toISOString() : undefined,
            views: 0,
        };
        writeAll([...readAll(), share]);
        return share;
    },

    revoke: (id: string): boolean => {
        const all = readAll();
        const next = all.filter(s => s.id !== id);
        if (next.length === all.length) return false;
        writeAll(next);
        return true;
    },

    /** Al eliminar un cliente se eliminan sus enlaces */
    revokeForClient: (clientId: string): number => {
        const all = readAll();
        const next = all.filter(s => s.clientId !== clientId);
        if (next.length !== all.length) writeAll(next);
        return all.length - next.length;
    },

    /** Devuelve el enlace si el token existe y no venció. Compara en tiempo constante. */
    find: (token: string): Share | undefined => {
        let found: Share | undefined;
        for (const s of readAll()) if (safeEqual(token, s.token)) found = s;
        if (found && isExpired(found)) return undefined;
        return found;
    },

    pagesOf: (s: Share): SharePage[] => s.pages?.length ? s.pages : ['dashboard'],

    touch: (id: string) => {
        const all = readAll();
        const s = all.find(x => x.id === id);
        if (!s) return;
        s.views += 1;
        s.lastViewedAt = new Date().toISOString();
        writeAll(all);
    },
};

export const isExpired = (s: Share) => !!s.expiresAt && new Date(s.expiresAt).getTime() <= Date.now();
