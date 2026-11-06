/**
 * A person's level (how much app they see) and their per-group auto-add
 * toggle. The rules live in `$lib/levels/levels.ts`; this is only the storage.
 */
import { and, eq } from 'drizzle-orm';
import { parseLevel, type Level } from '$lib/levels/levels';
import type { Db } from './db';
import { teamMembers, users } from './db/schema';

/** The person's level; null when not chosen yet (or a stored value this code does not know). */
export function levelOf(db: Db, userId: string): Level | null {
	const row = db.select({ level: users.level }).from(users).where(eq(users.id, userId)).get();
	return parseLevel(row?.level);
}

/** Store the level. No CHECK on `users` (never on an existing table): it is checked here. */
export function setLevel(db: Db, userId: string, level: Level): void {
	if (parseLevel(level) === null) throw new RangeError(`not a level: ${String(level)}`);
	db.update(users).set({ level }).where(eq(users.id, userId)).run();
}

/** The member's own auto-add choice in one group; false when they are not a member. */
export function setAutoAdd(db: Db, userId: string, teamId: number, on: boolean): boolean {
	const res = db
		.update(teamMembers)
		.set({ autoAdd: on ? 1 : 0 })
		.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
		.run();
	return res.changes > 0;
}

/** The member's stored auto-add choice in one group (null = the level's default, or not a member). */
export function autoAddStored(db: Db, userId: string, teamId: number): number | null {
	return (
		db
			.select({ autoAdd: teamMembers.autoAdd })
			.from(teamMembers)
			.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
			.get()?.autoAdd ?? null
	);
}
