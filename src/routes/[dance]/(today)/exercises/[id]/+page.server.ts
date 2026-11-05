import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	archiveExercise,
	exerciseHistory,
	exerciseSummary,
	getExercise,
	updateExercise
} from '$lib/server/exercises';
import { checkbox, int, optionalText, text } from '$lib/server/form';
import { addLinkFrom, deleteLinkFrom } from '$lib/server/link-form';
import { deleteSetFrom, logSetFrom, restoreSetFrom } from '$lib/server/log-form';
import { popupData } from '$lib/server/popup';
import { drillPayload, practicePayload } from '$lib/server/practice-content';
import { addLesson, addOffer, drillAddRoute, entryFor } from '$lib/server/entries';
import { fromClassOf } from '$lib/server/from-class';
import { readAdd } from '$lib/server/add-form';
import { getLessonRow } from '$lib/server/lessons';
import { getTeam } from '$lib/server/teams';
import { scheduleStates } from '$lib/server/schedule';
import { requireExerciseAccess, requireExerciseInWall, wallOf } from '$lib/server/scope';
import { linkableSections, linkSpot, SpotLinkError, unlinkSpot } from '$lib/server/spot-links';
import { exerciseSeen, seenRefusal } from '$lib/server/clash';
import { editedBy } from '$lib/server/changes';
import { makeMineFrom, makeMineOffer } from '$lib/server/make-mine-form';
import { copyToFrom, detachFrom, dropFrom, sendFrom, takeFrom } from '$lib/server/take-form';
import { copyOffer } from '$lib/server/clones/copy-to';
import { detachOffer } from '$lib/server/clones/detach';
import { familyView } from '$lib/server/clones/send';
import { dropOptions } from '$lib/server/clones/drop';
import { localDay } from '$lib/day/day';
import type { ExerciseItem } from '$lib/types';
import { pageSources } from '$lib/server/clones/sources';
import type { Actions, PageServerLoad } from './$types';

/** Who acts: History names them on a group's drill. */
const me = (params: { dance: string }, locals: App.Locals) => wallOf(params, locals).userId;

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

/**
 * The exercise this URL names, to link a section or a link to: a person's
 * entry (`'added'`) has none of its own, its group's thing holds them, so it
 * is the missing exercise's 404.
 */
function linkableOf(params: { dance: string; id: string }, locals: App.Locals) {
	const exercise = exerciseOf(params, locals);
	if (exercise.source === 'added') throw error(404, 'No such exercise');
	return exercise;
}

export const load: PageServerLoad = ({ params, locals, url }) => {
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
	// The face times: the schedule as of the START of today, so a second log today
	// previews from the same base (null for an exercise with no live schedule).
	const starts = scheduleStates(db, wall, tz, today);
	const scheduleAtStart = (exerciseId: number) => starts.get(exerciseId) ?? null;

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
			scheduleAtStart: scheduleAtStart(own.id),
			today,
			// Only a drill's sections are its own; the others show their owner's.
			linkable: own.source === 'custom' ? linkableSections(db, { exerciseId: own.id }) : [],
			canEdit: true,
			// What the settings form saw, sent back with a save (the clash check).
			seen: exerciseSeen(own),
			// An entry on a group's thing (its lesson, routine, variation or drill)
			// shows the group's content, which is the group's editors' to change,
			// never the entry's (risk 26). The Log popups follow the same rule.
			canEditContent: popup.exercise.team === null,
			canLog: true,
			/** A drill's tabs per source (none for an entry: it is no family's). */
			...pageSources(db, wall.userId, 'drill', own.id, url),
			family: familyView(db, wall.userId, 'drill', own.id),
			drop: dropOptions(db, wall, 'drill', own.id),
			detach: detachOffer(db, wall.userId, 'drill', own.id),
			/** Copy to… (board C4): your app or a group you own or edit; null when there is none. */
			copyTo: copyOffer(db, wall.userId, 'drill', own.id),
			makeMine: null,
			drill: null,
			historyHref: null,
			add: null,
			// A lesson review's own class (the simple page's "From class …").
			fromClass: fromClassOf(db, wall.userId, own)
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
		createdAt: row.createdAt,
		team: { id: row.teamId, name: getTeam(db, row.teamId)?.name ?? '' }
	};
	// No entry yet: Add, through a lesson that holds the drill (R7). One the
	// person already added takes just this drill; otherwise its sheet opens.
	const route = popup ? null : drillAddRoute(db, wall.userId, row);
	const offer = route && !route.added ? addOffer(db, wall.userId, route.lessonId) : null;
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
		scheduleAtStart: popup ? scheduleAtStart(popup.exercise.id) : null,
		today,
		linkable: canEdit ? linkableSections(db, { exerciseId: row.id }) : [],
		canEdit,
		canEditContent: canEdit,
		/** The drill's History: its editors'. */
		historyHref: canEdit ? `/${wall.dance}/groups/${row.teamId}/history/drill/${row.id}` : null,
		seen: exerciseSeen(row),
		canLog: popup !== null,
		drill: { id: row.id, name: row.name, notes: row.notes },
		...pageSources(db, wall.userId, 'drill', row.id, url),
		/** Copies you can see, the differs banners and Send mine… (`clones/send.ts`). */
		family: familyView(db, wall.userId, 'drill', row.id),
		drop: null,
		detach: detachOffer(db, wall.userId, 'drill', row.id),
		/** Copy to… (board C4): your app or a group you own or edit; null when there is none. */
		copyTo: copyOffer(db, wall.userId, 'drill', row.id),
		/** A reader's Edit: Make it mine (ruling 1: an editor's Edit edits the group's). */
		makeMine: canEdit ? null : makeMineOffer(db, wall, 'drill', row.id, shown.team),
		// A group drill reached through a lesson: that lesson's class, entry or not.
		fromClass: fromClassOf(db, wall.userId, {
			id: row.id,
			teamId: row.teamId,
			lessonId: null,
			drillId: null
		}),
		add: route
			? {
					lessonId: route.lessonId,
					title: getLessonRow(db, route.lessonId)?.title ?? '',
					added: route.added,
					offer
				}
			: null
	};
};

export const actions: Actions = {
	log: (event) => logSetFrom(event),
	deleteSet: (event) => deleteSetFrom(event),
	restoreSet: (event) => restoreSetFrom(event),

	/**
	 * Add on a group drill's page, sheet path: the lesson that holds it, with
	 * the sheet's picks. Reading the drill is enough: the entries are the person's.
	 */
	add: async ({ params, request, locals }) => {
		const { exercise: row } = requireExerciseAccess(getDb(), locals, params, params.id, 'read');
		if (row.teamId === null || row.archivedAt !== null) throw error(404, 'No such exercise');
		const { lessonId, picks } = readAdd(await request.formData());
		const userId = wallOf(params, locals).userId;
		if (lessonId === undefined || !addLesson(getDb(), userId, lessonId, picks, Date.now())) {
			throw error(404, 'No such lesson');
		}
		return { action: 'add', ok: true };
	},

	/** Make it mine: a reader's own copy of this group drill, and its page opens (`clones/edit.ts`). */
	makeMine: ({ params, locals }) => {
		const db = getDb();
		const { exercise: row } = requireExerciseAccess(db, locals, params, params.id, 'read');
		return makeMineFrom(db, wallOf(params, locals), 'drill', row.id);
	},

	/** Take theirs: the compare sheet's picks from another member of the family, in place (`clones/compare.ts`). */
	take: ({ params, locals, request }) => {
		const db = getDb();
		const { exercise: row } = requireExerciseAccess(db, locals, params, params.id, 'read');
		return takeFrom(db, locals.user!.id, 'drill', row.id, request);
	},

	/** Send mine (board C3 p2): this drill's changes into each copy the person edits. */
	send: ({ params, locals, request }) => {
		const db = getDb();
		const { exercise: row } = requireExerciseAccess(db, locals, params, params.id, 'read');
		return sendFrom(db, locals.user!.id, 'drill', row.id, request);
	},

	/** Drop my copy (board C5): this drill goes for another version, whose page opens. */
	drop: ({ params, locals, request }) => {
		const db = getDb();
		const { exercise: row } = requireExerciseAccess(db, locals, params, params.id, 'read');
		return dropFrom(db, wallOf(params, locals), 'drill', row.id, request);
	},

	/** Detach (board C8): this copy stops following its source. */
	detach: ({ params, locals }) => {
		const { exercise: row } = requireExerciseAccess(getDb(), locals, params, params.id, 'read');
		return detachFrom(getDb(), wallOf(params, locals).userId, 'drill', row.id);
	},

	/** Copy to… (board C4): this drill into your app or a group you own or edit. */
	copyTo: ({ params, locals, request }) => {
		const db = getDb();
		const { exercise: row } = requireExerciseAccess(db, locals, params, params.id, 'read');
		return copyToFrom(db, wallOf(params, locals), 'drill', row.id, request);
	},

	/** Add on a group drill's page when a lesson the person added holds it: just this drill. */
	addDrill: ({ params, locals }) => {
		const db = getDb();
		const { exercise: row } = requireExerciseAccess(db, locals, params, params.id, 'read');
		if (row.teamId === null || row.archivedAt !== null) throw error(404, 'No such exercise');
		const userId = wallOf(params, locals).userId;
		const route = drillAddRoute(db, userId, row);
		if (!route || !route.added) throw error(404, 'No such exercise');
		const picks = { lesson: false, routineIds: [], drillIds: [row.id], figureIds: [] };
		if (!addLesson(db, userId, route.lessonId, picks, Date.now(), { touch: false })) {
			throw error(404, 'No such exercise');
		}
		return { action: 'addDrill', ok: true };
	},

	/**
	 * A save carries what its form saw (`seen`): one that saw another version
	 * is refused with it (409); one on an exercise archived since says so (410).
	 */
	update: async ({ params, request, locals }) => {
		const db = getDb();
		const { exercise: row } = requireExerciseAccess(db, locals, params, params.id, 'edit');
		const form = await request.formData();
		const name = text(form, 'name') ?? '';
		// A group's drill is practised through each member's own entry, so
		// whether it is on Today is theirs: its own stays as it is.
		const team = row.teamId !== null;
		const active = team ? row.active : checkbox(form, 'active');
		const notes = optionalText(form, 'notes');
		if (notes === undefined) {
			return fail(400, { action: 'update', message: 'Check the values and try again.' });
		}
		const stored = getExercise(db, row.id);
		const clash = seenRefusal(
			form,
			row.teamId !== null,
			stored && stored.archivedAt === null ? exerciseSeen(stored) : null,
			{ action: 'update' as const },
			Date.now(),
			() => editedBy(db, row.teamId, 'drill', row.id)
		);
		if (clash) return clash;
		if (!updateExercise(db, row.id, { name, notes, active }, me(params, locals))) {
			throw error(404, 'No such exercise');
		}
		return { action: 'update', ok: true };
	},

	archive: ({ params, locals }) => {
		if (!archiveExercise(getDb(), exerciseOf(params, locals).id, Date.now(), me(params, locals))) {
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
		const exerciseId = linkableOf(params, locals).id;
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
		if (
			id === undefined ||
			!unlinkSpot(getDb(), id, { exerciseId }, Date.now(), me(params, locals))
		) {
			return fail(404, { action: 'unlinkSection', message: 'That link was already removed.' });
		}
		return { action: 'unlinkSection', ok: true };
	},

	addLink: async ({ params, request, locals }) =>
		addLinkFrom(
			request,
			getDb(),
			{ exerciseId: linkableOf(params, locals).id },
			me(params, locals)
		),
	deleteLink: async ({ params, request, locals }) =>
		deleteLinkFrom(
			request,
			getDb(),
			{ exerciseId: exerciseOf(params, locals).id },
			me(params, locals)
		)
};
