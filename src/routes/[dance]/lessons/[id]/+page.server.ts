import { unlink } from 'node:fs/promises';
import { replayName } from '$lib/server/replay-context';
import { join } from 'node:path';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { t } from '$lib/i18n/catalog';
import { scheduleForShown } from '$lib/server/schedule';
import { defaultStyle } from '$lib/server/default-styles';
import {
	archiveLesson,
	deleteLessonVideo,
	getLesson,
	getLessonRow,
	linkExercise,
	linkFigure,
	linkPosition,
	linkRoutine,
	listLinkableExercises,
	listLinkableFigures,
	listLinkablePositions,
	listLinkableRoutines,
	publishLesson,
	unlinkExercise,
	unlinkFigure,
	unlinkPosition,
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
import { createPosition } from '$lib/server/positions';
import { readNewPosition } from '$lib/server/position-form';
import { addSongFrom, noteSongFrom, removeSongFrom } from '$lib/server/music-form';
import { listMusic, musicChoices } from '$lib/server/song-links';
import { addLinkFrom, deleteLinkFrom, retryVideoFrom, saveVideoFrom } from '$lib/server/link-form';
import { freeDisk } from '$lib/server/storage';
import { listLinks } from '$lib/server/links';
import { lessonVideosDir } from '$lib/server/files';
import { makeMineFrom, makeMineOffer } from '$lib/server/make-mine-form';
import {
	copyToFrom,
	detachFrom,
	dropFrom,
	keepFrom,
	moveToFrom,
	sameAsFrom,
	separateFrom,
	syncFromForm
} from '$lib/server/take-form';
import { moveOffer } from '$lib/server/clones/move';
import { copyOffer } from '$lib/server/clones/copy-to';
import { detachOffer } from '$lib/server/clones/detach';
import { familyView } from '$lib/server/clones/send';
import { keepView, stepStatus } from '$lib/server/clones/step';
import { dropOptions } from '$lib/server/clones/drop';
import { mineTarget } from '$lib/server/mine-target';
import { groupModeFor, listInViewOf } from '$lib/server/group-mode';
import { int, oneOf, optionalText, text } from '$lib/server/form';
import { readAdd } from '$lib/server/add-form';
import {
	addLesson,
	addState,
	entryFor,
	markSeen,
	removeLesson,
	type EntryTarget
} from '$lib/server/entries';
import { inArray } from 'drizzle-orm';
import { exercises } from '$lib/server/db/schema';
import { levelShown, simpleLesson } from '$lib/levels/levels';
import { practiceRows, type PracticeEntry } from '$lib/lessons/page';
import { isValidDay, localDay } from '$lib/day/day';
import { PARTNER } from '$lib/labels';
import { DANCES } from '$lib/dances/dances';
import { getTeam } from '$lib/server/teams';
import { commentsOn } from '$lib/server/comments';
import { lessonNotice } from '$lib/teams/view';
import {
	actorOf,
	inSpace,
	isTeam,
	requireLessonAccess,
	wallOf,
	type Wall
} from '$lib/server/scope';
import { SpotLinkedError, blockingPositionsByVideo, videoSections } from '$lib/server/spot-links';
import { lessonSeen, seenRefusal } from '$lib/server/clash';
import { archivedRefusal, editedBy } from '$lib/server/changes';
import { editedByLine } from '$lib/teams/history';
import { agoText } from '$lib/format';
import { pageSources } from '$lib/server/clones/sources';
import { sameAsOffer } from '$lib/server/twins';
import { flowing, idParam } from '$lib/server/clones/flow-hook';
import { hasCopies } from '$lib/server/clones/genes';
import type { Actions, PageServerLoad } from './$types';
import { serverNow } from '$lib/server/server-clock';

function zone(locals: App.Locals): string {
	if (!locals.user) throw error(401);
	return locals.user.timezone;
}

/**
 * The lesson this URL names, the space it stands in and this person's access,
 * or a 404.
 *
 * `getLesson` is id-scoped, so the guard is the only thing stopping
 * `/salsa/lessons/7` from opening a bachata lesson, another person's, or a
 * group's draft, while the URL claims otherwise. Archived is gone from every
 * list, so it is gone from its own URL too — the same answer the figure page
 * gives. Every action below reaches the row by id, so each one starts here,
 * asking for `edit`: a member who posts gets the stranger's 404.
 */
function lessonIn(
	params: { dance: string; id: string },
	locals: App.Locals,
	need: 'read' | 'edit',
	opts: { copies?: boolean } = {}
) {
	const db = getDb();
	const { lesson, space, access, reach } = requireLessonAccess(db, locals, params, params.id, need);
	const found = getLesson(db, lesson.id, wallOf(params, locals).userId, opts);
	if (!found || found.lesson.archivedAt !== null) throw error(404, t().refusals.noLesson);
	return { ...found, space, access, reach };
}

/** The lesson, to change it: its editors' (or its person's) only. */
function lessonOf(params: { dance: string; id: string }, locals: App.Locals) {
	return lessonIn(params, locals, 'edit');
}

/** The lesson a link action posts to, and who acts (History names them in a group). */
function linkOwner(
	params: { dance: string; id: string },
	locals: App.Locals
): [{ lessonId: number }, string] {
	const { lesson, space } = lessonOf(params, locals);
	return [{ lessonId: lesson.id }, actorOf(space)];
}

/** "Edited by Ana · 10 min ago", or null before History has a line. */
function editedLine(db: ReturnType<typeof getDb>, teamId: number, lessonId: number): string | null {
	const { by, at } = editedBy(db, teamId, 'lesson', lessonId);
	return by === null || at === null ? null : editedByLine(by, agoText(at, serverNow()));
}

/**
 * The simple page's "What you're practising": this person's own live entries
 * from the lesson (the lesson's own, its routines', its drills'), each with
 * when it is next on Today. A row the person has a copy of counts as that copy
 * (`mineId`); a drill of their own lesson is its own entry. Anything that is
 * not theirs and live has no schedule, so `practiceRows` leaves it out.
 */
function practising(
	db: ReturnType<typeof getDb>,
	wall: Wall,
	timeZone: string,
	today: string,
	lessonId: number,
	routines: { id: number; mineId: number | null }[],
	drills: { id: number; mineId: number | null }[]
) {
	const live = (target: EntryTarget) => {
		const row = entryFor(db, wall.userId, target);
		return row && row.archivedAt === null ? row.id : null;
	};
	const picked: { id: number | null; kind: PracticeEntry['kind'] }[] = [
		{ id: live({ lessonId }), kind: 'lesson' },
		...routines.map((r) => ({
			id: live({ routineId: r.mineId ?? r.id }),
			kind: 'routine' as const
		})),
		...drills.map((d) => ({
			id: d.mineId ?? live({ drillId: d.id }) ?? d.id,
			kind: 'drill' as const
		}))
	];
	// One row each: a drill held twice (by hand and through a section) is one entry.
	const kinds = new Map<number, PracticeEntry['kind']>();
	for (const p of picked) if (p.id !== null && !kinds.has(p.id)) kinds.set(p.id, p.kind);
	if (kinds.size === 0) return [];
	const rows = new Map(
		db
			.select({ id: exercises.id, name: exercises.name, active: exercises.active })
			.from(exercises)
			.where(inArray(exercises.id, [...kinds.keys()]))
			.all()
			.map((r) => [r.id, r])
	);
	const entries: PracticeEntry[] = [...kinds].flatMap(([id, kind]) => {
		const row = rows.get(id);
		return row ? [{ id, name: row.name, kind, active: row.active }] : [];
	});
	// Keyed by the person's own ids, so each finds its own schedule (or none).
	const states = scheduleForShown(
		db,
		wall,
		timeZone,
		entries.map((e) => ({ id: e.id }))
	);
	return practiceRows(entries, states, today);
}

export const load: PageServerLoad = ({ params, locals, url }) => {
	const db = getDb();
	const wall = wallOf(params, locals);
	// A group's lesson the person edits is in the group's view (group view spec):
	// its link cards open the group's rows, never the person's copies.
	const row = getLessonRow(db, Number(params.id));
	const inGroupMode =
		row !== null &&
		groupModeFor(db, wall.userId, wall.dance, row.teamId, locals.user?.level) !== null;
	const {
		space,
		access,
		reach: visible,
		...found
	} = lessonIn(params, locals, 'read', {
		copies: !inGroupMode
	});
	const tz = zone(locals);
	const canEdit = access === 'edit';
	const team = isTeam(space) ? getTeam(db, space.teamId) : null;
	// A reader's lists hold only what the published lessons reach (risk 20); an
	// editor's and a person's are the whole space.
	const shown = <T extends { id: number }>(rows: T[], ids: Set<number> | undefined) =>
		ids ? rows.filter((r) => ids.has(r.id)) : rows;
	const today = localDay(serverNow(), tz);
	// The simple page (levels spec): below Everything, except a group's lesson the
	// person edits, which a teacher at any level gets in full.
	const simple = simpleLesson(levelShown(locals.user?.level), access, team !== null);
	return {
		simple,
		/** The simple page's "What you're practising"; only drawn there. */
		practising: simple
			? practising(
					db,
					wall,
					tz,
					today,
					found.lesson.id,
					shown(found.routines, visible?.routines),
					shown(found.exercises, visible?.drills)
				)
			: [],
		...found,
		figures: shown(found.figures, visible?.variations),
		routines: shown(found.routines, visible?.routines),
		exercises: shown(found.exercises, visible?.drills),
		positions: shown(found.positions, visible?.positions),
		canEdit,
		/** A tab per source, the subtitle's facts, and `?vs=` (`clones/sources.ts`). */
		...pageSources(db, wall.userId, 'lesson', found.lesson.id, url, !inGroupMode),
		/** Copies you can see, for the Versions list (`clones/send.ts`). */
		family: familyView(db, wall.userId, 'lesson', found.lesson.id),
		step: stepStatus(db, wall.userId, 'lesson', found.lesson.id),
		/** Keep in step under Versions, and how Sync opens (`clones/step.ts`). */
		keep: keepView(db, wall.userId, 'lesson', found.lesson.id),
		/** Drop my copy (board C5): the person’s own copy, while another version is readable. */
		drop: dropOptions(db, wall, 'lesson', found.lesson.id),
		detach: detachOffer(db, wall.userId, 'lesson', found.lesson.id),
		/** Same as… (board C7): the other lessons in your app; none in a group's workspace. */
		/** Where Mine lands in the group's view (group view spec, rule 6); null: the tab's list. */
		mineHref: inGroupMode ? mineTarget(db, wall, 'lesson', found.lesson.id) : null,
		sameAs: sameAsOffer(db, wall, 'lesson', found.lesson.id, found.lesson.title, inGroupMode),
		/** Copy to… (board C4): your app or a group you own or edit; null when there is none. */
		copyTo: copyOffer(db, wall.userId, 'lesson', found.lesson.id),
		/** Move to… (board C4 p3): your own lesson into a group you own or edit, as a draft. */
		move: moveOffer(db, wall, found.lesson.id),
		// What the edit form saw, sent back with a save (the clash check).
		seen: lessonSeen(found.lesson),
		team: team ? { id: team.id, name: team.name } : null,
		/** "Salsa nadaljevalna is being deleted on 2 Dec", with Make it mine, while the group is deleted. */
		notice: team ? lessonNotice(team, tz) : null,
		/** "Edited by Ana · 10 min ago": the last change to the lesson or anything on it. */
		edited: team ? editedLine(db, team.id, found.lesson.id) : null,
		/** History is its editors'. */
		historyHref:
			team && canEdit ? `/${wall.dance}/groups/${team.id}/history/lesson/${found.lesson.id}` : null,
		/** A group's lesson only its editors see yet. */
		draft: team !== null && found.lesson.publishedAt === null,
		/** The comments card at the page's end: a group's lesson only. */
		comments: team ? commentsOn(db, wall.userId, found.lesson.id, serverNow()) : null,
		/** A reader's Edit: Make it mine, what it costs and moves (ruling 12: Make my own copy). */
		makeMine: canEdit ? null : makeMineOffer(db, wall, 'lesson', found.lesson.id, team),
		// A published group lesson: Add, or once added "1 new drill · Add" and
		// Remove from my lessons. Editors are offered Add like anyone else.
		add:
			team !== null && found.lesson.publishedAt !== null
				? addState(db, wall.userId, found.lesson.id)
				: null,
		sections: Object.fromEntries(
			found.videos.map((v) => [
				v.id,
				videoSections(db, { lessonVideoId: v.id }, visible ?? undefined)
			])
		),
		/** Per video: the positions its sections and points link (they block its delete). An editor's. */
		videoPositions: canEdit
			? blockingPositionsByVideo(
					db,
					found.videos.map((v) => v.id)
				)
			: {},
		// Everything a picker offers is for linking, which a reader never does.
		linkableFigures: canEdit ? listLinkableFigures(db, found.lesson.id) : [],
		// The figures "Variation of a figure" can add to, with their variations' names.
		figureGroups: canEdit ? listMoveTargets(db, space, null) : [],
		linkableRoutines: canEdit ? listLinkableRoutines(db, found.lesson.id) : [],
		linkableExercises: canEdit ? listLinkableExercises(db, found.lesson.id) : [],
		linkablePositions: canEdit ? listLinkablePositions(db, found.lesson.id) : [],
		links: listLinks(db, { lessonId: found.lesson.id }),
		/** Music (spec B): its suggested songs, and what "+ Add" offers an editor. */
		music: listMusic(db, { lessonId: found.lesson.id }, wallOf(params, locals).userId),
		musicChoices: canEdit ? musicChoices(db, space) : [],
		today,
		/** The schedule of each exercise the page shows a due word for: the person's own. */
		schedule: scheduleForShown(db, wall, tz, [
			{ id: found.exercise?.id },
			...shown(found.routines, visible?.routines).map((r) => ({ id: r.exerciseId })),
			...shown(found.exercises, visible?.drills).map((e) => ({ id: e.id, mineId: e.mineId }))
		]),
		// What "Add figure" pre-selects. Settings picks it.
		defaultStyle: defaultStyle(db, wall.userId, wall.dance)
	};
};

/** Every action runs Keep in step's flow from this lesson after it (`flowing`). */
export const actions: Actions = flowing('lesson', (e) => idParam(e.params.id), {
	/**
	 * A save carries what its form saw (`seen`): one that saw something else
	 * since is refused with the other version (409), and one on a lesson
	 * archived since says so (410), so the typed text stays to copy.
	 */
	update: async ({ params, request, locals }) => {
		const db = getDb();
		const { lesson: row } = requireLessonAccess(db, locals, params, params.id, 'edit');
		const id = row.id;
		const today = localDay(serverNow(), zone(locals));
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

		const no = t().lesson.refused;
		if (!title) return refuse(no.title, 'title');
		if (notes === undefined) return refuse(t().moves.refused.notes, 'notes');
		if (!isValidDay(lessonDay)) return refuse(no.day, 'lessonDay');
		if (lessonDay > today) return refuse(no.future, 'lessonDay');

		const stored = getLessonRow(db, id);
		const clash = seenRefusal(
			form,
			{ team: row.teamId !== null, copies: hasCopies(db, 'lesson', id) },
			stored && stored.archivedAt === null ? lessonSeen(stored) : null,
			{ action: 'update' as const, ...entered },
			serverNow(),
			() => editedBy(db, row.teamId, 'lesson', id)
		);
		if (clash) return clash;
		if (!updateLesson(db, id, { lessonDay, title, notes }, wallOf(params, locals).userId)) {
			return fail(404, { action: 'update', message: t().lesson.refused.gone });
		}
		return { action: 'update', ok: true };
	},

	/** A group's draft goes to its members. One tap, nothing to undo but archiving. */
	publish: ({ params, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		// A person's own lesson has nothing to publish: the answer a missing one gets.
		if (!isTeam(space)) throw error(404, t().refusals.noLesson);
		if (!publishLesson(getDb(), space, lesson.id, serverNow())) {
			return fail(400, { action: 'publish', message: t().lesson.refused.published });
		}
		return { action: 'publish', ok: true };
	},

	/**
	 * Add this group lesson to one's own, with the sheet's picks; or, once
	 * added, what came in since. Reading is enough: the entries are the
	 * person's. A personal lesson has nothing to add: the missing one's 404.
	 */
	add: async ({ params, request, locals }) => {
		const { lesson } = lessonIn(params, locals, 'read');
		const { picks } = readAdd(await request.formData());
		const userId = wallOf(params, locals).userId;
		if (!addLesson(getDb(), userId, lesson.id, picks, serverNow())) {
			throw error(404, t().refusals.noLesson);
		}
		return { action: 'add', ok: true };
	},

	/** "Not now": what came into the added lesson stops being new until something else does. */
	notNow: ({ params, locals }) => {
		const { lesson } = lessonIn(params, locals, 'read');
		if (!markSeen(getDb(), wallOf(params, locals).userId, lesson.id, serverNow())) {
			throw error(404, t().refusals.noLesson);
		}
		return { action: 'notNow', ok: true };
	},

	/**
	 * Remove from my lessons: off the Lessons list and its entries off Today,
	 * logs kept, except what another added lesson still holds.
	 */
	remove: async ({ params, locals, request }) => {
		const { lesson } = lessonIn(params, locals, 'read');
		// The simple page's "Added to Today · Undo" stays on the lesson (`stay`).
		const stay = (await request.formData()).get('stay') === '1';
		if (!removeLesson(getDb(), wallOf(params, locals).userId, lesson.id, serverNow())) {
			if (stay) return fail(404, { action: 'remove', message: t().lesson.page.couldNotUndo });
			throw error(404, t().refusals.noLesson);
		}
		if (stay) return { action: 'remove', ok: true };
		throw redirect(303, `/${params.dance}/lessons`);
	},

	/**
	 * Make it mine: the group's lesson and what it holds become this reader's,
	 * the videos charged to them, their practice moved, and the copy opens
	 * (`clones/edit.ts`). One that does not fit says so (413), with Ask for more
	 * when their limit is the reason.
	 */
	makeMine: ({ params, locals }) => {
		const { lesson } = lessonIn(params, locals, 'read');
		return makeMineFrom(getDb(), wallOf(params, locals), 'lesson', lesson.id);
	},

	/** Sync (the Sync sheet, or a reader's Update mine): the merge lands on every ticked copy (`clones/sync.ts`). */
	sync: ({ params, locals, request }) => {
		const { lesson } = lessonIn(params, locals, 'read');
		return syncFromForm(getDb(), locals.user!.id, 'lesson', lesson.id, request);
	},

	/** Keep in step (under Versions): this copy's switch and options (`clones/sync-settings.ts`). */
	keep: ({ params, locals, request }) => {
		const { lesson } = lessonIn(params, locals, 'read');
		return keepFrom(getDb(), locals.user!.id, 'lesson', lesson.id, request);
	},

	/** Drop my copy (board C5): this lesson goes for the class’s, whose page opens. */
	drop: ({ params, locals, request }) => {
		const { lesson } = lessonIn(params, locals, 'read');
		return dropFrom(getDb(), wallOf(params, locals), 'lesson', lesson.id, request);
	},

	/** Detach (board C8): this copy stops following its source. */
	detach: ({ params, locals }) => {
		const { lesson } = lessonIn(params, locals, 'read');
		return detachFrom(getDb(), wallOf(params, locals).userId, 'lesson', lesson.id);
	},

	/** Copy to… (board C4): this lesson into your app or a group you own or edit. */
	copyTo: ({ params, locals, request }) => {
		const { lesson } = lessonIn(params, locals, 'read');
		return copyToFrom(getDb(), wallOf(params, locals), 'lesson', lesson.id, request);
	},

	/** Same as… (board C7): the row's twins become exactly the ticked ones. */
	sameAs: ({ params, locals, request }) => {
		const { lesson } = lessonIn(params, locals, 'read');
		return sameAsFrom(getDb(), wallOf(params, locals), 'lesson', lesson.id, request);
	},

	/** Not the same? Separate (board C7 p2). */
	separate: ({ params, locals }) => {
		const { lesson } = lessonIn(params, locals, 'read');
		return separateFrom(getDb(), wallOf(params, locals), 'lesson', lesson.id);
	},

	/** Move to… (board C4 p3): this lesson into a group as a draft; the group's lesson opens. */
	moveTo: ({ params, locals, request }) => {
		const { lesson } = lessonIn(params, locals, 'read');
		return moveToFrom(getDb(), wallOf(params, locals), lesson.id, request);
	},

	archive: async ({ params, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		if (!archiveLesson(getDb(), lesson.id, serverNow(), actorOf(space))) {
			return fail(400, { action: 'archive', message: t().lesson.refused.archived });
		}
		// Back to the list in the lesson's view: the group's Lessons for a group's.
		throw redirect(
			303,
			listInViewOf(
				getDb(),
				wallOf(params, locals),
				locals.user?.level,
				lesson.teamId,
				`/${params.dance}/lessons`
			)
		);
	},

	/*
	 * `createFigure` opens its own transaction, so the figure and the link are two
	 * sequential calls rather than a nested one. The worst failure is a figure
	 * that exists but is not linked — visible in Figures, fixable with one tap —
	 * which is a better trade than depending on savepoint nesting.
	 */
	newFigure: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		const dance = space.dance;
		const id = lesson.id;
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

		const no = t().moves.refused;
		if (!figureName) return refuse(no.moveName, 'figureName');
		if (!name) return refuse(no.figureName, 'name');
		if (notes === undefined) return refuse(no.notes, 'notes');
		if (partner === undefined || style === undefined) {
			return refuse(no.partnerStyle);
		}

		const db = getDb();
		// With every field valid, a taken figure name is the one thing
		// `createFigure` still refuses.
		const made = createFigure(db, space, { figureName, name, partner, style, notes });
		if (!made) {
			return fail(400, {
				action: 'newFigure' as const,
				field: 'figureName' as const,
				message: t().moves.refused.moveTaken(figureName),
				figureName,
				name,
				notes: notes ?? ''
			});
		}
		linkFigure(db, id, made.figure.id, actorOf(space));
		return { action: 'newFigure', ok: true };
	},

	/*
	 * "Variation of a figure": a blank variation in an existing figure of the
	 * lesson's space (a person's or a group's), linked straight away. Two
	 * calls, for the reason `newFigure` gives.
	 * A posted group id is just a number: one that is missing, archived, of the
	 * other dance or another space's is the wall's 404, and nothing is written.
	 */
	newVariation: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		const dance = space.dance;
		const id = lesson.id;
		const form = await request.formData();
		const groupId = int(form, 'groupId');
		let name = text(form, 'name');
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

		const no = t().moves.refused;
		if (groupId === undefined) return refuse(t().lesson.refused.pickMove, 'groupId');
		if (!name) return refuse(no.figureName, 'name');
		if (notes === undefined) return refuse(no.notes, 'notes');
		if (partner === undefined || style === undefined) {
			return refuse(no.partnerStyle);
		}

		const db = getDb();
		const group = getGroup(db, groupId);
		if (!group || group.archivedAt !== null || !inSpace(group, space)) {
			throw error(404, t().refusals.figureNotFound);
		}
		name = replayName(name, (n) => variationNameTaken(db, group.id, n, null));
		if (variationNameTaken(db, group.id, name, null)) {
			return refuse(t().moves.refused.figureTaken(group.name, name), 'name');
		}
		const made = createVariationIn(db, group.id, { name, partner, style, notes }, actorOf(space));
		// Checked above; only a race with another tab gets here.
		if (!made) throw error(404, t().refusals.figureNotFound);
		linkFigure(db, id, made.id, actorOf(space));
		return { action: 'newVariation', ok: true };
	},

	newExercise: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		const id = lesson.id;
		const form = await request.formData();
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		const typed = {
			name: String(form.get('name') ?? ''),
			notes: String(form.get('notes') ?? '')
		};
		const refuse = (message: string, field?: 'name' | 'notes') =>
			fail(400, { action: 'newExercise' as const, ...(field && { field }), message, ...typed });

		if (!name) return refuse(t().today.refused.name, 'name');
		if (notes === undefined) return refuse(t().moves.refused.notes, 'notes');

		const db = getDb();
		const exercise = createCustomExercise(db, space, { name, notes });
		linkExercise(db, id, exercise.id, actorOf(space));
		return { action: 'newExercise', ok: true };
	},

	linkFigure: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		const figureId = int(await request.formData(), 'figureId');
		const db = getDb();
		if (figureId === undefined || !linkFigure(db, lesson.id, figureId, actorOf(space))) {
			const archived =
				figureId === undefined
					? null
					: archivedRefusal(db, space, { figureId }, { action: 'linkFigure' as const });
			if (archived) return archived;
			return fail(400, { action: 'linkFigure', message: t().lesson.refused.figureLink });
		}
		return { action: 'linkFigure', ok: true };
	},

	unlinkFigure: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		const id = lesson.id;
		const form = await request.formData();
		const figureId = int(form, 'figureId');
		// A row there through a section: its Unlink takes the section links with it.
		const alsoSections = form.get('alsoSections') === '1';
		if (
			figureId === undefined ||
			!unlinkFigure(getDb(), id, figureId, alsoSections, serverNow(), actorOf(space))
		) {
			return fail(400, { action: 'unlinkFigure', message: t().lesson.refused.figureUnlinked });
		}
		return { action: 'unlinkFigure', ok: true };
	},

	/*
	 * Two calls, not one transaction, for the reason `newFigure` gives. Then
	 * straight to the routine's page: a routine is only a name until its slots
	 * are built, and that page is where they are built.
	 */
	newRoutine: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		const dance = space.dance;
		const id = lesson.id;
		const form = await request.formData();
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');

		const typed = {
			name: String(form.get('name') ?? ''),
			notes: String(form.get('notes') ?? '')
		};
		const refuse = (message: string, field?: 'name' | 'notes') =>
			fail(400, { action: 'newRoutine' as const, ...(field && { field }), message, ...typed });

		if (!name) return refuse(t().moves.refused.routineName, 'name');
		if (notes === undefined) return refuse(t().moves.refused.notes, 'notes');

		const db = getDb();
		const { routine } = createRoutine(db, space, { name, notes });
		linkRoutine(db, id, routine.id, actorOf(space));
		throw redirect(303, `/${dance}/routines/${routine.id}`);
	},

	linkRoutine: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		const routineId = int(await request.formData(), 'routineId');
		const db = getDb();
		if (routineId === undefined || !linkRoutine(db, lesson.id, routineId, actorOf(space))) {
			const archived =
				routineId === undefined
					? null
					: archivedRefusal(db, space, { routineId }, { action: 'linkRoutine' as const });
			if (archived) return archived;
			return fail(400, { action: 'linkRoutine', message: t().lesson.refused.routineLink });
		}
		return { action: 'linkRoutine', ok: true };
	},

	unlinkRoutine: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		const id = lesson.id;
		const routineId = int(await request.formData(), 'routineId');
		if (
			routineId === undefined ||
			!unlinkRoutine(getDb(), id, routineId, serverNow(), actorOf(space))
		) {
			return fail(400, { action: 'unlinkRoutine', message: t().lesson.refused.routineUnlinked });
		}
		return { action: 'unlinkRoutine', ok: true };
	},

	addSong: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		return addSongFrom(request, getDb(), space, { lessonId: lesson.id });
	},
	noteSong: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		return noteSongFrom(request, getDb(), space, { lessonId: lesson.id });
	},
	removeSong: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		return removeSongFrom(request, getDb(), space, { lessonId: lesson.id });
	},

	newPosition: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		const read = readNewPosition(await request.formData(), space.dance);
		const typed = { action: 'newPosition' as const, ...read.typed };
		if (!('input' in read)) {
			return fail(400, { ...typed, field: read.field, message: read.message });
		}
		const db = getDb();
		const made = createPosition(db, space, read.input, serverNow());
		if ('field' in made) return fail(400, { ...typed, field: made.field, message: made.message });
		linkPosition(db, lesson.id, made.id, actorOf(space));
		return { action: 'newPosition' as const, ok: true, positionId: made.id };
	},

	linkPosition: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		const positionId = int(await request.formData(), 'positionId');
		const db = getDb();
		if (positionId === undefined || !linkPosition(db, lesson.id, positionId, actorOf(space))) {
			// A group's position archived since the picker opened: "Archived by Ana", Restore.
			const archived =
				positionId === undefined
					? null
					: archivedRefusal(db, space, { positionId }, { action: 'linkPosition' as const });
			if (archived) return archived;
			return fail(400, { action: 'linkPosition', message: t().lesson.refused.positionLink });
		}
		return { action: 'linkPosition', ok: true };
	},

	unlinkPosition: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		const form = await request.formData();
		const positionId = int(form, 'positionId');
		// A row there through a section: its Unlink takes the section links with it.
		const alsoSections = form.get('alsoSections') === '1';
		if (
			positionId === undefined ||
			!unlinkPosition(getDb(), lesson.id, positionId, alsoSections, serverNow(), actorOf(space))
		) {
			return fail(400, {
				action: 'unlinkPosition',
				message: t().lesson.refused.positionUnlinked
			});
		}
		return { action: 'unlinkPosition', ok: true };
	},

	linkExercise: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		const exerciseId = int(await request.formData(), 'exerciseId');
		const db = getDb();
		if (exerciseId === undefined || !linkExercise(db, lesson.id, exerciseId, actorOf(space))) {
			const archived =
				exerciseId === undefined
					? null
					: archivedRefusal(db, space, { exerciseId }, { action: 'linkExercise' as const });
			if (archived) return archived;
			return fail(400, {
				action: 'linkExercise',
				message: t().lesson.refused.exerciseLink
			});
		}
		return { action: 'linkExercise', ok: true };
	},

	unlinkExercise: async ({ params, request, locals }) => {
		const { lesson, space } = lessonOf(params, locals);
		const id = lesson.id;
		const form = await request.formData();
		const exerciseId = int(form, 'exerciseId');
		const alsoSections = form.get('alsoSections') === '1';
		if (
			exerciseId === undefined ||
			!unlinkExercise(getDb(), id, exerciseId, alsoSections, serverNow(), actorOf(space))
		) {
			return fail(400, {
				action: 'unlinkExercise',
				message: t().lesson.refused.exerciseUnlinked
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
			return fail(404, { action: 'deleteVideo', message: t().lesson.refused.videoGone });
		}
		let row;
		try {
			row = deleteLessonVideo(getDb(), id, actorOf(found.space));
		} catch (e) {
			if (e instanceof SpotLinkedError) {
				return fail(409, { action: 'deleteVideo', videoId: id, message: e.message });
			}
			throw e;
		}
		if (!row) {
			return fail(404, { action: 'deleteVideo', message: t().lesson.refused.videoGone });
		}
		// A group's video is in Recently deleted with its file: the purge deletes it (risk 19).
		if (row.trashId === null) await unlink(join(lessonVideosDir(), row.file)).catch(() => {});
		return { action: 'deleteVideo', ok: true };
	},

	addLink: async ({ params, request, locals }) =>
		addLinkFrom(request, getDb(), ...linkOwner(params, locals)),
	deleteLink: async ({ params, request, locals }) =>
		deleteLinkFrom(request, getDb(), ...linkOwner(params, locals)),
	saveVideo: async ({ params, request, locals }) => {
		const [owner, by] = linkOwner(params, locals);
		return saveVideoFrom(request, getDb(), owner, await freeDisk(), by);
	},
	retryVideo: async ({ params, request, locals }) => {
		const [owner, by] = linkOwner(params, locals);
		return retryVideoFrom(request, getDb(), owner, await freeDisk(), by);
	}
} satisfies Actions);
