import fs from 'node:fs';
import path from 'node:path';

export const ROOT_DIR = path.resolve(import.meta.dirname, '..', '..');
export const DIST_DIR = path.join(ROOT_DIR, 'dist');

/**
 * Where connections, shares and the encryption key are stored. It must survive redeploys:
 * - DATA_DIR env var, when set.
 * - On Hostinger the app runs from hbuilds/versions/<id>/nodejs and every deploy creates a new
 *   version folder, so data next to the code would be lost (and with it the key, which also logs
 *   everyone out). There it defaults to <domain folder>/omnimetrics-data, outside hbuilds/public_html.
 * - Anywhere else (local), server/data as before.
 */
const LEGACY_DATA_DIR = path.join(ROOT_DIR, 'server', 'data');
const hostingerDomainDir = ROOT_DIR.match(/^(.*)[\\/]hbuilds[\\/](?:current|versions[\\/][^\\/]+)[\\/]nodejs$/)?.[1];

export const DATA_DIR = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : hostingerDomainDir ? path.join(hostingerDomainDir, 'omnimetrics-data') : LEGACY_DATA_DIR;

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

// One-time move: bring data saved by a deploy that still kept it next to the code
if (DATA_DIR !== LEGACY_DATA_DIR && !fs.existsSync(path.join(DATA_DIR, 'secret.key'))) {
    for (const file of ['secret.key', 'connections.enc', 'shares.enc']) {
        const from = path.join(LEGACY_DATA_DIR, file);
        if (fs.existsSync(from)) fs.copyFileSync(from, path.join(DATA_DIR, file));
    }
}
