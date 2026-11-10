import fs from 'node:fs';
import path from 'node:path';

export const ROOT_DIR = path.resolve(import.meta.dirname, '..', '..');
export const DATA_DIR = path.join(ROOT_DIR, 'server', 'data');
export const DIST_DIR = path.join(ROOT_DIR, 'dist');

fs.mkdirSync(DATA_DIR, { recursive: true });
