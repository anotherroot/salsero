/**
 * My class's list (Follow my class, levels spec "My class"): the person's groups
 * in this dance, each with what is new in it, and what the list of classes adds
 * at Follow my class. The Groups layout reads it, and the Lessons layout beside a
 * class's lesson at Follow my class (the list column there is My class's).
 */
import { DANCE_SLUGS, getDance } from '$lib/dances/dances';
import { localDay } from '$lib/day/day';
import { otherClassLine } from '$lib/teams/view';
import type { MyClassInfo, TeamItem } from '$lib/types';
import type { Db } from './db';
import { danceWithClass } from './join-code';
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
 * What the list of classes adds: each class's last class day, and with no class
 * in this dance, the other dance's My class when the person has a class there.
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
	const elsewhere =
		live.length === 0 ? danceWithClass(db, wall.userId, wall.dance, DANCE_SLUGS) : wall.dance;
	return {
		lastDays: Object.fromEntries(days),
		today: localDay(now, timezone),
		other:
			elsewhere === wall.dance
				? null
				: { dance: elsewhere, line: otherClassLine(getDance(elsewhere).label) }
	};
}
