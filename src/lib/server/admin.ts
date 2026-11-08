import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { DANCE_SLUGS } from '$lib/dances/dances';
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

export type WeakReason = 'short' | 'common' | 'repeated' | 'mix';

/** Why a password is too weak, or null. Join says it in the reader's words (`t().entry.join.weak`). */
export function weakReason(pw: string): WeakReason | null {
	if (pw.length < 12) return 'short';
	if (WEAK.has(pw.toLowerCase())) return 'common';
	if (/^(.)\1+$/.test(pw)) return 'repeated';
	const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length;
	if (classes < 3) return 'mix';
	return null;
}

const WEAK_WHY: Record<WeakReason, string> = {
	short: 'must be at least 12 characters',
	common: 'is a well-known password',
	repeated: 'is a single repeated character',
	mix: 'must mix at least three of: lower, upper, digit, symbol'
};

/** Why a password is too weak, as the boot log says it (English: an operator reads it), or null. */
export function rejectWeak(pw: string): string | null {
	const why = weakReason(pw);
	return why ? WEAK_WHY[why] : null;
}

/**
 * Create an admin from the environment in each dance that has no account yet.
 *
 * Runs at boot, because a deploy that has to remember a seed step eventually
 * forgets. It never touches an existing account: changing the password later
 * is a deliberate act, not a side effect of editing the secret.
 */
export async function seedAdmin(db: Db, email: string | undefined, password: string | undefined) {
	// Each dance is its own app with its own accounts: one admin per dance that
	// has none yet. Runs after the dance split, so no unplaced account is missed.
	const empty = DANCE_SLUGS.filter(
		(dance) => !db.select({ id: users.id }).from(users).where(eq(users.dance, dance)).get()
	);
	if (empty.length === 0) return;

	const normalized = email?.trim().toLowerCase();
	if (!normalized || !password) {
		console.warn(
			`No ${empty.join(' or ')} account exists and ADMIN_EMAIL/ADMIN_PASSWORD are not set; nobody can log in there.`
		);
		return;
	}
	const weak = rejectWeak(password);
	if (weak) throw new Error(`Refusing to create the admin: ADMIN_PASSWORD ${weak}.`);

	const passwordHash = await hashPassword(password);
	for (const dance of empty) {
		db.insert(users)
			.values({
				id: randomUUID(),
				email: normalized,
				passwordHash,
				dance,
				isAdmin: true,
				storageLimitBytes: null
			})
			.run();
		console.log(`Created the ${dance} admin ${normalized}.`);
	}
}
