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
import {
	createFigure,
	createVariationIn,
	getGroup,
	listMoveTargets,
	listVersions,
	variationNameTaken
} from '$lib/server/figures';
import { createCustomExercise, listExercises } from '$lib/server/exercises';
import { createRoutine } from '$lib/server/routines';
import { addLinkFrom, deleteLinkFrom, retryVideoFrom, saveVideoFrom } from '$lib/server/link-form';
import { listLinks } from '$lib/server/links';
import { lessonVideosDir } from '$lib/server/files';
import { int, oneOf, optionalText, text } from '$lib/server/form';
import { deleteSetFrom, logSetFrom } from '$lib/server/log-form';
import { popupData } from '$lib/server/popup';
import { isValidDay, localDay } from '$lib/day/day';
import { DEFAULT_EVERY_DAYS, isFrequency } from '$lib/frequency';
import { PARTNER } from '$lib/labels';
import { DANCES } from '$lib/dances/dances';
import { danceOf } from '$lib/server/scope';
import {
	getSpotLink,
	linkSpot,
	SpotLinkedError,
	SpotLinkError,
	targetFrom,
	unlinkSpot,
	videoOfSpot,
	videoSections
} from '$lib/server/spot-links';
import type { SectionTargets } from '$lib/types';
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

/**
 * The spot, if it is on one of THIS lesson's videos; else null. A posted id is
 * just a number, and `linkSpot` / `unlinkSpot` reach the row by id alone.
 */
function spotOfLesson(found: ReturnType<typeof lessonOf>, spotId: number | undefined) {
	if (spotId === undefined) return null;
	const video = videoOfSpot(getDb(), spotId);
	if (!video || !('lessonVideoId' in video.owner)) return null;
	const { lessonVideoId } = video.owner;
	return found.videos.some((v) => v.id === lessonVideoId) ? spotId : null;
}

/** What a section can be linked to: this lesson's figures and drills first, then the dance's. */
function sectionTargets(found: ReturnType<typeof lessonOf>): SectionTargets {
	const db = getDb();
	const dance = danceOf({ dance: found.lesson.dance });
	const taught = new Set(found.figures.map((f) => f.id));
	const versions = listVersions(db, dance);
	const drills = listExercises(db, dance)
		.filter((e) => e.source === 'custom')
		.sort((a, b) => a.name.localeCompare(b.name));
	const ownDrills = new Set(found.exercises.map((e) => e.id));
	const figure = (v: { id: number; label: string }) => ({
		value: `figure:${v.id}`,
		label: v.label
	});
	const drill = (d: { id: number; name: string }) => ({ value: `exercise:${d.id}`, label: d.name });
	const isTaught = (v: { id: number }) => taught.has(v.id);
	return {
		thisLesson: [
			...versions.filter(isTaught).map(figure),
			...drills.filter((d) => ownDrills.has(d.id)).map(drill)
		],
		figures: versions.filter((v) => !isTaught(v)).map(figure),
		drills: drills.filter((d) => !ownDrills.has(d.id)).map(drill)
	};
}

export const load: PageServerLoad = ({ params, locals }) => {
	const db = getDb();
	const found = lessonOf(params);
	const tz = zone(locals);
	return {
		...found,
		sections: Object.fromEntries(
			found.videos.map((v) => [v.id, videoSections(db, { lessonVideoId: v.id })])
		),
		sectionTargets: sectionTargets(found),
		linkableFigures: listLinkableFigures(db, found.lesson.id),
		// The figures "Variation of a figure" can add to, with their variations' names.
		figureGroups: listMoveTargets(db, danceOf(params), null),
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
		const figureName = text(form, 'figureName');
		const name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', DANCES[dance].styles);
		const notes = optionalText(form, 'notes');

		if (
			!figureName ||
			!name ||
			partner === undefined ||
			style === undefined ||
			notes === undefined
		) {
			return fail(400, {
				action: 'newFigure',
				message: 'Give the figure and the variation a name (up to 200 characters).',
				figureName: String(form.get('figureName') ?? ''),
				name: String(form.get('name') ?? ''),
				notes: String(form.get('notes') ?? '')
			});
		}

		const db = getDb();
		// With every field valid, a taken figure name is the one thing
		// `createFigure` still refuses.
		const made = createFigure(db, dance, { figureName, name, partner, style, notes });
		if (!made) {
			return fail(400, {
				action: 'newFigure',
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
	 * dance, linked straight away. Two calls, for the reason `newFigure` gives.
	 * A posted group id is just a number: one that is missing, archived or of
	 * the other dance is the dance wall's 404, and nothing is written.
	 */
	newVariation: async ({ params, request }) => {
		const dance = danceOf(params);
		const id = lessonOf(params).lesson.id;
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
		const refuse = (message: string) =>
			fail(400, { action: 'newVariation' as const, message, ...typed });

		if (groupId === undefined) return refuse('Pick a figure.');
		if (!name || partner === undefined || style === undefined || notes === undefined) {
			return refuse('Give the variation a name (up to 200 characters).');
		}

		const db = getDb();
		const group = getGroup(db, groupId);
		if (!group || group.archivedAt !== null || group.dance !== dance) {
			throw error(404, 'Figure not found');
		}
		if (variationNameTaken(db, group.id, name, null)) {
			return refuse(`${group.name} already has a variation called ${name}. Rename one first.`);
		}
		const made = createVariationIn(db, group.id, { name, partner, style, notes });
		// Checked above; only a race with another tab gets here.
		if (!made) throw error(404, 'Figure not found');
		linkFigure(db, id, made.id);
		return { action: 'newVariation', ok: true };
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

	linkSection: async ({ params, request }) => {
		const found = lessonOf(params);
		const form = await request.formData();
		const spotId = spotOfLesson(found, int(form, 'spotId'));
		if (spotId === null) {
			return fail(404, { action: 'linkSection', message: 'That section is gone.' });
		}
		const target = targetFrom(text(form, 'target'));
		if (!target) {
			return fail(400, { action: 'linkSection', spotId, message: 'Pick a figure or a drill.' });
		}
		try {
			linkSpot(getDb(), spotId, target);
		} catch (e) {
			if (e instanceof SpotLinkError) {
				return fail(e.status, { action: 'linkSection', spotId, message: e.message });
			}
			throw e;
		}
		return { action: 'linkSection', ok: true };
	},

	/** Any link of a section on this lesson's videos — archived targets included, which only this page can reach. */
	unlinkSection: async ({ params, request }) => {
		const found = lessonOf(params);
		const id = int(await request.formData(), 'linkId');
		const link = id === undefined ? null : getSpotLink(getDb(), id);
		if (!link || spotOfLesson(found, link.spotId) === null) {
			return fail(404, { action: 'unlinkSection', message: 'That link was already removed.' });
		}
		unlinkSpot(getDb(), link.id, link.target);
		return { action: 'unlinkSection', ok: true };
	},

	addLink: async ({ params, request }) =>
		addLinkFrom(request, getDb(), { lessonId: lessonOf(params).lesson.id }),
	deleteLink: async ({ params, request }) =>
		deleteLinkFrom(request, getDb(), { lessonId: lessonOf(params).lesson.id }),
	saveVideo: async ({ params, request }) =>
		saveVideoFrom(request, getDb(), { lessonId: lessonOf(params).lesson.id }),
	retryVideo: async ({ params, request }) =>
		retryVideoFrom(request, getDb(), { lessonId: lessonOf(params).lesson.id })
};
