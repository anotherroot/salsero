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
import { deleteSetFrom, logSetFrom, restoreSetFrom } from '$lib/server/log-form';
import { popupData } from '$lib/server/popup';
import { practicePayload } from '$lib/server/practice-content';
import { requireExerciseAccess, requireExerciseInWall, wallOf } from '$lib/server/scope';
import { linkableSections, linkSpot, SpotLinkError, unlinkSpot } from '$lib/server/spot-links';
import { isFrequency } from '$lib/frequency';
import { localDay } from '$lib/day/day';
import type { Actions, PageServerLoad } from './$types';

/**
 * The exercise this URL names, to change, or a 404. An archived exercise is
 * gone from every list, so it is gone from its own URL too — the figure page's
 * rule.
 */
function exerciseOf(params: { dance: string; id: string }, locals: App.Locals) {
	const { exercise } = requireExerciseAccess(getDb(), locals, params, params.id, 'edit');
	if (exercise.archivedAt !== null) throw error(404, 'No such exercise');
	return exercise;
}

export const load: PageServerLoad = ({ params, locals }) => {
	if (!locals.user) throw error(401);
	const db = getDb();
	// The person's own row only: the page is the log popup's, and a log never
	// lands on a group's drill (risk 22).
	const id = Number(params.id);
	if (!Number.isInteger(id) || id < 1) throw error(404, 'No such exercise');
	const row = requireExerciseInWall(db, wallOf(params, locals), id);
	if (row.archivedAt !== null) throw error(404, 'No such exercise');
	const now = Date.now();
	const popup = popupData(db, wallOf(params, locals), row.id, locals.user.timezone, now);
	if (!popup) throw error(404, 'No such exercise');
	return {
		...popup,
		practice: practicePayload(db, row, locals.user.timezone, now),
		history: exerciseHistory(db, row.id),
		summary: exerciseSummary(db, row.id),
		// The history's "Today" / "Yesterday": the server's day, so SSR and hydration agree.
		today: localDay(now, locals.user.timezone),
		// Only a drill's sections are its own; the others show their owner's.
		linkable: row.source === 'custom' ? linkableSections(db, { exerciseId: row.id }) : []
	};
};

export const actions: Actions = {
	log: (event) => logSetFrom(event),
	deleteSet: (event) => deleteSetFrom(event),
	restoreSet: (event) => restoreSetFrom(event),

	update: async ({ params, request, locals }) => {
		const id = exerciseOf(params, locals).id;
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

	archive: ({ params, locals }) => {
		if (!archiveExercise(getDb(), exerciseOf(params, locals).id, Date.now())) {
			return fail(400, {
				action: 'archive',
				message: 'Only custom exercises are archived here. Archive a figure from its page.'
			});
		}
		throw redirect(303, `/${params.dance}`);
	},

	/**
	 * A drill's own section. `linkSpot` refuses any other type, a section of the
	 * other dance, and another person's section as if it were missing.
	 */
	linkSection: async ({ params, request, locals }) => {
		const exerciseId = exerciseOf(params, locals).id;
		const spotId = int(await request.formData(), 'spotId');
		if (spotId === undefined) {
			return fail(400, { action: 'linkSection', message: 'Pick a section.' });
		}
		try {
			linkSpot(getDb(), wallOf(params, locals).userId, spotId, { exerciseId });
		} catch (e) {
			if (e instanceof SpotLinkError) {
				return fail(e.status, { action: 'linkSection', message: e.message });
			}
			throw e;
		}
		return { action: 'linkSection', ok: true };
	},

	unlinkSection: async ({ params, request, locals }) => {
		const exerciseId = exerciseOf(params, locals).id;
		const id = int(await request.formData(), 'linkId');
		if (id === undefined || !unlinkSpot(getDb(), id, { exerciseId })) {
			return fail(404, { action: 'unlinkSection', message: 'That link was already removed.' });
		}
		return { action: 'unlinkSection', ok: true };
	},

	addLink: async ({ params, request, locals }) =>
		addLinkFrom(request, getDb(), { exerciseId: exerciseOf(params, locals).id }),
	deleteLink: async ({ params, request, locals }) =>
		deleteLinkFrom(request, getDb(), { exerciseId: exerciseOf(params, locals).id })
};
