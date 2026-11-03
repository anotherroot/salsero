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
import { groupModeOf, spaceOf } from '$lib/server/group-mode';
import type { Actions, PageServerLoad } from './$types';

function zone(locals: App.Locals): string {
	if (!locals.user) throw error(401);
	return locals.user.timezone;
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
		lessons: listMyLessons(db, wall),
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
