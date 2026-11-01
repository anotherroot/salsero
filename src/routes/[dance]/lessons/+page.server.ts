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

		const refuse = (message: string, field?: 'lessonDay' | 'title' | 'notes') =>
			fail(400, { action: 'create', ...(field ? { field } : {}), message, ...entered });

		if (!title) return refuse('Give it a title (up to 200 characters).', 'title');
		if (notes === undefined) return refuse('Notes are up to 2000 characters.', 'notes');
		if (everyDays === undefined || !isFrequency(everyDays)) {
			return refuse('Pick how often to go over it.');
		}
		if (!isValidDay(lessonDay)) return refuse('Pick the day of the class.', 'lessonDay');
		// A class you have not attended yet is not a lesson — the same instinct the
		// Today page has about future days.
		if (lessonDay > today) return refuse('That day is in the future.', 'lessonDay');

		const { lesson } = createLesson(getDb(), dance, { lessonDay, title, notes }, everyDays);
		throw redirect(303, `/${dance}/lessons/${lesson.id}`);
	}
};
