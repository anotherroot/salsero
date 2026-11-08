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
import { deleteDayFrom, restoreDayFrom, saveDoneFrom } from '$lib/server/log-form';
import { pageData } from '$lib/server/page-data';
import { drillPayload, practicePayload } from '$lib/server/practice-content';
import { addLesson, addOffer, drillAddRoute, entryFor } from '$lib/server/entries';
import { fromClassOf } from '$lib/server/from-class';
import { classLessonOf, commentsOn } from '$lib/server/comments';
import { readAdd } from '$lib/server/add-form';
import { getLessonRow } from '$lib/server/lessons';
import { getTeam } from '$lib/server/teams';
import { doneFacesOf, goodDaysOf, scheduleStates } from '$lib/server/schedule';
import { mergeDay, type DayEntry } from '$lib/exercises/day-entry';
import type { ComesSettings } from '$lib/exercises/comes-back-view';
import {
	requireExerciseAccess,
	requireExerciseInWall,
	spaceOfRow,
	wallOf
} from '$lib/server/scope';
import {
	getSpotLink,
	linkableSections,
	linkSpot,
	SpotLinkError,
	unlinkSpot
} from '$lib/server/spot-links';
import { exerciseSeen, seenRefusal } from '$lib/server/clash';
import { readComesBack, readWarmup } from '$lib/server/comes-back-form';
import { editedBy } from '$lib/server/changes';
import { makeMineFrom, makeMineOffer } from '$lib/server/make-mine-form';
import { copyToFrom, detachFrom, dropFrom, keepFrom, syncFromForm } from '$lib/server/take-form';
import { copyOffer } from '$lib/server/clones/copy-to';
import { detachOffer } from '$lib/server/clones/detach';
import { familyView } from '$lib/server/clones/send';
import { keepView, stepStatus } from '$lib/server/clones/step';
import { dropOptions } from '$lib/server/clones/drop';
import { localDay } from '$lib/day/day';
import { t } from '$lib/i18n/catalog';
import type { ExerciseItem, HistorySet } from '$lib/types';
import { pageSources } from '$lib/server/clones/sources';
import { effectiveComesBack, parseComesBack } from '$lib/schedule/comes-back';
import { flowAfter, flowing, idParam, rootOfSpot } from '$lib/server/clones/flow-hook';
import { hasCopies } from '$lib/server/clones/genes';
import type { Actions, PageServerLoad } from './$types';

type FromClass = ReturnType<typeof fromClassOf>;

/** Who acts: History names them on a group's drill. */
import { addSongFrom, noteSongFrom, removeSongFrom } from '$lib/server/music-form';
import { listMusic, musicChoices } from '$lib/server/song-links';

const me = (params: { dance: string }, locals: App.Locals) => wallOf(params, locals).userId;

/** The history's rows: the latest this many; past it the page says it shows only those. */
const HISTORY_LIMIT = 200;

/**
 * What the one page shows of the person's row or entry: its history (and whether
 * it was cut), the summary, today's entry merged (Done today: the sheet starts
 * from it), and what each face of the Done sheet would set.
 */
function practised(
	db: ReturnType<typeof getDb>,
	id: number,
	today: HistorySet[],
	tz: string,
	now: number
) {
	const history = exerciseHistory(db, id, HISTORY_LIMIT);
	return {
		history,
		historyCut: history.length >= HISTORY_LIMIT,
		summary: exerciseSummary(db, id, tz),
		entryToday: today.length === 0 ? null : mergeDay(today),
		faces: doneFacesOf(db, id, tz, now)
	};
}

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
	/** "Comments on the class": the card for the exercise's group lesson, or null (`classLessonOf`). */
	const commentsFor = (exercise: Parameters<typeof classLessonOf>[2], from: FromClass) => {
		const lessonId = classLessonOf(db, wall.userId, exercise, from);
		return lessonId === null ? null : commentsOn(db, wall.userId, lessonId, now);
	};

	if (row.teamId === null) {
		// The person's own row: the page is its own.
		const own = requireExerciseInWall(db, wall, row.id);
		const rowData = pageData(db, wall, own.id, tz, now);
		if (!rowData) throw error(404, 'No such exercise');
		// Music (spec B): a drill's own; an entry reads its group drill's, never edits it.
		const musicParent =
			own.source === 'custom'
				? { exerciseId: own.id }
				: own.source === 'added' && own.drillId !== null
					? { exerciseId: own.drillId }
					: null;
		const item = rowData.exercise;
		const isDrill = item.source === 'custom' || item.source === 'added';
		const fromClass = fromClassOf(db, wall.userId, own);
		return {
			...rowData,
			comes: isDrill
				? ({
						value: item.comesBack,
						own: item.comesBackOwn,
						teacher: item.comesBackTeacher,
						forClass: false,
						good:
							item.comesBack.kind === 'until'
								? goodDaysOf(db, item.id, item.comesBack.since, tz)
								: 0
					} satisfies ComesSettings)
				: null,
			/** Warm-up is the person's own: every row of theirs has the switch. */
			warmupSwitch: item.warmup as boolean | null,
			music: musicParent ? listMusic(db, musicParent, wall.userId) : [],
			musicChoices: own.source === 'custom' ? musicChoices(db, wall) : [],
			musicShown: musicParent !== null,
			musicEdit: own.source === 'custom',
			musicEntryId: own.id as number | null,
			practice: practicePayload(db, own, tz, now),
			...practised(db, own.id, rowData.sets, tz, now),
			scheduleAtStart: scheduleAtStart(own.id),
			today,
			// Only a drill's sections are its own; the others show their owner's.
			linkable: own.source === 'custom' ? linkableSections(db, { exerciseId: own.id }) : [],
			canEdit: true,
			// What the settings form saw, sent back with a save (the clash check).
			seen: exerciseSeen(own),
			// An entry on a group's thing (its lesson, routine, variation or drill)
			// shows the group's content, which is the group's editors' to change,
			// never the entry's (risk 26). The Done sheet follows the same rule.
			canEditContent: rowData.exercise.team === null,
			canLog: true,
			/** A drill's tabs per source (none for an entry: it is no family's). */
			...pageSources(db, wall.userId, 'drill', own.id, url),
			family: familyView(db, wall.userId, 'drill', own.id),
			step: stepStatus(db, wall.userId, 'drill', own.id),
			/** Keep in step under Versions, and how Sync opens (`clones/step.ts`). */
			keep: keepView(db, wall.userId, 'drill', own.id),
			drop: dropOptions(db, wall, 'drill', own.id),
			detach: detachOffer(db, wall.userId, 'drill', own.id),
			/** Copy to… (board C4): your app or a group you own or edit; null when there is none. */
			copyTo: copyOffer(db, wall.userId, 'drill', own.id),
			makeMine: null,
			drill: null,
			historyHref: null,
			add: null,
			// A lesson review's own class (the simple page's "From class …").
			fromClass,
			comments: commentsFor(own, fromClass)
		};
	}

	// A group's drill: its content, and the log of this person's own entry for
	// it. `pageData` never runs on the group's row, so a set can only ever land
	// on the person's entry (risk 22). Without an entry there is nothing to log.
	const canEdit = access === 'edit';
	const found = entryFor(db, wall.userId, { drillId: row.id });
	const entry = found && found.archivedAt === null ? found : null;
	const rowData = entry ? pageData(db, wall, entry.id, tz, now) : null;
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
		comesBack: effectiveComesBack(row.source, parseComesBack(row.comesBack), null),
		comesBackOwn: parseComesBack(row.comesBack),
		comesBackTeacher: null,
		warmup: false,
		warmupOrder: null,
		team: { id: row.teamId, name: getTeam(db, row.teamId)?.name ?? '' }
	};
	// No entry yet: Add, through a lesson that holds the drill (R7). One the
	// person already added takes just this drill; otherwise its sheet opens.
	const route = rowData ? null : drillAddRoute(db, wall.userId, row);
	const offer = route && !route.added ? addOffer(db, wall.userId, route.lessonId) : null;
	// A group drill reached through a lesson: that lesson's class, entry or not.
	const fromClass = fromClassOf(db, wall.userId, {
		id: row.id,
		teamId: row.teamId,
		lessonId: null,
		drillId: null
	});
	return {
		music: listMusic(db, { exerciseId: row.id }, wall.userId),
		comes: canEdit
			? ({
					value: effectiveComesBack(row.source, parseComesBack(row.comesBack), null),
					own: parseComesBack(row.comesBack),
					teacher: null,
					forClass: true,
					good: null
				} satisfies ComesSettings)
			: null,
		warmupSwitch: null as boolean | null,
		musicChoices: canEdit ? musicChoices(db, spaceOfRow(row, wall.userId)) : [],
		musicShown: true,
		musicEdit: canEdit,
		musicEntryId: (rowData?.exercise.id ?? null) as number | null,
		exercise: rowData?.exercise ?? shown,
		sets: rowData?.sets ?? [],
		songs: rowData?.songs ?? [],
		takes: rowData?.takes ?? [],
		practice: drillPayload(
			db,
			row,
			rowData ? rowData.exercise.id : null,
			tz,
			now,
			visible ?? undefined
		),
		...(rowData
			? practised(db, rowData.exercise.id, rowData.sets, tz, now)
			: {
					history: [] as HistorySet[],
					historyCut: false,
					summary: { times: 0, totalS: 0 },
					entryToday: null as DayEntry | null,
					faces: null
				}),
		scheduleAtStart: rowData ? scheduleAtStart(rowData.exercise.id) : null,
		today,
		linkable: canEdit ? linkableSections(db, { exerciseId: row.id }) : [],
		canEdit,
		canEditContent: canEdit,
		/** The drill's History: its editors'. */
		historyHref: canEdit ? `/${wall.dance}/groups/${row.teamId}/history/drill/${row.id}` : null,
		seen: exerciseSeen(row),
		canLog: rowData !== null,
		drill: { id: row.id, name: row.name, notes: row.notes },
		...pageSources(db, wall.userId, 'drill', row.id, url),
		/** Copies you can see, for the Versions list (`clones/send.ts`). */
		family: familyView(db, wall.userId, 'drill', row.id),
		step: stepStatus(db, wall.userId, 'drill', row.id),
		/** Keep in step under Versions, and how Sync opens (`clones/step.ts`). */
		keep: keepView(db, wall.userId, 'drill', row.id),
		drop: null,
		detach: detachOffer(db, wall.userId, 'drill', row.id),
		/** Copy to… (board C4): your app or a group you own or edit; null when there is none. */
		copyTo: copyOffer(db, wall.userId, 'drill', row.id),
		/** A reader's Edit: Make it mine (ruling 1: an editor's Edit edits the group's). */
		makeMine: canEdit ? null : makeMineOffer(db, wall, 'drill', row.id, shown.team),
		fromClass,
		comments: commentsFor(row, fromClass),
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

/**
 * Every action runs Keep in step's flow from this drill after it (`flowing`;
 * an exercise that is no drill is in no family, so nothing runs); a section's
 * link changes the section's root, so the flow runs from there too.
 */
export const actions: Actions = flowing('drill', (e) => idParam(e.params.id), {
	/**
	 * Done: the day's entry of the posted exercise, the person's own row or their
	 * entry on this group drill (never the group's drill: `saveDoneFrom` checks it
	 * against the wall).
	 */
	done: (event) => saveDoneFrom(event),
	/** A history day's Delete this day, and its Undo. */
	deleteDay: (event) => deleteDayFrom(event),
	restoreDay: (event) => restoreDayFrom(event),

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

	/** Sync (the Sync sheet, or a reader's Update mine): the merge lands on every ticked copy (`clones/sync.ts`). */
	sync: ({ params, locals, request }) => {
		const db = getDb();
		const { exercise: row } = requireExerciseAccess(db, locals, params, params.id, 'read');
		return syncFromForm(db, locals.user!.id, 'drill', row.id, request);
	},

	/** Keep in step (under Versions): this copy's switch and options (`clones/sync-settings.ts`). */
	keep: ({ params, locals, request }) => {
		const db = getDb();
		const { exercise: row } = requireExerciseAccess(db, locals, params, params.id, 'read');
		return keepFrom(db, locals.user!.id, 'drill', row.id, request);
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
			return fail(400, { action: 'update', message: t().exercise.refused.checkValues });
		}
		const stored = getExercise(db, row.id);
		const clash = seenRefusal(
			form,
			row.teamId !== null || hasCopies(db, 'drill', row.id),
			stored && stored.archivedAt === null ? exerciseSeen(stored) : null,
			{ action: 'update' as const },
			Date.now(),
			() => editedBy(db, row.teamId, 'drill', row.id)
		);
		if (clash) return clash;
		const comesBack = readComesBack(form, parseComesBack(row.comesBack), Date.now());
		if (comesBack === 'invalid') {
			return fail(400, { action: 'update', message: t().exercise.refused.checkValues });
		}
		// Warm-up is the person's own: a group's drill never takes it. No field keeps.
		const warmup = team ? undefined : readWarmup(form);
		if (
			!updateExercise(db, row.id, { name, notes, active, warmup, comesBack }, me(params, locals))
		) {
			throw error(404, 'No such exercise');
		}
		return { action: 'update', ok: true };
	},

	archive: ({ params, locals }) => {
		if (!archiveExercise(getDb(), exerciseOf(params, locals).id, Date.now(), me(params, locals))) {
			return fail(400, {
				action: 'archive',
				message: t().exercise.refused.archiveHere
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
			return fail(400, { action: 'linkSection', message: t().exercise.refused.pickSection });
		}
		try {
			linkSpot(getDb(), wallOf(params, locals).userId, spotId, { exerciseId });
		} catch (e) {
			if (e instanceof SpotLinkError) {
				return fail(e.status, { action: 'linkSection', message: e.message });
			}
			throw e;
		}
		const root = rootOfSpot(getDb(), spotId);
		if (root) await flowAfter(locals.user?.id, root.kind, root.id);
		return { action: 'linkSection', ok: true };
	},

	unlinkSection: async ({ params, request, locals }) => {
		const exerciseId = exerciseOf(params, locals).id;
		const id = int(await request.formData(), 'linkId');
		// Read before the unlink: the link names its section.
		const link = id === undefined ? null : getSpotLink(getDb(), id);
		if (
			id === undefined ||
			!unlinkSpot(getDb(), id, { exerciseId }, Date.now(), me(params, locals))
		) {
			return fail(404, { action: 'unlinkSection', message: t().exercise.refused.linkGone });
		}
		const root = link ? rootOfSpot(getDb(), link.spotId) : null;
		if (root) await flowAfter(locals.user?.id, root.kind, root.id);
		return { action: 'unlinkSection', ok: true };
	},

	addSong: async ({ params, request, locals }) => {
		const drill = linkableOf(params, locals);
		return addSongFrom(request, getDb(), spaceOfRow(drill, me(params, locals)), {
			exerciseId: drill.id
		});
	},
	noteSong: async ({ params, request, locals }) => {
		const drill = linkableOf(params, locals);
		const space = spaceOfRow(drill, me(params, locals));
		return noteSongFrom(request, getDb(), space, { exerciseId: drill.id });
	},
	removeSong: async ({ params, request, locals }) => {
		const drill = linkableOf(params, locals);
		const space = spaceOfRow(drill, me(params, locals));
		return removeSongFrom(request, getDb(), space, { exerciseId: drill.id });
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
} satisfies Actions);
