import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	archiveExercise,
	exerciseHistory,
	exerciseSummary,
	updateExercise
} from '$lib/server/exercises';
import { checkbox, int, optionalText, text } from '$lib/server/form';
import { addLinkFrom, deleteLinkFrom } from '$lib/server/link-form';
import { deleteSetFrom, logSetFrom } from '$lib/server/log-form';
import { popupData } from '$lib/server/popup';
import { practicePayload } from '$lib/server/practice-content';
import { danceOf, requireExerciseInDance } from '$lib/server/scope';
import { isFrequency } from '$lib/frequency';
import type { Actions, PageServerLoad } from './$types';

/**
 * The exercise this URL names, or a 404. An archived exercise is gone from
 * every list, so it is gone from its own URL too — the figure page's rule.
 */
function exerciseOf(params: { dance: string; id: string }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id < 1) throw error(404, 'No such exercise');
	const exercise = requireExerciseInDance(getDb(), danceOf(params), id);
	if (exercise.archivedAt !== null) throw error(404, 'No such exercise');
	return exercise;
}

export const load: PageServerLoad = ({ params, locals }) => {
	if (!locals.user) throw error(401);
	const db = getDb();
	const row = exerciseOf(params);
	const now = Date.now();
	const popup = popupData(db, danceOf(params), row.id, locals.user.timezone, now);
	if (!popup) throw error(404, 'No such exercise');
	return {
		...popup,
		practice: practicePayload(db, row, locals.user.timezone, now),
		history: exerciseHistory(db, row.id),
		summary: exerciseSummary(db, row.id)
	};
};

export const actions: Actions = {
	log: (event) => logSetFrom(event),
	deleteSet: (event) => deleteSetFrom(event),

	update: async ({ params, request }) => {
		const id = exerciseOf(params).id;
		const form = await request.formData();
		const name = text(form, 'name') ?? '';
		const everyDays = int(form, 'everyDays');
		const notes = optionalText(form, 'notes');
		if (everyDays === undefined || !isFrequency(everyDays) || notes === undefined) {
			return fail(400, { action: 'update', message: 'Check the values and try again.' });
		}
		if (
			!updateExercise(getDb(), id, { name, everyDays, notes, active: checkbox(form, 'active') })
		) {
			throw error(404, 'No such exercise');
		}
		return { action: 'update', ok: true };
	},

	archive: ({ params }) => {
		if (!archiveExercise(getDb(), exerciseOf(params).id, Date.now())) {
			return fail(400, {
				action: 'archive',
				message: 'Only custom exercises are archived here. Archive a figure from its page.'
			});
		}
		throw redirect(303, `/${params.dance}`);
	},

	addLink: async ({ params, request }) =>
		addLinkFrom(request, getDb(), { exerciseId: exerciseOf(params).id }),
	deleteLink: async ({ params, request }) =>
		deleteLinkFrom(request, getDb(), { exerciseId: exerciseOf(params).id })
};
