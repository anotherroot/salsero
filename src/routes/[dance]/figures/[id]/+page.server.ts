import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb, type Db } from '$lib/server/db';
import { addedReach } from '$lib/server/access';
import {
	addFigureExercise,
	archiveVariation,
	createVariationFrom,
	deleteRecording,
	figureLabels,
	figureNameTaken,
	getFigure,
	getGroup,
	listGroupVariations,
	listMoveTargets,
	moveVariation,
	type MoveResult,
	renameFigure,
	updateVariation,
	variationNameTaken
} from '$lib/server/figures';
import { recordingsDir } from '$lib/server/files';
import { int, ints, oneOf, optionalText, refusalText, text } from '$lib/server/form';
import { buildGraph, figurePositions, graphFor, setFigureShape } from '$lib/server/graph';
import { teamRefs } from '$lib/server/usable';
import { groupModeOf } from '$lib/server/group-mode';
import type { Cookies } from '@sveltejs/kit';
import { lessonAdds } from '$lib/server/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import {
	DEFAULT_LENGTH_COUNTS,
	DEFAULT_START_COUNT,
	isLengthCounts,
	isStartCount,
	MAX_LENGTH_COUNTS
} from '$lib/graph/timing';
import { deleteSetFrom, logSetFrom, restoreSetFrom } from '$lib/server/log-form';
import { getPosition, listPositions, neutralPosition } from '$lib/server/positions';
import { addLinkFrom, deleteLinkFrom, retryVideoFrom, saveVideoFrom } from '$lib/server/link-form';
import { freeDisk } from '$lib/server/storage';
import { listLinks } from '$lib/server/links';
import { taughtIn } from '$lib/server/lessons';
import { popupData } from '$lib/server/popup';
import { exerciseHistory } from '$lib/server/exercises';
import { listRoutines, routineShapes } from '$lib/server/routines';
import { routinesUsing } from '$lib/routines/coverage';
import { practiceLine } from '$lib/figures/page';
import { plan } from '$lib/urgency/urgency';
import { endOf, figureById, follows, precedes, startsOf } from '$lib/graph/graph';
import { PARTNER } from '$lib/labels';
import { DANCES } from '$lib/dances/dances';
import { inSpace, requireFigureAccess, wallOf } from '$lib/server/scope';
import {
	getSpotLink,
	linkableSections,
	linkSpot,
	sectionsFor,
	SpotLinkedError,
	SpotLinkError,
	unlinkSpot,
	videoOfSpot,
	videoSections
} from '$lib/server/spot-links';
import { seenRefusal, variationSeen } from '$lib/server/clash';
import { editedBy } from '$lib/server/changes';
import { makeMineFrom, makeMineOffer } from '$lib/server/make-mine-form';
import { sendFrom, takeFrom } from '$lib/server/take-form';
import { familyView } from '$lib/server/clones/send';
import { genesHeld, sourcesView, takeRecording } from '$lib/server/clones/sources';
import { ALREADY_IN_YOURS, RECORDING_GONE } from '$lib/clones/view';
import { realCloneFiles } from '$lib/server/clones/files';
import type { SiblingSummary } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

/** Who acts: History names them on a group's figure. */
const me = (params: { dance: string }, locals: App.Locals) => wallOf(params, locals).userId;

function variationId(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id)) throw error(404, 'Figure not found');
	return id;
}

function zoneOf(locals: App.Locals): string {
	if (!locals.user) throw error(401);
	return locals.user.timezone;
}

/**
 * The VARIATION this URL names, with its figure, its space and this person's
 * access, or a 404.
 *
 * `getFigure` is id-scoped, so nothing but this stops `/salsa/figures/7` from
 * rendering a bachata variation, another person's, or a variation only a
 * group's draft holds. An archived variation, or one whose figure is gone, has
 * no page either: every action goes through here, so none of them can write to
 * one. Changing asks for `edit`, so a member who posts gets the stranger's 404.
 */
function variationOf(
	params: { dance: string; id: string },
	locals: App.Locals,
	need: 'read' | 'edit' = 'edit'
) {
	const db = getDb();
	const { space, access, reach } = requireFigureAccess(
		db,
		locals,
		params,
		variationId(params.id),
		need
	);
	const found = getFigure(db, variationId(params.id), wallOf(params, locals).userId);
	if (!found || found.figure.archivedAt !== null || found.figure.groupId === null) {
		throw error(404, 'Figure not found');
	}
	const group = getGroup(db, found.figure.groupId);
	if (!group || group.archivedAt !== null || !inSpace(group, space)) {
		throw error(404, 'Figure not found');
	}
	return { ...found, group, space, access, reach };
}

/**
 * Whether this person may turn on their own entry for the variation: always
 * for their own; for a group's, only while a lesson they added holds it
 * (ruling R8, editors included), since that is what keeps an entry live.
 */
function practisable(db: Db, userId: string, figure: { id: number; teamId: number | null }) {
	return figure.teamId === null || addedReach(db, userId, figure.teamId).variations.has(figure.id);
}

const NOT_ADDED = 'Add a lesson with this figure to practise it.';

const taken = (figure: string, name: string) =>
	`${figure} already has a figure called ${name}. Rename one first.`;
const figureTaken = (name: string) => `There's already a move called ${name}.`;

export const load: PageServerLoad = ({ params, url, locals, cookies }) => {
	const now = Date.now();
	const wall = wallOf(params, locals);
	const dance = wall.dance;

	// An old link — `/figures/<base>?v=<variation>`, from before a variation had
	// a page of its own — lands on the variation. If that id is bad, its page
	// is the 404, which is also where an other-dance or archived one ends up.
	const v = url.searchParams.get('v');
	if (v !== null) {
		const id = variationId(v);
		throw redirect(303, `/${dance}/figures/${id}`);
	}

	const db = getDb();
	const found = variationOf(params, locals, 'read');
	const { figure, group, space, access, reach: visible } = found;
	const id = figure.id;
	const canEdit = access === 'edit';
	// A reader's lists hold only what the published lessons reach (risk 20):
	// a draft's variation, lesson, routine or section never reaches the page.
	const seen = (ids: Set<number> | undefined, of: number) => !ids || ids.has(of);

	const graph = buildGraph(db, space);
	const node = figureById(graph, id);
	const labels = figureLabels(db, space);
	// The graph holds live variations of live figures only, never this one's self.
	const link = (ids: number[]) =>
		ids
			.filter((other) => other !== id && seen(visible?.variations, other))
			.map((other) => ({ id: other, name: labels.get(other)! }));

	const tags = figurePositions(db, id);
	const live = listPositions(db, dance);
	const liveIds = new Set(live.map((p) => p.id));
	// An archived position stays referenced by the variations tagged with it
	// (the routines design doc's rule): if THIS one points at one, splice it back
	// into the list the pickers render — after the live rows, flagged — so a
	// Save that touches nothing else does not silently drop it.
	// `setFigureShape` accepts an archived id back; this is what lets the page
	// resubmit it.
	const taggedIds = [...tags.startIds, ...(tags.endId === null ? [] : [tags.endId])];
	const archivedTagged = [...new Set(taggedIds)]
		.filter((p) => !liveIds.has(p))
		.map((p) => getPosition(db, p))
		.filter((p): p is NonNullable<typeof p> => p !== null && p.dance === dance);

	const shape = {
		startCount: figure.startCount ?? DEFAULT_START_COUNT,
		lengthCounts: figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS
	};

	// Every live variation of the figure, this one included, as its sheet lists
	// them: what each starts and ends on, neutral named, and its timing.
	const positionName = new Map(
		[...live, ...archivedTagged].map((p) => [p.id, p.name] as [number, string])
	);
	const neutralName = neutralPosition(db, dance)?.name ?? 'the neutral hold';
	const nameOf = (p: number) => {
		if (p === graph.neutral) return neutralName;
		if (!positionName.has(p)) positionName.set(p, getPosition(db, p)?.name ?? 'a removed hold');
		return positionName.get(p)!;
	};
	const siblings: SiblingSummary[] = listGroupVariations(db, group.id)
		.filter((s) => seen(visible?.variations, s.id))
		.map((s) => {
			const n = figureById(graph, s.id);
			const starts = n ? [...startsOf(graph, n)].sort((a, b) => a - b) : [graph.neutral];
			const end = n ? endOf(graph, n) : graph.neutral;
			return {
				id: s.id,
				name: s.name,
				holds: `${starts.map(nameOf).join(' / ')} → ${nameOf(end)}`,
				timing: `Starts on ${n?.start ?? DEFAULT_START_COUNT} · ${n?.length ?? DEFAULT_LENGTH_COUNTS} counts`,
				videos:
					s.id === id
						? found.recordings.length
						: (getFigure(db, s.id, wall.userId)?.recordings.length ?? 0)
			};
		});

	// A group's figure: who owns it, which added lesson brought it, and the
	// person's OWN routines that use it (their wall, their graph, their shapes).
	const groupTeam =
		figure.teamId === null ? null : (teamRefs(db, [figure.teamId]).get(figure.teamId) ?? null);
	// In this group's own workspace the page is the group's alone: no one's own
	// sections or routines. Read-only on the cookie: a load never sets or deletes it.
	const inGroupMode =
		figure.teamId !== null &&
		groupModeOf(db, wall.userId, wall.dance, {
			get: (name: string) => cookies?.get(name),
			delete: () => {}
		} as unknown as Cookies)?.teamId === figure.teamId;
	let fromLesson: string | null = null;
	let myRoutines: ReturnType<typeof routinesUsing> = [];
	if (groupTeam && !inGroupMode) {
		const holding = taughtIn(db, space, id).filter((l) => seen(visible?.lessons, l.id));
		const added = new Set(
			holding.length === 0
				? []
				: db
						.select({ lessonId: lessonAdds.lessonId })
						.from(lessonAdds)
						.where(
							and(
								eq(lessonAdds.userId, wall.userId),
								inArray(
									lessonAdds.lessonId,
									holding.map((l) => l.id)
								)
							)
						)
						.all()
						.map((r) => r.lessonId)
		);
		fromLesson = holding.find((l) => added.has(l.id))?.title ?? null;
		myRoutines = routinesUsing(
			graphFor(db, wall),
			id,
			routineShapes(db, wall),
			listRoutines(db, wall)
		);
	}

	// A tab per source; opened from the person's copy (`?vs=`), the source's
	// recordings say which are already in it, and Take brings the others.
	const versions = sourcesView(db, wall.userId, 'figure', id, url.searchParams.get('vs'));
	const held = versions.vs === null ? null : genesHeld(db, versions.vs);

	const zone = zoneOf(locals);
	const popup = found.exercise ? popupData(db, wall, found.exercise.id, zone, now) : null;

	return {
		figure: { id: group.id, name: group.name },
		variation: {
			id,
			name: figure.name,
			partner: figure.partner,
			styleTag: figure.styleTag,
			notes: figure.notes,
			recordings: found.recordings,
			sections: sectionsFor(
				db,
				{ figureId: id },
				visible ?? undefined,
				inGroupMode ? undefined : wall.userId
			),
			// Each recording's own sections and what they link to, so a link can be
			// undone even when its target is archived and has no page.
			recordingSections: Object.fromEntries(
				found.recordings.map((r) => [
					r.id,
					videoSections(db, { recordingId: r.id }, visible ?? undefined)
				])
			)
		},
		siblings,
		canEdit,
		/** The family and twins the person reads, as tabs; empty for fewer than two. */
		sources: versions.sources,
		/** What the band's subtitle says of where this row comes from (`cloneSubtitle`). */
		cloneLine: versions.line,
		mineId: versions.mineId,
		/** The banner over your copy when its group's source moved: "… changed it since you took it · Compare". */
		compare: versions.compare,
		/** Copies you can see, the differs banners and Send mine… (`clones/send.ts`). */
		family: familyView(db, wall.userId, 'figure', id),
		/**
		 * Opened from the person's copy: Take brings a recording into it (`into`),
		 * and `held` marks the recordings already there.
		 */
		taking: held
			? {
					into: versions.vs!,
					held: Object.fromEntries(
						found.recordings.map((r) => [r.id, r.geneId !== null && held.has(r.geneId)])
					) as Record<number, boolean>
				}
			: null,
		/** A group's figure, for a reader: whose it is (the band and the note). */
		team: groupTeam,
		/** The newest lesson of this group's the reader added that holds it. */
		fromLesson,
		/** The reader's OWN routines that use it, over their own wall. */
		myRoutines,
		/** A reader's Edit: Make it mine (ruling 1: an editor's Edit edits the group's). */
		makeMine: canEdit ? null : makeMineOffer(db, wall, 'figure', id, groupTeam),
		/** A group figure's History (the whole figure, every variation): its editors'. */
		historyHref:
			canEdit && group.teamId !== null
				? `/${space.dance}/groups/${group.teamId}/history/figure/${group.id}`
				: null,
		// What the edit form saw, sent back with a save (the clash check).
		seen: variationSeen(db, id),
		exercise: found.exercise,
		// Practise on its own: a group's variation only from a lesson the person added.
		practisable: practisable(db, wall.userId, figure),
		popup,
		// Derived per request, never stored — the same rule urgency follows.
		routines: routinesUsing(
			graph,
			id,
			routineShapes(db, space),
			listRoutines(db, space).filter((r) => seen(visible?.routines, r.id))
		),
		practice: popup
			? practiceLine(
					plan(
						[popup.exercise],
						exerciseHistory(db, popup.exercise.id, 50).map((s) => ({
							exerciseId: popup.exercise.id,
							doneAt: s.doneAt
						})),
						now,
						zone
					)
				)
			: null,
		positions: [
			...live.map((p) => ({ id: p.id, name: p.name, neutral: p.neutral, archived: false })),
			...archivedTagged.map((p) => ({
				id: p.id,
				name: p.name,
				neutral: p.neutral,
				archived: true
			}))
		],
		tags,
		// What the edit form shows.
		shape,
		// What is actually danced, with neutral resolved.
		effective: {
			starts: node ? startsOf(graph, node) : [],
			end: node ? endOf(graph, node) : null,
			startCount: node?.start ?? shape.startCount,
			lengthCounts: node?.length ?? shape.lengthCounts
		},
		// Derived per request, never stored — the same rule urgency follows.
		leadsTo: link(follows(graph, id)),
		followsFrom: link(precedes(graph, id)),
		links: listLinks(db, { figureId: id }),
		taughtIn: taughtIn(db, space, id).filter((l) => seen(visible?.lessons, l.id)),
		// What linking and Move… offer: an editor's only.
		linkable: canEdit ? linkableSections(db, { figureId: id }) : [],
		moveTargets: canEdit ? listMoveTargets(db, space, group.id) : []
	};
};

export const actions: Actions = {
	/**
	 * The page's one Save: the figure's name, the variation's details, its
	 * positions and its timing together.
	 *
	 * Every refusal comes before any write. The names are checked first; then
	 * `setFigureShape` runs, because it is the half that can still refuse — a
	 * position of another dance — and only then the details and the figure's
	 * name. A refused save leaves nothing half-done.
	 */
	update: async ({ params, request, locals }) => {
		const db = getDb();
		// Not `variationOf` yet: a variation archived since gets its own answer
		// below (gone, the typed text kept to copy), not the page's 404.
		const { figure: row, space } = requireFigureAccess(
			db,
			locals,
			params,
			variationId(params.id),
			'edit'
		);
		const form = await request.formData();
		const figureName = text(form, 'figureName');
		const name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', DANCES[space.dance].styles);
		const notes = optionalText(form, 'notes');
		const startIds = ints(form, 'startIds');
		const rawEnd = String(form.get('endId') ?? '');
		const endId = rawEnd === '' ? null : Number(rawEnd);
		const startCount = int(form, 'startCount');
		const lengthCounts = int(form, 'lengthCounts');

		if (!figureName || !name || !partner || !style || notes === undefined) {
			return fail(400, {
				action: 'update',
				message: 'Give the move and the figure a name (up to 200 characters).'
			});
		}
		if (endId !== null && !Number.isInteger(endId)) {
			return fail(400, { action: 'update', message: 'Pick an end position.' });
		}
		if (!isStartCount(startCount) || !isLengthCounts(lengthCounts)) {
			return fail(400, {
				action: 'update',
				message: `A figure starts on a count from 1 to 8 and takes 1 to ${MAX_LENGTH_COUNTS} counts.`
			});
		}

		// The clash check, before any write: a save that saw another version
		// of the variation or its figure's name is refused with theirs.
		const clash = seenRefusal(
			form,
			row.teamId !== null,
			variationSeen(db, row.id),
			{ action: 'update' as const },
			Date.now(),
			() => editedBy(db, row.teamId, 'figure', row.groupId ?? 0)
		);
		if (clash) return clash;
		const { figure, group } = variationOf(params, locals);
		const by = me(params, locals);
		if (figureNameTaken(db, space, figureName, group.id)) {
			return fail(400, { action: 'update', message: figureTaken(figureName) });
		}
		if (variationNameTaken(db, group.id, name, figure.id)) {
			return fail(400, { action: 'update', message: taken(group.name, name) });
		}
		// A posted position id is just a number: `setFigureShape` rejects one from
		// the other dance, and that is a 404 rather than a message, the same answer
		// every other cross-dance id gets here.
		if (!setFigureShape(db, figure.id, { startIds, endId, startCount, lengthCounts }, by)) {
			throw error(404, 'Figure not found');
		}
		if (!updateVariation(db, figure.id, { name, partner, style, notes }, by)) {
			throw error(404, 'Figure not found');
		}
		// A case-only change ("enchufla") is a change: the figure keeps its place,
		// `figureNameTaken` skipped it above, and the new spelling is saved.
		if (figureName !== group.name.trim() && !renameFigure(db, group.id, figureName, by)) {
			return fail(400, { action: 'update', message: figureTaken(figureName) });
		}
		return { action: 'update', ok: true };
	},

	/** "+ New variation": a copy of this one under a new name, opened. */
	createVariation: async ({ params, request, locals }) => {
		const { figure, group } = variationOf(params, locals);
		const form = await request.formData();
		const name = text(form, 'name');
		// What was typed, as typed, so the field keeps it under the refusal.
		const typed = String(form.get('name') ?? '');
		if (!name) {
			return fail(400, {
				action: 'createVariation',
				field: 'name',
				message: 'Give the figure a name (up to 200 characters).',
				name: typed
			});
		}
		const made = createVariationFrom(getDb(), figure.id, name, me(params, locals));
		if (!made) {
			return fail(400, {
				action: 'createVariation',
				field: 'name',
				message: taken(group.name, name),
				name: typed
			});
		}
		throw redirect(303, `/${params.dance}/figures/${made.id}`);
	},

	/**
	 * "Move <variation> to…": into another figure of the dance (`target` is its
	 * id, `name` what to call it there), or into a new one of its own
	 * (`target=new`, named by `figureName`). The URL stays the same — the
	 * variation keeps its id.
	 */
	move: async ({ params, request, locals }) => {
		const { figure, group } = variationOf(params, locals);
		const form = await request.formData();
		const rawTarget = String(form.get('target') ?? '');
		const db = getDb();

		let result: MoveResult;
		let figureName: string | undefined;
		let groupId: number | undefined;
		// Blank means "keep its name", the same as not posting one.
		const name = text(form, 'name');
		if (rawTarget === 'new') {
			figureName = text(form, 'figureName');
			if (!figureName) {
				return fail(400, {
					action: 'move',
					field: 'figureName',
					message: 'Give the new move a name (up to 200 characters).'
				});
			}
			result = moveVariation(db, figure.id, { newFigure: figureName }, me(params, locals));
		} else {
			groupId = int(form, 'target');
			if (groupId === undefined) {
				return fail(400, { action: 'move', message: 'Pick where to move it.' });
			}
			result = moveVariation(db, figure.id, { groupId, name }, me(params, locals));
		}

		if (!result.ok) {
			switch (result.reason) {
				// The variation went in the meantime, or the target is not a live
				// figure of this dance — a posted id is just a number.
				case 'gone':
					throw error(404, 'Figure not found');
				case 'same-figure':
					return fail(400, {
						action: 'move',
						message: `${figure.name} is already a figure of ${group.name}.`
					});
				case 'name-taken': {
					const target = groupId === undefined ? null : getGroup(db, groupId);
					return fail(400, {
						action: 'move',
						field: 'name',
						message: taken(target?.name ?? 'That move', name ?? figure.name),
						name: String(form.get('name') ?? '')
					});
				}
				case 'figure-name-taken':
					return fail(400, {
						action: 'move',
						field: 'figureName',
						message: figureTaken(figureName ?? '')
					});
			}
		}
		throw redirect(303, `/${params.dance}/figures/${figure.id}`);
	},

	/**
	 * Archive this variation. The page lands on the figure's first variation
	 * left, or on the figures list when this was the last and the figure went
	 * with it.
	 */
	archive: ({ params, locals }) => {
		const { figure, group } = variationOf(params, locals);
		const db = getDb();
		const done = archiveVariation(db, figure.id, Date.now(), me(params, locals));
		if (!done) throw error(404, 'Figure not found');
		const [first] = done.figureRemoved ? [] : listGroupVariations(db, group.id);
		throw redirect(
			303,
			first ? `/${params.dance}/figures/${first.id}` : `/${params.dance}/figures`
		);
	},

	/**
	 * Give this person their own exercise for this variation, so it shows on
	 * their Today. Reading is enough: the entry is theirs, the variation stays
	 * the group's.
	 */
	practise: ({ params, locals }) => {
		const { figure } = variationOf(params, locals, 'read');
		const userId = wallOf(params, locals).userId;
		if (!practisable(getDb(), userId, figure)) {
			return fail(400, { action: 'practise', message: NOT_ADDED });
		}
		if (!addFigureExercise(getDb(), userId, figure.id)) {
			return fail(400, {
				action: 'practise',
				message: 'This figure is already practised on its own.'
			});
		}
		return { action: 'practise', ok: true };
	},

	/**
	 * Make it mine: a reader's own copy of this group figure, their routines and
	 * practice moved onto it, and its page opens. See `clones/edit.ts`.
	 */
	makeMine: ({ params, locals }) => {
		const { figure } = variationOf(params, locals, 'read');
		return makeMineFrom(getDb(), wallOf(params, locals), 'figure', figure.id);
	},

	/** Take theirs: the compare sheet's picks from another member of the family, in place (`clones/compare.ts`). */
	take: ({ params, locals, request }) => {
		const { figure } = variationOf(params, locals, 'read');
		return takeFrom(getDb(), locals.user!.id, 'figure', figure.id, request);
	},

	/** Send mine (board C3 p2): this figure's changes into each copy the person edits. */
	send: ({ params, locals, request }) => {
		const { figure } = variationOf(params, locals, 'read');
		return sendFrom(getDb(), locals.user!.id, 'figure', figure.id, request);
	},

	/**
	 * Take one of this figure's recordings into the person's own copy of it
	 * (`into`), with its sections; charged to them. See `clones/sources.ts`.
	 */
	takeRecording: async ({ params, request, locals }) => {
		const found = variationOf(params, locals, 'read');
		const form = await request.formData();
		const recordingId = int(form, 'recordingId');
		const into = int(form, 'into');
		if (recordingId === undefined || !found.recordings.some((r) => r.id === recordingId)) {
			return fail(404, { action: 'takeRecording', message: RECORDING_GONE });
		}
		if (into === undefined) throw error(404, 'Figure not found');
		const size = found.recordings.find((r) => r.id === recordingId)!.sizeBytes;
		const res = await takeRecording(
			getDb(),
			wallOf(params, locals),
			into,
			recordingId,
			realCloneFiles(),
			Date.now(),
			await freeDisk()
		);
		if (res.ok) return { action: 'takeRecording', taken: recordingId };
		switch (res.reason) {
			case 'room': {
				const room = res.room;
				if (room.ok) throw error(500, 'Refused without a reason');
				return fail(413, {
					action: 'takeRecording',
					recordingId,
					message: room.message,
					// The person's limit is the reason, not the server's disk.
					askForMore: room.limitBytes !== null && room.usedBytes + size > room.limitBytes
				});
			}
			case 'held':
				return fail(409, {
					action: 'takeRecording',
					recordingId,
					message: ALREADY_IN_YOURS,
					askForMore: false
				});
			default:
				throw error(404, 'Figure not found');
		}
	},

	/** Quick log from the figure page, so practising after watching a recording is one tap. See `log-form.ts`. */
	log: (event) => logSetFrom(event),
	deleteSet: (event) => deleteSetFrom(event),
	restoreSet: (event) => restoreSetFrom(event),

	deleteRecording: async ({ params, request, locals }) => {
		const found = variationOf(params, locals);
		const id = int(await request.formData(), 'recordingId');
		// Checked against THIS variation's recordings before the delete, not
		// after: `deleteRecording` is a blind delete-and-return, so an id
		// belonging to another variation — and so possibly to the other dance —
		// would already be gone by the time the answer came back.
		if (id === undefined || !found.recordings.some((r) => r.id === id)) {
			return fail(404, {
				action: 'deleteRecording',
				message: 'That recording was already removed.'
			});
		}
		let rec;
		try {
			rec = deleteRecording(getDb(), id, me(params, locals));
		} catch (e) {
			if (e instanceof SpotLinkedError) {
				return fail(409, { action: 'deleteRecording', recordingId: id, message: e.message });
			}
			throw e;
		}
		if (!rec) {
			return fail(404, {
				action: 'deleteRecording',
				message: 'That recording was already removed.'
			});
		}
		// Row first, then file: a crash between the two leaves an orphan file,
		// which is harmless, rather than a row pointing at nothing. A group's
		// recording is in Recently deleted with its file: the purge deletes it.
		if (rec.trashId === null) await unlink(join(recordingsDir(), rec.file)).catch(() => {});
		return { action: 'deleteRecording', ok: true };
	},

	/**
	 * A section for this variation. `linkSpot` refuses one from the other dance,
	 * and another person's as if it were missing.
	 */
	linkSection: async ({ params, request, locals }) => {
		const { figure } = variationOf(params, locals);
		const spotId = int(await request.formData(), 'spotId');
		if (spotId === undefined) {
			return fail(400, { action: 'linkSection', message: 'Pick a section.' });
		}
		try {
			linkSpot(getDb(), wallOf(params, locals).userId, spotId, { figureId: figure.id });
		} catch (e) {
			if (e instanceof SpotLinkError) {
				return fail(e.status, {
					action: 'linkSection',
					message: refusalText(e.status, e.message)
				});
			}
			throw e;
		}
		return { action: 'linkSection', ok: true };
	},

	unlinkSection: async ({ params, request, locals }) => {
		const found = variationOf(params, locals);
		const id = int(await request.formData(), 'linkId');
		const link = id === undefined ? null : getSpotLink(getDb(), id);
		// This variation's own link, or any link of a section on one of its
		// recordings — the only place left to unlink one whose target is archived.
		const video = link ? videoOfSpot(getDb(), link.spotId) : null;
		const ownTarget =
			link !== null && 'figureId' in link.target && link.target.figureId === found.figure.id;
		const onOwnRecording =
			video !== null &&
			'recordingId' in video.owner &&
			found.recordings.some(
				(r) => 'recordingId' in video.owner && r.id === video.owner.recordingId
			);
		if (
			!link ||
			!(ownTarget || onOwnRecording) ||
			!unlinkSpot(getDb(), link.id, link.target, Date.now(), me(params, locals))
		) {
			return fail(404, { action: 'unlinkSection', message: 'That link was already removed.' });
		}
		return { action: 'unlinkSection', ok: true };
	},

	addLink: async ({ params, request, locals }) =>
		addLinkFrom(
			request,
			getDb(),
			{ figureId: variationOf(params, locals).figure.id },
			me(params, locals)
		),
	deleteLink: async ({ params, request, locals }) =>
		deleteLinkFrom(
			request,
			getDb(),
			{ figureId: variationOf(params, locals).figure.id },
			me(params, locals)
		),
	saveVideo: async ({ params, request, locals }) =>
		saveVideoFrom(
			request,
			getDb(),
			{ figureId: variationOf(params, locals).figure.id },
			await freeDisk(),
			me(params, locals)
		),
	retryVideo: async ({ params, request, locals }) =>
		retryVideoFrom(
			request,
			getDb(),
			{ figureId: variationOf(params, locals).figure.id },
			await freeDisk(),
			me(params, locals)
		)
};
