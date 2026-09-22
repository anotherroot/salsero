import { randomBytes } from 'node:crypto';
import { and, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { getDb } from './db';
import { loginAttempts, sessions, users } from './db/schema';

import { hashPassword, verifyPassword } from './password';

export { hashPassword, verifyPassword };

/* ── sessions ───────────────────────────────────────────────────────────── */

export const SESSION_COOKIE = 'salsa_session';
const SESSION_TTL_MS = 30 * 24 * 3_600_000; // 30 days, absolute

export function createSession(userId: string): { id: string; expiresAt: Date } {
	const id = randomBytes(32).toString('base64url');
	const expiresAt = Date.now() + SESSION_TTL_MS;
	getDb().insert(sessions).values({ id, userId, expiresAt }).run();
	return { id, expiresAt: new Date(expiresAt) };
}

export function validateSession(id: string | undefined) {
	if (!id) return null;
	return (
		getDb()
			.select({
				userId: users.id,
				email: users.email,
				// Carried on the session so the day boundary costs no extra query.
				timezone: users.timezone
			})
			.from(sessions)
			.innerJoin(users, eq(users.id, sessions.userId))
			.where(and(eq(sessions.id, id), gt(sessions.expiresAt, Date.now())))
			.get() ?? null
	);
}

export function destroySession(id: string | undefined) {
	if (!id) return;
	getDb().delete(sessions).where(eq(sessions.id, id)).run();
}

/* ── rate limiting ──────────────────────────────────────────────────────── */

const WINDOW_MS = 15 * 60_000;
/** Per-IP allowance. Generous enough for a shared NAT, tight enough to matter. */
const MAX_PER_IP = 20;
/** Per-account allowance. Much tighter — one person fat-fingering a password. */
const MAX_PER_USER = 8;

/**
 * Throttle the login form. Both keys are counted independently so neither
 * alone is a bypass: rotating IPs still trips the per-account limit, and
 * spraying many accounts from one host still trips the per-IP limit.
 */
export function isRateLimited(ip: string, email: string): boolean {
	const since = Date.now() - WINDOW_MS;
	const ipKey = `ip:${ip}`;
	const userKey = `user:${email.toLowerCase()}`;

	const rows = getDb()
		.select({ key: loginAttempts.key, n: sql<number>`count(*)` })
		.from(loginAttempts)
		.where(and(gt(loginAttempts.attemptedAt, since), inArray(loginAttempts.key, [ipKey, userKey])))
		.groupBy(loginAttempts.key)
		.all();

	for (const row of rows) {
		if (row.key === ipKey && row.n >= MAX_PER_IP) return true;
		if (row.key === userKey && row.n >= MAX_PER_USER) return true;
	}
	return false;
}

export function recordFailedLogin(ip: string, email: string) {
	const db = getDb();
	db.insert(loginAttempts)
		.values([{ key: `ip:${ip}` }, { key: `user:${email.toLowerCase()}` }])
		.run();
	// Opportunistic prune so the table cannot grow without bound.
	db.delete(loginAttempts)
		.where(lt(loginAttempts.attemptedAt, Date.now() - WINDOW_MS))
		.run();
}

export function clearLoginAttempts(email: string) {
	getDb()
		.delete(loginAttempts)
		.where(eq(loginAttempts.key, `user:${email.toLowerCase()}`))
		.run();
}
