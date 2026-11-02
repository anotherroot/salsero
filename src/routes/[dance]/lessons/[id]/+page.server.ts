import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { defaultStyle } from '$lib/server/default-styles';
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
import {
	createFigure,
	createVariationIn,
	getGroup,
	listMoveTargets,
	variationNameTaken
} from '$lib/server/figures';
import { createCustomExercise } from '$lib/server/exercises';
import { createRoutine } from '$lib/server/routines';
import { addLinkFrom, deleteLinkFrom, retryVideoFrom, saveVideoFrom } from '$lib/server/link-form';
import { listLinks } from '$lib/server/links';
import { lessonVideosDir } from '$lib/server/files';
import { int, oneOf, optionalText, text } from '$lib/server/form';
import { deleteSetFrom, logSetFrom, restoreSetFrom } from '$lib/server/log-form';
import { popupData } from '$lib/server/popup';
import { isValidDay, localDay } from '$lib/day/day';
import { DEFAULT_EVERY_DAYS, isFrequency } from '$lib/frequency';
import { PARTNER } from '$lib/labels';
import { DANCES } from '$lib/dances/dances';
import { inWall, wallOf } from '$lib/server/scope';
import { SpotLinkedError, videoSections } from '$lib/server/spot-links';
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
 * `getLesson` is id-scoped, so the wall test is the only thing stopping
 * `/salsa/lessons/7` from opening a bachata lesson, or another person's, while
 * the URL claims otherwise. Archived is gone from every list, so it is gone from its own URL
 * too — the same answer the figure page gives. Every action below reaches the
 * row by id, so each one starts here.
 */
function lessonOf(params: { dance: string; id: string }, locals: App.Locals) {
	const wall = wallOf(params, locals);
	const found = getLesson(getDb(), lessonId(params));
	if (!found || found.lesson.archivedAt !== null || !inWall(found.lesson, wall)) {
		throw error(404, 'No such lesson');
	}
	return found;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const db = getDb();
	const wall = wallOf(params, locals);
	const found = lessonOf(params, locals);
	const tz = zone(locals);
	return {
		...found,
		sections: Object.fromEntries(
			found.videos.map((v) => [v.id, videoSections(db, { lessonVideoId: v.id })])
		),
		linkableFigures: listLinkableFigures(db, found.lesson.id),
		// The figures "Variation of a figure" can add to, with their variations' names.
		figureGroups: listMoveTargets(db, wall, null),
		linkableRoutines: listLinkableRoutines(db, found.lesson.id),
		linkableExercises: listLinkableExercises(db, found.lesson.id),
		links: listLinks(db, { lessonId: found.lesson.id }),
		today: localDay(Date.now(), tz),
		// What "Add figure" pre-selects. Settings picks it.
		defaultStyle: defaultStyle(db, wall.userId, wall.dance),
		popup: found.exercise ? popupData(db, wall, found.exercise.id, tz, Date.now()) : null
	};
};

export const actions: Actions = {
	update: async ({ params, request, locals }) => {
		const id = lessonOf(params, locals).lesson.id;
		const today = localDay(Date.now(), zone(locals));
		const form = await request.formData();
		const title = text(form, 'title');
		const notes = optionalText(form, 'notes');
		const lessonDay = String(form.get('lessonDay') ?? '');
		const entered = {
			title: String(form.get('title') ?? ''),
			notes: String(form.get('notes') ?? ''),
			lessonDay
		};
		// The New lesson sheet's refusals, in its order: each under the field it is about.
		const refuse = (message: string, field: 'lessonDay' | 'title' | 'notes') =>
			fail(400, { action: 'update', field, message, ...entered });

		if (!title) return refuse('Give it a title (up to 200 characters).', 'title');
		if (notes === undefined) return refuse('Notes are up to 2000 characters.', 'notes');
		if (!isValidDay(lessonDay)) return refuse('Pick the day of the class.', 'lessonDay');
		if (lessonDay > today) return refuse('That day is in the future.', 'lessonDay');

		if (!updateLesson(getDb(), id, { lessonDay, title, notes })) {
			return fail(404, { action: 'update', message: 'That lesson no longer exists.' });
		}
		return { action: 'update', ok: true };
	},

	archive: async ({ params, locals }) => {
		if (!archiveLesson(getDb(), lessonOf(params, locals).lesson.id, Date.now())) {
			return fail(400, { action: 'archive', message: 'That lesson is already archived.' });
		}
		throw redirect(303, `/${params.dance}/lessons`);
	},

	/** Quick-log the review exercise, the same one-tap path the figure page has. See `log-form.ts`. */
	log: (event) => logSetFrom(event),
	deleteSet: (event) => deleteSetFrom(event),
	restoreSet: (event) => restoreSetFrom(event),

	/*
	 * `createFigure` opens its own transaction, so the figure and the link are two
	 * sequential calls rather than a nested one. The worst failure is a figure
	 * that exists but is not linked — visible in Figures, fixable with one tap —
	 * which is a better trade than depending on savepoint nesting.
	 */
	newFigure: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const dance = wall.dance;
		const id = lessonOf(params, locals).lesson.id;
		const form = await request.formData();
		const figureName = text(form, 'figureName');
		const name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', DANCES[dance].styles);
		const notes = optionalText(form, 'notes');
		const typed = {
			figureName: String(form.get('figureName') ?? ''),
			name: String(form.get('name') ?? ''),
			notes: String(form.get('notes') ?? '')
		};
		// Each refusal names the field it is about, so the sheet shows it there —
		// the words the Moves sheet uses. Partner and style have no field: a
		// value the form does not offer goes in the sheet's banner.
		const refuse = (message: string, field?: 'figureName' | 'name' | 'notes') =>
			fail(400, { action: 'newFigure' as const, ...(field && { field }), message, ...typed });

		if (!figureName) return refuse('Give the figure a name (up to 200 characters).', 'figureName');
		if (!name) return refuse('Give the variation a name (up to 200 characters).', 'name');
		if (notes === undefined) return refuse('Notes are up to 2000 characters.', 'notes');
		if (partner === undefined || style === undefined) {
			return refuse('Pick how it is danced and its style.');
		}

		const db = getDb();
		// With every field valid, a taken figure name is the one thing
		// `createFigure` still refuses.
		const made = createFigure(db, wall, { figureName, name, partner, style, notes });
		if (!made) {
			return fail(400, {
				action: 'newFigure' as const,
				field: 'figureName' as const,
				message: `There's already a figure called ${figureName}.`,
				figureName,
				name,
				notes: notes ?? ''
			});
		}
		linkFigure(db, id, made.figure.id);
		return { action: 'newFigure', ok: true };
	},

	/*
	 * "Variation of a figure": a blank variation in an existing figure of this
	 * wall, linked straight away. Two calls, for the reason `newFigure` gives.
	 * A posted group id is just a number: one that is missing, archived, of the
	 * other dance or another person's is the wall's 404, and nothing is written.
	 */
	newVariation: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const dance = wall.dance;
		const id = lessonOf(params, locals).lesson.id;
		const form = await request.formData();
		const groupId = int(form, 'groupId');
		const name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', DANCES[dance].styles);
		const notes = optionalText(form, 'notes');
		const typed = {
			groupId: String(form.get('groupId') ?? ''),
			name: String(form.get('name') ?? ''),
			notes: String(form.get('notes') ?? '')
		};
		const refuse = (message: string, field?: 'groupId' | 'name' | 'notes') =>
			fail(400, { action: 'newVariation' as const, ...(field && { field }), message, ...typed });

		if (groupId === undefined) return refuse('Pick a figure.', 'groupId');
		if (!name) return refuse('Give the variation a name (up to 200 characters).', 'name');
		if (notes === undefined) return refuse('Notes are up to 2000 characters.', 'notes');
		if (partner === undefined || style === undefined) {
			return refuse('Pick how it is danced and its style.');
		}

		const db = getDb();
		const group = getGroup(db, groupId);
		if (!group || group.archivedAt !== null || !inWall(group, wall)) {
			throw error(404, 'Figure not found');
		}
		if (variationNameTaken(db, group.id, name, null)) {
			return refuse(
				`${group.name} already has a variation called ${name}. Rename one first.`,
				'name'
			);
		}
		const made = createVariationIn(db, group.id, { name, partner, style, notes });
		// Checked above; only a race with another tab gets here.
		if (!made) throw error(404, 'Figure not found');
		linkFigure(db, id, made.id);
		return { action: 'newVariation', ok: true };
	},

	newExercise: async ({ params, request, locals }) => {
		const id = lessonOf(params, locals).lesson.id;
		const form = await request.formData();
		const name = text(form, 'name');
		const everyDays = int(form, 'everyDays');
		const notes = optionalText(form, 'notes');
		const typed = {
			name: String(form.get('name') ?? ''),
			notes: String(form.get('notes') ?? '')
		};
		const refuse = (message: string, field?: 'name' | 'notes') =>
			fail(400, { action: 'newExercise' as const, ...(field && { field }), message, ...typed });

		if (!name) return refuse('Give it a name (up to 200 characters).', 'name');
		if (notes === undefined) return refuse('Notes are up to 2000 characters.', 'notes');
		if (everyDays === undefined || !isFrequency(everyDays)) {
			return refuse('Pick how often to do it.');
		}

		const db = getDb();
		const exercise = createCustomExercise(db, wallOf(params, locals), { name, everyDays, notes });
		linkExercise(db, id, exercise.id);
		return { action: 'newExercise', ok: true };
	},

	linkFigure: async ({ params, request, locals }) => {
		const id = lessonOf(params, locals).lesson.id;
		const figureId = int(await request.formData(), 'figureId');
		if (figureId === undefined || !linkFigure(getDb(), id, figureId)) {
			return fail(400, { action: 'linkFigure', message: 'That figure could not be linked.' });
		}
		return { action: 'linkFigure', ok: true };
	},

	unlinkFigure: async ({ params, request, locals }) => {
		const id = lessonOf(params, locals).lesson.id;
		const form = await request.formData();
		const figureId = int(form, 'figureId');
		// A row there through a section: its Unlink takes the section links with it.
		const alsoSections = form.get('alsoSections') === '1';
		if (figureId === undefined || !unlinkFigure(getDb(), id, figureId, alsoSections)) {
			return fail(400, { action: 'unlinkFigure', message: 'That figure was already unlinked.' });
		}
		return { action: 'unlinkFigure', ok: true };
	},

	/*
	 * Two calls, not one transaction, for the reason `newFigure` gives. Then
	 * straight to the routine's page: a routine is only a name until its slots
	 * are built, and that page is where they are built.
	 */
	newRoutine: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const dance = wall.dance;
		const id = lessonOf(params, locals).lesson.id;
		const form = await request.formData();
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		const everyDays = int(form, 'everyDays') ?? DEFAULT_EVERY_DAYS;

		const typed = {
			name: String(form.get('name') ?? ''),
			notes: String(form.get('notes') ?? '')
		};
		const refuse = (message: string, field?: 'name' | 'notes') =>
			fail(400, { action: 'newRoutine' as const, ...(field && { field }), message, ...typed });

		if (!name) return refuse('Give the routine a name (up to 200 characters).', 'name');
		if (notes === undefined) return refuse('Notes are up to 2000 characters.', 'notes');
		if (!isFrequency(everyDays)) return refuse('Pick how often to do it.');

		const db = getDb();
		const { routine } = createRoutine(db, wall, { name, notes }, everyDays);
		linkRoutine(db, id, routine.id);
		throw redirect(303, `/${dance}/routines/${routine.id}`);
	},

	linkRoutine: async ({ params, request, locals }) => {
		const id = lessonOf(params, locals).lesson.id;
		const routineId = int(await request.formData(), 'routineId');
		if (routineId === undefined || !linkRoutine(getDb(), id, routineId)) {
			return fail(400, { action: 'linkRoutine', message: 'That routine could not be linked.' });
		}
		return { action: 'linkRoutine', ok: true };
	},

	unlinkRoutine: async ({ params, request, locals }) => {
		const id = lessonOf(params, locals).lesson.id;
		const routineId = int(await request.formData(), 'routineId');
		if (routineId === undefined || !unlinkRoutine(getDb(), id, routineId)) {
			return fail(400, { action: 'unlinkRoutine', message: 'That routine was already unlinked.' });
		}
		return { action: 'unlinkRoutine', ok: true };
	},

	linkExercise: async ({ params, request, locals }) => {
		const id = lessonOf(params, locals).lesson.id;
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

	unlinkExercise: async ({ params, request, locals }) => {
		const id = lessonOf(params, locals).lesson.id;
		const form = await request.formData();
		const exerciseId = int(form, 'exerciseId');
		const alsoSections = form.get('alsoSections') === '1';
		if (exerciseId === undefined || !unlinkExercise(getDb(), id, exerciseId, alsoSections)) {
			return fail(400, {
				action: 'unlinkExercise',
				message: 'That exercise was already unlinked.'
			});
		}
		return { action: 'unlinkExercise', ok: true };
	},

	/** Row first, then file: an orphan file is harmless, a row pointing at nothing is not. */
	deleteVideo: async ({ params, request, locals }) => {
		const found = lessonOf(params, locals);
		const id = int(await request.formData(), 'videoId');
		// Checked against THIS lesson's videos before the delete: the data
		// function deletes by id alone, so an id from another lesson — and so
		// possibly from another wall — would be gone before anyone noticed.
		if (id === undefined || !found.videos.some((v) => v.id === id)) {
			return fail(404, { action: 'deleteVideo', message: 'That video was already removed.' });
		}
		let row;
		try {
			row = deleteLessonVideo(getDb(), id);
		} catch (e) {
			if (e instanceof SpotLinkedError) {
				return fail(409, { action: 'deleteVideo', videoId: id, message: e.message });
			}
			throw e;
		}
		if (!row) {
			return fail(404, { action: 'deleteVideo', message: 'That video was already removed.' });
		}
		await unlink(join(lessonVideosDir(), row.file)).catch(() => {});
		return { action: 'deleteVideo', ok: true };
	},

	addLink: async ({ params, request, locals }) =>
		addLinkFrom(request, getDb(), { lessonId: lessonOf(params, locals).lesson.id }),
	deleteLink: async ({ params, request, locals }) =>
		deleteLinkFrom(request, getDb(), { lessonId: lessonOf(params, locals).lesson.id }),
	saveVideo: async ({ params, request, locals }) =>
		saveVideoFrom(
			request,
			getDb(),
			{ lessonId: lessonOf(params, locals).lesson.id },
			locals.user!.id
		),
	retryVideo: async ({ params, request, locals }) =>
		retryVideoFrom(
			request,
			getDb(),
			{ lessonId: lessonOf(params, locals).lesson.id },
			locals.user!.id
		)
};
