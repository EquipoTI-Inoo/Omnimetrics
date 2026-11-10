import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths';
import { encrypt, decrypt } from './crypto';

export type PlatformId = 'meta' | 'google' | 'ga4' | 'linkedin' | 'tiktok' | 'kommo';

export interface StoredConnection {
    platform: PlatformId;
    credentials: Record<string, string>; // secrets: never sent to the browser
    info: Record<string, string>;        // public metadata (account name, ids) shown in the UI
    connectedAt: string;
    lastSync?: string;
    lastError?: string;
}

const FILE = path.join(DATA_DIR, 'connections.enc');

const readAll = (): Record<string, StoredConnection> => {
    if (!fs.existsSync(FILE)) return {};
    return JSON.parse(decrypt(fs.readFileSync(FILE, 'utf8')));
};

const writeAll = (all: Record<string, StoredConnection>) => {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, encrypt(JSON.stringify(all)), { mode: 0o600 });
    fs.renameSync(tmp, FILE);
};

export const Store = {
    list: (): StoredConnection[] => Object.values(readAll()),

    get: (platform: PlatformId): StoredConnection | undefined => readAll()[platform],

    save: (conn: StoredConnection) => {
        const all = readAll();
        all[conn.platform] = conn;
        writeAll(all);
    },

    update: (platform: PlatformId, patch: Partial<StoredConnection>) => {
        const all = readAll();
        if (!all[platform]) return;
        all[platform] = { ...all[platform], ...patch };
        writeAll(all);
    },

    remove: (platform: PlatformId) => {
        const all = readAll();
        delete all[platform];
        writeAll(all);
    },
};
