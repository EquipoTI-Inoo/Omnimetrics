import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths';
import { encrypt, decrypt, safeEqual } from './crypto';

/**
 * Enlaces para compartir el dashboard en modo solo lectura.
 * Se guardan cifrados (mismo esquema que las conexiones) en server/data/shares.enc.
 * El token del enlace es aleatorio (192 bits) e imposible de adivinar.
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
    createdAt: string;
    expiresAt?: string;
    lastViewedAt?: string;
    views: number;
}

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

export const Shares = {
    list: (): Share[] => readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

    create: (label: string, expiresInDays: number | undefined, pages: SharePage[]): Share => {
        const share: Share = {
            id: crypto.randomBytes(6).toString('hex'),
            token: crypto.randomBytes(24).toString('base64url'),
            label,
            pages,
            createdAt: new Date().toISOString(),
            expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 864e5).toISOString() : undefined,
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

    /** Devuelve el enlace si el token existe y no venció. Compara en tiempo constante. */
    find: (token: string): Share | undefined => {
        let found: Share | undefined;
        for (const s of readAll()) if (safeEqual(token, s.token)) found = s;
        if (found?.expiresAt && new Date(found.expiresAt).getTime() <= Date.now()) return undefined;
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
