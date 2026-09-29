import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	archiveLesson,
	deleteLessonVideo,
	getLesson,
	linkExercise,
	linkFigure,
	linkRoutine,
	listLinkableExercises,
	listLinkableFigures,
	listLinkableRoutines,
	unlinkExercise,
	unlinkFigure,
	unlinkRoutine,
	updateLesson
} from '$lib/server/lessons';
import { createFigure } from '$lib/server/figures';
import { createCustomExercise } from '$lib/server/exercises';
import { createRoutine } from '$lib/server/routines';
import { addLinkFrom, deleteLinkFrom } from '$lib/server/link-form';
import { listLinks } from '$lib/server/links';
import { lessonVideosDir } from '$lib/server/files';
import { checkbox, int, oneOf, optionalText, text } from '$lib/server/form';
import { deleteSetFrom, logSetFrom } from '$lib/server/log-form';
import { popupData } from '$lib/server/popup';
import { isValidDay, localDay } from '$lib/day/day';
import { DEFAULT_EVERY_DAYS, isFrequency } from '$lib/frequency';
import { PARTNER } from '$lib/labels';
import { DANCES } from '$lib/dances/dances';
import { danceOf } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

function zone(locals: App.Locals): string {
	if (!locals.user) throw error(401);
	return locals.user.timezone;
}

function lessonId(params: { id: string }): number {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id < 1) throw error(404, 'No such lesson');
	return id;
}

/**
 * The lesson this URL names, or a 404.
 *
 * `getLesson` is id-scoped, so the dance test is the only thing stopping
 * `/salsa/lessons/7` from opening a bachata lesson while the URL claims
 * otherwise. Archived is gone from every list, so it is gone from its own URL
 * too — the same answer the figure page gives. Every action below reaches the
 * row by id, so each one starts here.
 */
function lessonOf(params: { dance: string; id: string }) {
	const dance = danceOf(params);
	const found = getLesson(getDb(), lessonId(params));
	if (!found || found.lesson.archivedAt !== null || found.lesson.dance !== dance) {
		throw error(404, 'No such lesson');
	}
	return found;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const db = getDb();
	const found = lessonOf(params);
	const tz = zone(locals);
	return {
		...found,
		linkableFigures: listLinkableFigures(db, found.lesson.id),
		linkableRoutines: listLinkableRoutines(db, found.lesson.id),
		linkableExercises: listLinkableExercises(db, found.lesson.id),
		links: listLinks(db, { lessonId: found.lesson.id }),
		today: localDay(Date.now(), tz),
		popup: found.exercise ? popupData(db, danceOf(params), found.exercise.id, tz, Date.now()) : null
	};
};

export const actions: Actions = {
	update: async ({ params, request, locals }) => {
		const id = lessonOf(params).lesson.id;
		const today = localDay(Date.now(), zone(locals));
		const form = await request.formData();
		const title = text(form, 'title');
		const notes = optionalText(form, 'notes');
		const lessonDay = String(form.get('lessonDay') ?? '');

		if (!title || notes === undefined || !isValidDay(lessonDay) || lessonDay > today) {
			return fail(400, {
				action: 'update',
				message: 'Give it a title and a day that is not in the future.'
			});
		}
		if (!updateLesson(getDb(), id, { lessonDay, title, notes })) {
			return fail(404, { action: 'update', message: 'That lesson no longer exists.' });
		}
		return { action: 'update', ok: true };
	},

	archive: async ({ params }) => {
		if (!archiveLesson(getDb(), lessonOf(params).lesson.id, Date.now())) {
			return fail(400, { action: 'archive', message: 'That lesson is already archived.' });
		}
		throw redirect(303, `/${params.dance}/lessons`);
	},

	/** Quick-log the review exercise, the same one-tap path the figure page has. See `log-form.ts`. */
	log: (event) => logSetFrom(event),
	deleteSet: (event) => deleteSetFrom(event),

	/*
	 * `createFigure` opens its own transaction, so the figure and the link are two
	 * sequential calls rather than a nested one. The worst failure is a figure
	 * that exists but is not linked — visible in Figures, fixable with one tap —
	 * which is a better trade than depending on savepoint nesting.
	 */
	newFigure: async ({ params, request }) => {
		const dance = danceOf(params);
		const id = lessonOf(params).lesson.id;
		const form = await request.formData();
		const name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', DANCES[dance].styles);
		const notes = optionalText(form, 'notes');
		const callText = optionalText(form, 'callText', 200);
		const everyDays = int(form, 'everyDays') ?? DEFAULT_EVERY_DAYS;

		if (
			!name ||
			partner === undefined ||
			style === undefined ||
			notes === undefined ||
			callText === undefined ||
			!isFrequency(everyDays)
		) {
			return fail(400, {
				action: 'newFigure',
				message: 'Give the figure a name (up to 200 characters).',
				name: String(form.get('name') ?? ''),
				notes: String(form.get('notes') ?? '')
			});
		}

		const db = getDb();
		const made = createFigure(
			db,
			dance,
			{ name, partner, style, notes, callable: checkbox(form, 'callable'), callText },
			everyDays
		);
		if (!made) {
			return fail(400, {
				action: 'newFigure',
				message: 'That style does not belong to this dance.',
				name,
				notes: notes ?? ''
			});
		}
		linkFigure(db, id, made.figure.id);
		return { action: 'newFigure', ok: true };
	},

	newExercise: async ({ params, request }) => {
		const id = lessonOf(params).lesson.id;
		const form = await request.formData();
		const name = text(form, 'name');
		const everyDays = int(form, 'everyDays');
		const notes = optionalText(form, 'notes');

		if (!name || everyDays === undefined || !isFrequency(everyDays) || notes === undefined) {
			return fail(400, {
				action: 'newExercise',
				message: 'Give it a name (up to 200 characters) and a frequency.',
				name: String(form.get('name') ?? ''),
				notes: String(form.get('notes') ?? '')
			});
		}

		const db = getDb();
		const exercise = createCustomExercise(db, danceOf(params), { name, everyDays, notes });
		linkExercise(db, id, exercise.id);
		return { action: 'newExercise', ok: true };
	},

	linkFigure: async ({ params, request }) => {
		const id = lessonOf(params).lesson.id;
		const figureId = int(await request.formData(), 'figureId');
		if (figureId === undefined || !linkFigure(getDb(), id, figureId)) {
			return fail(400, { action: 'linkFigure', message: 'That figure could not be linked.' });
		}
		return { action: 'linkFigure', ok: true };
	},

	unlinkFigure: async ({ params, request }) => {
		const id = lessonOf(params).lesson.id;
		const figureId = int(await request.formData(), 'figureId');
		if (figureId === undefined || !unlinkFigure(getDb(), id, figureId)) {
			return fail(400, { action: 'unlinkFigure', message: 'That figure was already unlinked.' });
		}
		return { action: 'unlinkFigure', ok: true };
	},

	/*
	 * Two calls, not one transaction, for the reason `newFigure` gives. Then
	 * straight to the routine's page: a routine is only a name until its slots
	 * are built, and that page is where they are built.
	 */
	newRoutine: async ({ params, request }) => {
		const dance = danceOf(params);
		const id = lessonOf(params).lesson.id;
		const form = await request.formData();
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		const everyDays = int(form, 'everyDays') ?? DEFAULT_EVERY_DAYS;

		if (!name || notes === undefined || !isFrequency(everyDays)) {
			return fail(400, {
				action: 'newRoutine',
				message: 'Give the routine a name (up to 200 characters).',
				name: String(form.get('name') ?? ''),
				notes: String(form.get('notes') ?? '')
			});
		}

		const db = getDb();
		const { routine } = createRoutine(db, dance, { name, notes }, everyDays);
		linkRoutine(db, id, routine.id);
		throw redirect(303, `/${dance}/routines/${routine.id}`);
	},

	linkRoutine: async ({ params, request }) => {
		const id = lessonOf(params).lesson.id;
		const routineId = int(await request.formData(), 'routineId');
		if (routineId === undefined || !linkRoutine(getDb(), id, routineId)) {
			return fail(400, { action: 'linkRoutine', message: 'That routine could not be linked.' });
		}
		return { action: 'linkRoutine', ok: true };
	},

	unlinkRoutine: async ({ params, request }) => {
		const id = lessonOf(params).lesson.id;
		const routineId = int(await request.formData(), 'routineId');
		if (routineId === undefined || !unlinkRoutine(getDb(), id, routineId)) {
			return fail(400, { action: 'unlinkRoutine', message: 'That routine was already unlinked.' });
		}
		return { action: 'unlinkRoutine', ok: true };
	},

	linkExercise: async ({ params, request }) => {
		const id = lessonOf(params).lesson.id;
		const exerciseId = int(await request.formData(), 'exerciseId');
		if (exerciseId === undefined || !linkExercise(getDb(), id, exerciseId)) {
			return fail(400, {
				action: 'linkExercise',
				message:
					'That exercise could not be linked. A figure’s or routine’s exercise lives under it.'
			});
		}
		return { action: 'linkExercise', ok: true };
	},

	unlinkExercise: async ({ params, request }) => {
		const id = lessonOf(params).lesson.id;
		const exerciseId = int(await request.formData(), 'exerciseId');
		if (exerciseId === undefined || !unlinkExercise(getDb(), id, exerciseId)) {
			return fail(400, {
				action: 'unlinkExercise',
				message: 'That exercise was already unlinked.'
			});
		}
		return { action: 'unlinkExercise', ok: true };
	},

	/** Row first, then file: an orphan file is harmless, a row pointing at nothing is not. */
	deleteVideo: async ({ params, request }) => {
		const found = lessonOf(params);
		const id = int(await request.formData(), 'videoId');
		// Checked against THIS lesson's videos before the delete: the data
		// function deletes by id alone, so an id from another lesson — and so
		// possibly from the other dance — would be gone before anyone noticed.
		if (id === undefined || !found.videos.some((v) => v.id === id)) {
			return fail(404, { action: 'deleteVideo', message: 'That video was already removed.' });
		}
		const row = deleteLessonVideo(getDb(), id);
		if (!row) {
			return fail(404, { action: 'deleteVideo', message: 'That video was already removed.' });
		}
		await unlink(join(lessonVideosDir(), row.file)).catch(() => {});
		return { action: 'deleteVideo', ok: true };
	},

	addLink: async ({ params, request }) =>
		addLinkFrom(request, getDb(), { lessonId: lessonOf(params).lesson.id }),
	deleteLink: async ({ params, request }) =>
		deleteLinkFrom(request, getDb(), { lessonId: lessonOf(params).lesson.id })
};
