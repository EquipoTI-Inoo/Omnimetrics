import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths';

// Master key: from ENCRYPTION_KEY (64 hex chars) or auto-generated once into server/data/secret.key
const loadKey = (): Buffer => {
    const fromEnv = process.env.ENCRYPTION_KEY;
    if (fromEnv) {
        const key = Buffer.from(fromEnv, 'hex');
        if (key.length !== 32) throw new Error('ENCRYPTION_KEY debe tener 64 caracteres hex (32 bytes).');
        return key;
    }
    const keyFile = path.join(DATA_DIR, 'secret.key');
    if (fs.existsSync(keyFile)) return Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'hex');
    const key = crypto.randomBytes(32);
    fs.writeFileSync(keyFile, key.toString('hex'), { mode: 0o600 });
    return key;
};

const KEY = loadKey();

export const encrypt = (plain: string): string => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
};

export const decrypt = (payload: string): string => {
    const [iv, tag, data] = payload.split('.').map(p => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};

// --- Sessions: "<expiresAt>.<hmac>" signed with a key derived from the master key ---
const SESSION_KEY = crypto.createHmac('sha256', KEY).update('omnimetrics-session').digest();
const sign = (value: string) => crypto.createHmac('sha256', SESSION_KEY).update(value).digest('base64url');

export const createSessionToken = (ttlMs: number): string => {
    const exp = String(Date.now() + ttlMs);
    return `${exp}.${sign(exp)}`;
};

export const verifySessionToken = (token?: string): boolean => {
    if (!token) return false;
    const [exp, sig] = token.split('.');
    if (!exp || !sig) return false;
    const expected = sign(exp);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    return Number(exp) > Date.now();
};

export const safeEqual = (a: string, b: string): boolean => {
    const ha = crypto.createHash('sha256').update(a).digest();
    const hb = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(ha, hb);
};
