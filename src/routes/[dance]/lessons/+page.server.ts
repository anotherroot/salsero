import { error, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { createLesson } from '$lib/server/lessons';
import { readNewLesson } from '$lib/server/lesson-form';
import { localDay } from '$lib/day/day';
import { spaceOf } from '$lib/server/group-mode';
import type { Actions } from './$types';
import { serverNow } from '$lib/server/server-clock';

function zone(locals: App.Locals): string {
	if (!locals.user) throw error(401);
	return locals.user.timezone;
}

export const actions: Actions = {
	create: async ({ params, request, locals, cookies }) => {
		const db = getDb();
		const space = spaceOf(db, params, locals, cookies);
		const today = localDay(serverNow(), zone(locals));
		const form = await request.formData();
		const read = readNewLesson(form, today);
		if ('refused' in read) return read.refused;
		// A group's draft gets no drill; a person's lesson gets its review exercise.
		const { lesson } = createLesson(db, space, read.input);
		throw redirect(303, `/${space.dance}/lessons/${lesson.id}`);
	}
};
