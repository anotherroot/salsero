/**
 * My class's list (Follow my class, levels spec "My class"): the person's groups
 * in this dance, each with what is new in it, and what the list of classes adds
 * at Follow my class. The Groups layout reads it, and the Lessons layout beside a
 * class's lesson at Follow my class (the list column there is My class's).
 */
import { localDay } from '$lib/day/day';
import type { MyClassInfo, TeamItem } from '$lib/types';
import type { Db } from './db';
import { latestClassDays } from './lessons';
import type { Wall } from './scope';
import { listMyTeams } from './teams';
import { whatsNew } from './whats-new';

/** The person's groups in this dance, with what is new to them in each. */
export function teamsWithNew(db: Db, wall: Wall): (TeamItem & { newCount: number })[] {
	const fresh = whatsNew(db, wall.userId, wall.dance).byTeam;
	return listMyTeams(db, wall.userId, wall.dance).map((t) => ({
		...t,
		newCount: fresh.get(t.id) ?? 0
	}));
}

/**
 * What the list of classes adds: each class's last class day, and today.
 */
export function myClassOf(
	db: Db,
	wall: Wall,
	teams: TeamItem[],
	timezone: string,
	now: number
): MyClassInfo {
	const live = teams.filter((t) => t.deletedAt === null);
	const days = latestClassDays(
		db,
		live.map((t) => t.id)
	);
	return { lastDays: Object.fromEntries(days), today: localDay(now, timezone) };
}
