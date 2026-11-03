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
import { drillPayload, practicePayload } from '$lib/server/practice-content';
import { entryFor } from '$lib/server/entries';
import { requireExerciseAccess, requireExerciseInWall, wallOf } from '$lib/server/scope';
import { linkableSections, linkSpot, SpotLinkError, unlinkSpot } from '$lib/server/spot-links';
import { isFrequency } from '$lib/frequency';
import { localDay } from '$lib/day/day';
import type { ExerciseItem } from '$lib/types';
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
	const wall = wallOf(params, locals);
	const tz = locals.user.timezone;
	const now = Date.now();
	const id = Number(params.id);
	if (!Number.isInteger(id) || id < 1) throw error(404, 'No such exercise');
	const {
		exercise: row,
		access,
		reach: visible
	} = requireExerciseAccess(db, locals, params, id, 'read');
	if (row.archivedAt !== null) throw error(404, 'No such exercise');
	// The history's "Today" / "Yesterday": the server's day, so SSR and hydration agree.
	const today = localDay(now, tz);

	if (row.teamId === null) {
		// The person's own row: the page is its log popup's.
		const own = requireExerciseInWall(db, wall, row.id);
		const popup = popupData(db, wall, own.id, tz, now);
		if (!popup) throw error(404, 'No such exercise');
		return {
			...popup,
			practice: practicePayload(db, own, tz, now),
			history: exerciseHistory(db, own.id),
			summary: exerciseSummary(db, own.id),
			today,
			// Only a drill's sections are its own; the others show their owner's.
			linkable: own.source === 'custom' ? linkableSections(db, { exerciseId: own.id }) : [],
			canEdit: true,
			canLog: true,
			drill: null
		};
	}

	// A group's drill: its content, and the log of this person's own entry for
	// it. `popupData` never runs on the group's row, so a set can only ever land
	// on the person's entry (risk 22). Without an entry there is nothing to log.
	const canEdit = access === 'edit';
	const found = entryFor(db, wall.userId, { drillId: row.id });
	const entry = found && found.archivedAt === null ? found : null;
	const popup = entry ? popupData(db, wall, entry.id, tz, now) : null;
	const shown: ExerciseItem = {
		id: row.id,
		name: row.name,
		source: row.source,
		figureId: null,
		lessonId: null,
		routineId: null,
		partner: null,
		practiceMode: row.practiceMode,
		songId: null,
		countBpm: null,
		practiceJson: null,
		everyDays: row.everyDays,
		active: row.active,
		archived: false,
		notes: row.notes,
		createdAt: row.createdAt
	};
	return {
		exercise: popup?.exercise ?? shown,
		sets: popup?.sets ?? [],
		songs: popup?.songs ?? [],
		takes: popup?.takes ?? [],
		practice: drillPayload(
			db,
			row,
			popup ? popup.exercise.id : null,
			tz,
			now,
			visible ?? undefined
		),
		history: popup ? exerciseHistory(db, popup.exercise.id) : [],
		summary: popup
			? exerciseSummary(db, popup.exercise.id)
			: { sets: 0, totalS: 0, recentRating: null },
		today,
		linkable: canEdit ? linkableSections(db, { exerciseId: row.id }) : [],
		canEdit,
		canLog: popup !== null,
		drill: { id: row.id, name: row.name, notes: row.notes }
	};
};

export const actions: Actions = {
	log: (event) => logSetFrom(event),
	deleteSet: (event) => deleteSetFrom(event),
	restoreSet: (event) => restoreSetFrom(event),

	update: async ({ params, request, locals }) => {
		const row = exerciseOf(params, locals);
		const form = await request.formData();
		const name = text(form, 'name') ?? '';
		// A group's drill is practised through each member's own entry, so how
		// often and whether it is on Today are theirs: its own stay as they are.
		const team = row.teamId !== null;
		const everyDays = team ? row.everyDays : int(form, 'everyDays');
		const active = team ? row.active : checkbox(form, 'active');
		const notes = optionalText(form, 'notes');
		if (everyDays === undefined || !isFrequency(everyDays) || notes === undefined) {
			return fail(400, { action: 'update', message: 'Check the values and try again.' });
		}
		if (!updateExercise(getDb(), row.id, { name, everyDays, notes, active })) {
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
