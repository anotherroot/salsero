import { error, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	createLesson,
	lessonVideoBytes,
	listMyLessons,
	listTeamLessons
} from '$lib/server/lessons';
import { readNewLesson } from '$lib/server/lesson-form';
import { localDay } from '$lib/day/day';
import { wallOf } from '$lib/server/scope';
import { storedTwinSets } from '$lib/server/twins';
import { foldRows } from '$lib/clones/twins';
import { groupModeOf, spaceOf } from '$lib/server/group-mode';
import type { Actions, PageServerLoad } from './$types';

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
			return { ...l, lessonDay: newest, twinned: true };
		})
		.sort((a, b) => b.lessonDay.localeCompare(a.lessonDay) || b.id - a.id);
}

export const load: PageServerLoad = ({ params, locals, cookies }) => {
	const db = getDb();
	const wall = wallOf(params, locals);
	const mode = groupModeOf(db, wall.userId, wall.dance, cookies);
	if (mode) {
		// The group's lessons, drafts first; the person's own are in Mine.
		return {
			lessons: listTeamLessons(db, wall.userId, mode.teamId, mode.role),
			storageBytes: 0,
			today: localDay(Date.now(), zone(locals))
		};
	}
	return {
		// Their own lessons and the group lessons they added, marked with the group.
		lessons: foldedLessons(db, wall),
		storageBytes: lessonVideoBytes(db, wall.userId),
		today: localDay(Date.now(), zone(locals))
	};
};

export const actions: Actions = {
	create: async ({ params, request, locals, cookies }) => {
		const db = getDb();
		const space = spaceOf(db, params, locals, cookies);
		const today = localDay(Date.now(), zone(locals));
		const form = await request.formData();
		if ('teamId' in space) {
			// A draft of the group's: no drill, no frequency.
			const read = readNewLesson(form, today, false);
			if ('refused' in read) return read.refused;
			const { lesson } = createLesson(db, space, read.input);
			throw redirect(303, `/${space.dance}/lessons/${lesson.id}`);
		}
		const read = readNewLesson(form, today, true);
		if ('refused' in read) return read.refused;
		const { lesson } = createLesson(db, space, read.input, read.everyDays);
		throw redirect(303, `/${space.dance}/lessons/${lesson.id}`);
	}
};
