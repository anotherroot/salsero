import { and, eq } from 'drizzle-orm';
import type { Db } from './db';
import { defaultStyles } from './db/schema';
import { DANCE_SLUGS, DANCES, isStyleOf, type DanceSlug } from '$lib/dances/dances';

/**
 * The style a new figure of `dance` starts on for this user: their pick from
 * Settings, else the registry's. A stored style the dance no longer has falls
 * back too.
 */
export function defaultStyle(db: Db, userId: string, dance: DanceSlug): string {
	const row = db
		.select({ style: defaultStyles.style })
		.from(defaultStyles)
		.where(and(eq(defaultStyles.userId, userId), eq(defaultStyles.dance, dance)))
		.get();
	return row && isStyleOf(dance, row.style) ? row.style : DANCES[dance].defaultStyle;
}

/** Every dance's default for this user, for the Settings page. */
export function defaultStylesFor(db: Db, userId: string): Record<DanceSlug, string> {
	return Object.fromEntries(DANCE_SLUGS.map((d) => [d, defaultStyle(db, userId, d)])) as Record<
		DanceSlug,
		string
	>;
}

/** Remember a dance's default style. Throws on a style the dance does not have. */
export function setDefaultStyle(db: Db, userId: string, dance: DanceSlug, style: string) {
	if (!isStyleOf(dance, style)) throw new RangeError(`not a ${dance} style: ${style}`);
	db.insert(defaultStyles)
		.values({ userId, dance, style })
		.onConflictDoUpdate({ target: [defaultStyles.userId, defaultStyles.dance], set: { style } })
		.run();
}
