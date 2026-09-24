import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { createLesson, lessonVideoBytes, listLessons } from '$lib/server/lessons';
import { int, optionalText, text } from '$lib/server/form';
import { isValidDay, localDay } from '$lib/day/day';
import { isFrequency } from '$lib/frequency';
import { danceOf } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

function zone(locals: App.Locals): string {
	if (!locals.user) throw error(401);
	return locals.user.timezone;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const db = getDb();
	return {
		lessons: listLessons(db, danceOf(params)),
		storageBytes: lessonVideoBytes(db),
		today: localDay(Date.now(), zone(locals))
	};
};

export const actions: Actions = {
	create: async ({ params, request, locals }) => {
		const dance = danceOf(params);
		const today = localDay(Date.now(), zone(locals));
		const form = await request.formData();
		const title = text(form, 'title');
		const notes = optionalText(form, 'notes');
		const everyDays = int(form, 'everyDays');
		const lessonDay = String(form.get('lessonDay') ?? '');
		const entered = {
			title: String(form.get('title') ?? ''),
			notes: String(form.get('notes') ?? ''),
			lessonDay
		};

		if (!title || notes === undefined || everyDays === undefined || !isFrequency(everyDays)) {
			return fail(400, {
				action: 'create',
				message: 'Give it a title (up to 200 characters) and a frequency.',
				...entered
			});
		}
		if (!isValidDay(lessonDay)) {
			return fail(400, { action: 'create', message: 'Pick the day of the class.', ...entered });
		}
		// A class you have not attended yet is not a lesson — the same instinct the
		// Today page has about future days.
		if (lessonDay > today) {
			return fail(400, {
				action: 'create',
				message: 'That day is in the future.',
				...entered
			});
		}

		const { lesson } = createLesson(getDb(), dance, { lessonDay, title, notes }, everyDays);
		throw redirect(303, `/${dance}/lessons/${lesson.id}`);
	}
};
