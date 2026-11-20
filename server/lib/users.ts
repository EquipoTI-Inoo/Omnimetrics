import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths';
import { encrypt, decrypt } from './crypto';
import type { StoredConnection } from './store';

/**
 * Cuentas de usuario. Se guardan cifradas en server/data/users.enc.
 * - admin: ve toda la app, gestiona cuentas y crea enlaces.
 * - client: solo puede abrir los enlaces que un administrador le asignó.
 */
export type Role = 'admin' | 'client';

export interface User {
    id: string;
    username: string;
    role: Role;
    salt: string;
    hash: string;
    createdAt: string;
    createdBy?: string;
    /** Debe cambiar la contraseña antes de usar la app (administrador inicial) */
    mustChangePassword?: boolean;
    /** Las sesiones iniciadas antes de esta fecha dejan de valer */
    passwordChangedAt?: string;
    /**
     * Solo clientes: cuentas asignadas (Meta Ads, Kommo), con sus credenciales. Si tiene alguna,
     * sus enlaces muestran únicamente estas cuentas. Nunca se envían al navegador.
     */
    connections?: StoredConnection[];
}

export interface AssignedAccount { platform: string; name: string; accountId: string }

/** Lo que se puede enviar al navegador (sin hash, salt ni credenciales) */
export type PublicUser = Pick<User, 'id' | 'username' | 'role' | 'createdAt' | 'createdBy' | 'mustChangePassword'> & { accounts: AssignedAccount[] };

export const accountsOf = (conns: StoredConnection[] | undefined): AssignedAccount[] =>
    (conns || []).map(c => ({ platform: c.platform, name: String(c.info.account || c.info.accountId || c.platform), accountId: String(c.info.accountId || '') }));

/** Administrador que se crea en el primer arranque. Su contraseña es temporal: se exige cambiarla al entrar. */
const INITIAL_ADMIN = { username: 'franciscoolaya', password: '123456' };

export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
export const MIN_PASSWORD = 8;

const FILE = path.join(DATA_DIR, 'users.enc');

const readAll = (): User[] => {
    if (!fs.existsSync(FILE)) return [];
    return JSON.parse(decrypt(fs.readFileSync(FILE, 'utf8')));
};

const writeAll = (all: User[]) => {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, encrypt(JSON.stringify(all)), { mode: 0o600 });
    fs.renameSync(tmp, FILE);
};

const hashPassword = (password: string, salt: string) =>
    crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex');

// Hash fijo para comparar cuando el usuario no existe: el tiempo de respuesta no revela qué usuarios existen
const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'), DUMMY_SALT);

export const normalizeUsername = (u: unknown) => String(u ?? '').trim().toLowerCase();

export const toPublic = ({ id, username, role, createdAt, createdBy, mustChangePassword, connections }: User): PublicUser =>
    ({ id, username, role, createdAt, createdBy, mustChangePassword: !!mustChangePassword, accounts: accountsOf(connections) });

export const Users = {
    list: (): User[] => readAll().sort((a, b) => a.username.localeCompare(b.username)),

    get: (id: string): User | undefined => readAll().find(u => u.id === id),

    /** Reemplaza las cuentas asignadas a un cliente (lista vacía = sin cuentas propias). */
    setConnections: (id: string, connections: StoredConnection[]): User | undefined => {
        const all = readAll();
        const user = all.find(u => u.id === id);
        if (!user) return undefined;
        if (connections.length) user.connections = connections; else delete user.connections;
        writeAll(all);
        return user;
    },

    create: (username: string, password: string, role: Role, createdBy?: string, mustChangePassword = false): User => {
        const all = readAll();
        if (all.some(u => u.username === username)) throw new Error('Ese nombre de usuario ya existe.');
        const salt = crypto.randomBytes(16).toString('hex');
        const user: User = {
            id: crypto.randomBytes(8).toString('hex'),
            username, role, salt,
            hash: hashPassword(password, salt),
            createdAt: new Date().toISOString(),
            createdBy,
            ...(mustChangePassword ? { mustChangePassword: true } : {}),
        };
        writeAll([...all, user]);
        return user;
    },

    /** Nueva contraseña: quita la obligación de cambiarla e invalida las sesiones anteriores. */
    setPassword: (id: string, password: string): User | undefined => {
        const all = readAll();
        const user = all.find(u => u.id === id);
        if (!user) return undefined;
        user.salt = crypto.randomBytes(16).toString('hex');
        user.hash = hashPassword(password, user.salt);
        user.passwordChangedAt = new Date().toISOString();
        delete user.mustChangePassword;
        writeAll(all);
        return user;
    },

    remove: (id: string): boolean => {
        const all = readAll();
        const next = all.filter(u => u.id !== id);
        if (next.length === all.length) return false;
        writeAll(next);
        return true;
    },

    /** Devuelve el usuario si la contraseña es correcta (comparación en tiempo constante). */
    verify: (username: string, password: string): User | undefined => {
        const user = readAll().find(u => u.username === username);
        const expected = Buffer.from(user ? user.hash : DUMMY_HASH, 'hex');
        const actual = Buffer.from(hashPassword(password, user ? user.salt : DUMMY_SALT), 'hex');
        return crypto.timingSafeEqual(expected, actual) && user ? user : undefined;
    },

    /** Primer arranque: si no hay usuarios, crea el administrador inicial (deberá cambiar la contraseña al entrar). */
    bootstrap: (): string | undefined => {
        if (readAll().length > 0) return undefined;
        Users.create(INITIAL_ADMIN.username, INITIAL_ADMIN.password, 'admin', undefined, true);
        return INITIAL_ADMIN.username;
    },
};
