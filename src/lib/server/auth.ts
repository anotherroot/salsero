import { randomBytes } from 'node:crypto';
import { and, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { getDb, type Db } from './db';
import { loginAttempts, sessions, users } from './db/schema';
import { isDanceSlug, type DanceSlug } from '$lib/dances/dances';

import { hashPassword, verifyPassword } from './password';

export { hashPassword, verifyPassword };

/* ── sessions ───────────────────────────────────────────────────────────── */

export const SESSION_COOKIE = 'salsa_session';
const SESSION_TTL_MS = 30 * 24 * 3_600_000; // 30 days, absolute

export function createSession(userId: string, db: Db = getDb()): { id: string; expiresAt: Date } {
	const id = randomBytes(32).toString('base64url');
	const expiresAt = Date.now() + SESSION_TTL_MS;
	db.insert(sessions).values({ id, userId, expiresAt }).run();
	return { id, expiresAt: new Date(expiresAt) };
}

export function validateSession(id: string | undefined, db: Db = getDb()) {
	if (!id) return null;
	const row = db
		.select({
			userId: users.id,
			email: users.email,
			firstName: users.firstName,
			lastName: users.lastName,
			// Carried on the session so the day boundary costs no extra query.
			timezone: users.timezone,
			isAdmin: users.isAdmin,
			// How much app: the layouts draw the tabs from it without a query.
			level: users.level,
			dance: users.dance
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(and(eq(sessions.id, id), gt(sessions.expiresAt, Date.now())))
		.get();
	// An account the dance split has not placed signs in nowhere.
	if (!row || !row.dance || !isDanceSlug(row.dance)) return null;
	return { ...row, dance: row.dance };
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
/** An account is a dance and an email (the dance split): each counts its own attempts. */
const userKey = (dance: DanceSlug, email: string) => `user:${dance}:${email.toLowerCase()}`;

export function isRateLimited(ip: string, email: string, dance: DanceSlug): boolean {
	const since = Date.now() - WINDOW_MS;
	const ipKey = `ip:${ip}`;
	const accountKey = userKey(dance, email);

	const rows = getDb()
		.select({ key: loginAttempts.key, n: sql<number>`count(*)` })
		.from(loginAttempts)
		.where(
			and(gt(loginAttempts.attemptedAt, since), inArray(loginAttempts.key, [ipKey, accountKey]))
		)
		.groupBy(loginAttempts.key)
		.all();

	for (const row of rows) {
		if (row.key === ipKey && row.n >= MAX_PER_IP) return true;
		if (row.key === accountKey && row.n >= MAX_PER_USER) return true;
	}
	return false;
}

export function recordFailedLogin(ip: string, email: string, dance: DanceSlug) {
	const db = getDb();
	// One row per insert: each mints its own id (src/lib/server/db/ids.ts).
	for (const key of [`ip:${ip}`, userKey(dance, email)])
		db.insert(loginAttempts).values({ key }).run();
	// Opportunistic prune so the table cannot grow without bound.
	db.delete(loginAttempts)
		.where(lt(loginAttempts.attemptedAt, Date.now() - WINDOW_MS))
		.run();
}

export function clearLoginAttempts(email: string, dance: DanceSlug) {
	getDb()
		.delete(loginAttempts)
		.where(eq(loginAttempts.key, userKey(dance, email)))
		.run();
}
