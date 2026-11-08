import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { lessonVideoBytes, listMyLessons, listTeamLessons } from '$lib/server/lessons';
import { localDay } from '$lib/day/day';
import { wallOf } from '$lib/server/scope';
import { storedTwinSets } from '$lib/server/twins';
import { foldRows } from '$lib/clones/twins';
import { groupModeOf } from '$lib/server/group-mode';
import { teamLimitBytes, usedBytesOf } from '$lib/server/storage';
import { myClassOf, teamsWithNew } from '$lib/server/my-class';
import { levelShown } from '$lib/levels/levels';
import type { LayoutServerLoad } from './$types';
import { serverNow } from '$lib/server/server-clock';

/**
 * The Lessons list, once, for the list page and for a lesson open beside it
 * (desktop: the list column is the layout's). Reads `params`, `locals` and
 * `cookies` only, never `url`, so opening another lesson does not rerun it; a
 * form on the lesson page reruns it (`invalidateAll`), so Add, Remove and
 * archive refresh the column.
 */
function zone(locals: App.Locals): string {
	if (!locals.user) throw error(401);
	return locals.user.timezone;
}

/**
 * Twins show as one (board C7): each set is one row, yours if you have one,
 * else the first group by name, dated by the newest member's day, with the
 * "Twins" chip. Newest class first.
 */
function foldedLessons(db: ReturnType<typeof getDb>, wall: ReturnType<typeof wallOf>) {
	const all = listMyLessons(db, wall);
	const sets = storedTwinSets(db, wall.userId, 'lesson');
	if (sets.length === 0) return all;
	const byId = new Map(all.map((l) => [l.id, l]));
	const mineIds = new Set(all.filter((l) => !l.team).map((l) => l.id));
	return foldRows(all, sets, mineIds)
		.map(({ twins, ...l }) => {
			if (twins.length === 0) return l;
			const newest = [l.lessonDay, ...twins.map((t) => byId.get(t)!.lessonDay)].sort().at(-1)!;
			return { ...l, lessonDay: newest, twinned: true, twinIds: twins };
		})
		.sort((a, b) => b.lessonDay.localeCompare(a.lessonDay) || b.id - a.id);
}

export const load: LayoutServerLoad = ({ params, locals, cookies }) => {
	const db = getDb();
	const wall = wallOf(params, locals);
	const mode = groupModeOf(db, wall.userId, wall.dance, cookies);
	if (mode) {
		// The group's lessons, drafts first; the person's own are in Mine.
		return {
			lessons: listTeamLessons(db, wall.userId, mode.teamId, mode.role),
			storageBytes: 0,
			// The group's storage, as its group page reads it: the desktop band's subtitle.
			groupStorage: {
				usedBytes: usedBytesOf(db, { teamId: mode.teamId }),
				limitBytes: teamLimitBytes(db, mode.teamId)
			},
			today: localDay(serverNow(), zone(locals)),
			// Group mode is Everything's only.
			classes: null
		};
	}
	return {
		// Their own lessons and the group lessons they added, marked with the group.
		lessons: foldedLessons(db, wall),
		storageBytes: lessonVideoBytes(db, wall.userId),
		groupStorage: null,
		today: localDay(serverNow(), zone(locals)),
		classes: classesOf(db, wall, locals)
	};
};

/**
 * At Follow my class a lesson sits beside My class's list of classes, not the
 * Lessons list (levels spec, "Desktop"): the same rows as the Groups layout's.
 * Null at the other levels.
 */
function classesOf(
	db: ReturnType<typeof getDb>,
	wall: ReturnType<typeof wallOf>,
	locals: App.Locals
) {
	if (levelShown(locals.user!.level) !== 'follow') return null;
	const teams = teamsWithNew(db, wall);
	return { teams, myClass: myClassOf(db, wall, teams, zone(locals), serverNow()) };
}
