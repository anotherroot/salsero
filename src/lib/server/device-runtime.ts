import { eq } from 'drizzle-orm';
import { isDanceSlug } from '$lib/dances/dances';
import { parseLevel } from '$lib/levels/levels';
import { parseLocale } from '$lib/i18n/locale';
import type { Db } from './db';
import { users } from './db/schema';

/**
 * Set by the device worker (offline phase 2) before it builds SvelteKit's
 * `Server` over the local copy: whose copy it is, and the cookies the browser
 * holds for the site. Absent on the real server.
 */
export type DeviceRuntime = { userId: string; cookies: Record<string, string> };

export function deviceRuntime(): DeviceRuntime | null {
	return (globalThis as { __salsaDevice?: DeviceRuntime }).__salsaDevice ?? null;
}

/** The signed-in user the copy stands for: the shape a session gives the hook, or null. */
export function deviceUser(db: Db, userId: string): App.Locals['user'] {
	const row = db.select().from(users).where(eq(users.id, userId)).get();
	if (!row || !row.dance || !isDanceSlug(row.dance)) return null;
	return {
		id: row.id,
		email: row.email,
		firstName: row.firstName,
		lastName: row.lastName,
		timezone: row.timezone,
		isAdmin: row.isAdmin,
		level: parseLevel(row.level),
		dance: row.dance,
		locale: parseLocale(row.locale)
	};
}
