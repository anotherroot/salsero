import { randomUUID } from 'node:crypto';
import { users } from './db/schema';
import type { Db } from './db';
import { hashPassword } from './password';

/**
 * Refuse weak passwords outright. There is no Cloudflare Access in front of
 * this host, so the admin password is the entire boundary between the open
 * internet and the data.
 */
const WEAK = new Set([
	'password',
	'admin',
	'changeme',
	'change-me',
	'letmein',
	'salsa',
	'secret',
	'12345678',
	'qwertyui'
]);

export function rejectWeak(pw: string): string | null {
	if (pw.length < 12) return 'must be at least 12 characters';
	if (WEAK.has(pw.toLowerCase())) return 'is a well-known password';
	if (/^(.)\1+$/.test(pw)) return 'is a single repeated character';
	const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length;
	if (classes < 3) return 'must mix at least three of: lower, upper, digit, symbol';
	return null;
}

/**
 * Create the single user from the environment if there is no user yet.
 *
 * Runs at boot, because a deploy that has to remember a seed step eventually
 * forgets. It never touches an existing account: changing the password later
 * is a deliberate act, not a side effect of editing the secret.
 */
export async function seedAdmin(db: Db, email: string | undefined, password: string | undefined) {
	if (db.select({ id: users.id }).from(users).limit(1).get()) return;

	const normalized = email?.trim().toLowerCase();
	if (!normalized || !password) {
		console.warn('No user exists and ADMIN_EMAIL/ADMIN_PASSWORD are not set; nobody can log in.');
		return;
	}
	const weak = rejectWeak(password);
	if (weak) throw new Error(`Refusing to create the admin: ADMIN_PASSWORD ${weak}.`);

	db.insert(users)
		.values({ id: randomUUID(), email: normalized, passwordHash: await hashPassword(password) })
		.run();
	console.log(`Created admin user ${normalized}.`);
}
