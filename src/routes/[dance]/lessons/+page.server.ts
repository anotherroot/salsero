import { error, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { createLesson, lessonVideoBytes, listLessons } from '$lib/server/lessons';
import { readNewLesson } from '$lib/server/lesson-form';
import { localDay } from '$lib/day/day';
import { wallOf } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

function zone(locals: App.Locals): string {
	if (!locals.user) throw error(401);
	return locals.user.timezone;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const db = getDb();
	const wall = wallOf(params, locals);
	return {
		lessons: listLessons(db, wall),
		storageBytes: lessonVideoBytes(db, wall.userId),
		today: localDay(Date.now(), zone(locals))
	};
};

export const actions: Actions = {
	create: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const read = readNewLesson(await request.formData(), localDay(Date.now(), zone(locals)), true);
		if ('refused' in read) return read.refused;
		const { lesson } = createLesson(getDb(), wall, read.input, read.everyDays);
		throw redirect(303, `/${wall.dance}/lessons/${lesson.id}`);
	}
};
