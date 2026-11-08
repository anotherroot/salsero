import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb, type Db } from '$lib/server/db';
import { addedReach, positionAccess } from '$lib/server/access';
import {
	addFigureExercise,
	archiveVariation,
	createVariationFrom,
	deleteRecording,
	figureLabels,
	labelFor,
	figureNameTaken,
	getFigure,
	getGroup,
	listGroupVariations,
	listMoveTargets,
	moveVariation,
	type MoveResult,
	renameFigure,
	updateVariation,
	variationNameRefused
} from '$lib/server/figures';
import { recordingsDir } from '$lib/server/files';
import { int, ints, oneOf, optionalText, refusalText, text } from '$lib/server/form';
import { figurePositions, graphFor, setFigureShape } from '$lib/server/graph';
import { teamRefs, usableOf, usablePositions, type Usable } from '$lib/server/usable';
import { listPositions, positionSummary, withCopiedFrom } from '$lib/server/positions';
import { groupModeOf } from '$lib/server/group-mode';
import type { Cookies } from '@sveltejs/kit';
import { lessonAdds, positions as positionRows, type PositionRow } from '$lib/server/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { holdsLine, styleLabelOf } from '$lib/positions/view';
import { positionGroups } from '$lib/picker/build';
import type { PickGroup } from '$lib/picker/model';
import {
	DEFAULT_LENGTH_COUNTS,
	DEFAULT_START_COUNT,
	isLengthCounts,
	isStartCount,
	MAX_LENGTH_COUNTS
} from '$lib/graph/timing';
import { deleteSetFrom, logSetFrom, restoreSetFrom } from '$lib/server/log-form';
import { addLinkFrom, deleteLinkFrom, retryVideoFrom, saveVideoFrom } from '$lib/server/link-form';
import { freeDisk } from '$lib/server/storage';
import { listLinks } from '$lib/server/links';
import { taughtIn } from '$lib/server/lessons';
import { popupData } from '$lib/server/popup';
import { scheduleStateOf, scheduleStates } from '$lib/server/schedule';
import { localDay } from '$lib/day/day';
import { listRoutines, routineShapes } from '$lib/server/routines';
import { routinesUsing } from '$lib/routines/coverage';
import { practiceLine } from '$lib/figures/page';
import { figureById, follows, precedes } from '$lib/graph/graph';
import { PARTNER } from '$lib/labels';
import { DANCES } from '$lib/dances/dances';
import {
	actorOf,
	inSpace,
	isTeam,
	requireFigureAccess,
	wallOf,
	type Space
} from '$lib/server/scope';
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
import { flowAfter, flowing, rootOfSpot } from '$lib/server/clones/flow-hook';
import { hasCopies } from '$lib/server/clones/genes';
import { editedBy } from '$lib/server/changes';
import { makeMineFrom, makeMineOffer } from '$lib/server/make-mine-form';
import { copyToFrom, detachFrom, dropFrom, keepFrom, syncFromForm } from '$lib/server/take-form';
import { copyOffer } from '$lib/server/clones/copy-to';
import { detachOffer } from '$lib/server/clones/detach';
import { familyView } from '$lib/server/clones/send';
import { keepView, stepStatus } from '$lib/server/clones/step';
import { dropOptions } from '$lib/server/clones/drop';
import { genesHeld, sourcesView, takeRecording } from '$lib/server/clones/sources';
import { separateFamily, setTwins, twinCandidates } from '$lib/server/twins';
import { alreadyInYours, recordingGone, sameAsFailed } from '$lib/clones/view';
import { realCloneFiles } from '$lib/server/clones/files';
import { t } from '$lib/i18n/catalog';
import type { PositionSummary, SiblingSummary, TeamRef } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

/**
 * A figure's handholds as its page shows them: its own tags by their real ids
 * (each links to that position's page), live ones only (ruling 4), and only
 * those this person reads. Each side in id order, as `figurePositions` gives it.
 * Empty on both sides reads "No position · fits anywhere".
 */
function handholdsOf(
	db: Db,
	userId: string,
	figureIds: number[]
): (figureId: number) => { starts: PositionRef[]; ends: PositionRef[] } {
	const tags = new Map(figureIds.map((id) => [id, figurePositions(db, id)]));
	const ids = [...new Set([...tags.values()].flatMap((t) => [...t.startIds, ...t.endIds]))];
	const named = new Map<number, string>();
	if (ids.length > 0) {
		for (const row of db
			.select()
			.from(positionRows)
			.where(and(inArray(positionRows.id, ids), isNull(positionRows.archivedAt)))
			.all()) {
			if (positionAccess(db, userId, row) !== null) named.set(row.id, row.name);
		}
	}
	const refs = (side: number[]) =>
		side.flatMap((id) => (named.has(id) ? [{ id, name: named.get(id)! }] : []));
	return (figureId) => {
		const t = tags.get(figureId) ?? { startIds: [], endIds: [] };
		return { starts: refs(t.startIds), ends: refs(t.endIds) };
	};
}

type PositionRef = { id: number; name: string };

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

/** The exercise's line on the page: its due words, from its schedule (or Paused). */
function practiceFor(db: Db, exercise: { id: number; active: boolean }, zone: string, now: number) {
	const state = scheduleStateOf(db, exercise.id, zone);
	return practiceLine(state, localDay(now, zone), state.lastDay === null, exercise.active);
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

// Refusals are composed in the request, in the reader's language.
const taken = (figure: string, name: string) => t().moves.refused.figureTaken(figure, name);
const figureTaken = (name: string) => t().moves.refused.moveTaken(name);

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

	// The viewer's graph (ruling 14): a person's own figures plus the group figures
	// and positions they may use, so a tag to a group's position counts in Leads to
	// and Follows from; a group's figure reads the group's graph.
	const usable = isTeam(space) ? undefined : usableOf(db, space);
	const graph = graphFor(db, space, usable);
	const node = figureById(graph, id);
	const labels = figureLabels(db, space, usable);
	// The graph holds live variations of live figures only, never this one's self.
	const link = (ids: number[]) =>
		ids
			.filter((other) => other !== id && seen(visible?.variations, other))
			.map((other) => ({ id: other, name: labels.get(other)! }));

	// Starts in / Ends in: what the form shows chosen and what its pickers offer.
	const { tags, positionChoices } = canEdit
		? positionForm(db, space, figure, usable)
		: { tags: { startIds: [], endIds: [] }, positionChoices: [] };

	const shape = {
		startCount: figure.startCount ?? DEFAULT_START_COUNT,
		lengthCounts: figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS
	};

	// Every live variation of the figure, this one included, as its sheet lists
	// them: what each starts and ends on, and its timing. The handholds are each
	// one's own live tags (`handholdsOf`); none at all reads "No position".
	const shown = listGroupVariations(db, group.id).filter((s) => seen(visible?.variations, s.id));
	const holdsOf = handholdsOf(db, wall.userId, [id, ...shown.map((s) => s.id)]);
	const names = (refs: PositionRef[]) => refs.map((p) => p.name);
	const siblings: SiblingSummary[] = shown.map((s) => {
		const n = figureById(graph, s.id);
		const h = holdsOf(s.id);
		return {
			id: s.id,
			name: s.name,
			holds: holdsLine(names(h.starts), names(h.ends)),
			timing: t().figure.timing.line(
				n?.start ?? DEFAULT_START_COUNT,
				n?.length ?? DEFAULT_LENGTH_COUNTS
			),
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
	// Group mode has no twins: no twin tab, no subtitle counting them.
	const versions = sourcesView(
		db,
		wall.userId,
		'figure',
		id,
		url.searchParams.get('vs'),
		!inGroupMode
	);
	const held = versions.vs === null ? null : genesHeld(db, versions.vs);

	const candidates = inGroupMode ? [] : twinCandidates(db, wall, 'figure', id);
	const sameAs =
		candidates.length === 0
			? null
			: { kind: 'figure' as const, title: labelFor(group.name, figure.name), candidates };
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
		/** Copies you can see, for the Versions list (`clones/send.ts`). */
		family: familyView(db, wall.userId, 'figure', id),
		step: stepStatus(db, wall.userId, 'figure', id),
		/** Keep in step under Versions, and how Sync opens (`clones/step.ts`). */
		keep: keepView(db, wall.userId, 'figure', id),
		/** Drop my copy (board C5): the person’s own copy, while another version is readable. */
		drop: dropOptions(db, wall, 'figure', id),
		detach: detachOffer(db, wall.userId, 'figure', id),
		/** Copy to… (board C4): your app or a group you own or edit; null when there is none. */
		copyTo: copyOffer(db, wall.userId, 'figure', id),
		/** Same as… (board C7): the other figures in your app; none in a group's workspace, which has no twins. */
		sameAs,
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
		// The face times: the schedule at the START of today for the person's own exercise.
		scheduleAtStart: popup
			? (scheduleStates(db, wall, zone, localDay(now, zone)).get(popup.exercise.id) ?? null)
			: null,
		today: localDay(now, zone),
		// Derived per request, never stored — the same rule the schedule follows.
		routines: routinesUsing(
			graph,
			id,
			routineShapes(db, space, { usable }),
			listRoutines(db, space).filter((r) => seen(visible?.routines, r.id))
		),
		practice: popup ? practiceFor(db, popup.exercise, zone, now) : null,
		/** The edit form's Starts in / Ends in: the chosen tags it shows, and what the pickers offer. */
		tags,
		positionChoices,
		// What the edit form shows.
		shape,
		// The Handholds fact: the figure's own live tags by real id, each a link.
		handholds: holdsOf(id),
		// What is actually danced: the timing the graph reads.
		effective: {
			startCount: node?.start ?? shape.startCount,
			lengthCounts: node?.length ?? shape.lengthCounts
		},
		// Derived per request, never stored — the same rule the schedule follows.
		leadsTo: link(follows(graph, id)),
		followsFrom: link(precedes(graph, id)),
		links: listLinks(db, { figureId: id }),
		taughtIn: taughtIn(db, space, id).filter((l) => seen(visible?.lessons, l.id)),
		// What linking and Move… offer: an editor's only.
		linkable: canEdit ? linkableSections(db, { figureId: id }) : [],
		moveTargets: canEdit ? listMoveTargets(db, space, group.id) : []
	};
};

/**
 * The edit form's Starts in / Ends in (ruling 15): a person's figure offers
 * their own live positions and the group positions they may use
 * (`usablePositions`); a group's figure only the group's own. `tags` are the
 * chosen ones the form shows and posts back.
 *
 * Every chosen live tag the person may use is offered, so it shows as a chip
 * and can be taken off: a group's position their own copy hides from the list
 * (`usablePositions` leaves shadowed ones out) included. A tag to an archived
 * position, or to one they may not use, is neither shown nor posted:
 * `writeFigureShape` keeps it (ruling 4).
 */
function positionForm(
	db: Db,
	space: Space,
	figure: { id: number; styleTag: string | null },
	usable: Usable | undefined
): {
	tags: { startIds: number[]; endIds: number[] };
	positionChoices: PickGroup[];
} {
	const current = figurePositions(db, figure.id);
	const viewer = actorOf(space);
	const own = withCopiedFrom(
		db,
		viewer,
		listPositions(db, space).map((r) => positionSummary(r, space))
	);
	const byTeam = new Map<number, { team: TeamRef; rows: PositionSummary[] }>();
	const add = (row: PositionRow, team: TeamRef) => {
		const at = byTeam.get(team.id) ?? { team, rows: [] };
		at.rows.push(positionSummary(row, space));
		byTeam.set(team.id, at);
	};
	if (!isTeam(space)) for (const r of usablePositions(db, space, usable)) add(r, r.team);
	for (const g of byTeam.values()) g.rows = withCopiedFrom(db, viewer, g.rows);

	const offered = new Set([
		...own.map((p) => p.id),
		...[...byTeam.values()].flatMap((g) => g.rows.map((p) => p.id))
	]);
	const missing = [...new Set([...current.startIds, ...current.endIds])].filter(
		(p) => !offered.has(p)
	);
	// Exactly what `writeFigureShape` would replace: the group positions the
	// person may use (`usableBy`), shadowed ones included, so offered and
	// writable agree by construction.
	if (!isTeam(space) && missing.length > 0) {
		const wanted = new Set(missing);
		for (const r of usablePositions(db, space, usable, 'keep')) {
			if (!wanted.has(r.id) || offered.has(r.id)) continue;
			add(r, r.team);
			offered.add(r.id);
		}
	}
	const shown = (ids: number[]) => ids.filter((p) => offered.has(p));
	return {
		tags: { startIds: shown(current.startIds), endIds: shown(current.endIds) },
		positionChoices: positionGroups(
			own,
			figure.styleTag,
			styleLabelOf(DANCES[space.dance].styleLabel),
			[...byTeam.values()]
		)
	};
}

/**
 * Every action runs Keep in step's flow from this variation after it
 * (`flowing`); one that changes another row's piece (a section's link) runs
 * it from that row too.
 */
export const actions: Actions = flowing('figure', (e) => variationId(e.params.id), {
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
		// Starts in / Ends in post every chosen id, each side under its own name.
		const startIds = ints(form, 'startIds');
		const endIds = ints(form, 'endIds');
		const startCount = int(form, 'startCount');
		const lengthCounts = int(form, 'lengthCounts');

		if (!figureName || !name || !partner || !style || notes === undefined) {
			return fail(400, {
				action: 'update',
				message: t().figure.refused.names
			});
		}
		if (!isStartCount(startCount) || !isLengthCounts(lengthCounts)) {
			return fail(400, {
				action: 'update',
				message: t().figure.refused.timing(MAX_LENGTH_COUNTS)
			});
		}

		// The clash check, before any write: a save that saw another version
		// of the variation or its figure's name is refused with theirs.
		const clash = seenRefusal(
			form,
			row.teamId !== null || hasCopies(db, 'figure', row.id),
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
		if (variationNameRefused(db, group.id, figure, name)) {
			return fail(400, { action: 'update', message: taken(group.name, name) });
		}
		// A posted position id is just a number: `setFigureShape` rejects one from
		// the other dance or another owner, and that is a 404 rather than a message,
		// the same answer every other cross-dance id gets here. Tags the form never
		// showed (archived, not read) are not posted and are kept (ruling 4).
		if (!setFigureShape(db, figure.id, { startIds, endIds, startCount, lengthCounts }, by)) {
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
				message: t().moves.refused.figureName,
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
					message: t().figure.refused.newMoveName
				});
			}
			result = moveVariation(db, figure.id, { newFigure: figureName }, me(params, locals));
		} else {
			groupId = int(form, 'target');
			if (groupId === undefined) {
				return fail(400, { action: 'move', message: t().figure.refused.pickTarget });
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
						message: t().figure.refused.sameMove(figure.name, group.name)
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
			return fail(400, { action: 'practise', message: t().figure.refused.notAdded });
		}
		if (!addFigureExercise(getDb(), userId, figure.id)) {
			return fail(400, {
				action: 'practise',
				message: t().figure.refused.alreadyPractised
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

	/** Sync (the Sync sheet, or a reader's Update mine): the merge lands on every ticked copy (`clones/sync.ts`). */
	sync: ({ params, locals, request }) => {
		const { figure } = variationOf(params, locals, 'read');
		return syncFromForm(getDb(), locals.user!.id, 'figure', figure.id, request);
	},

	/** Keep in step (under Versions): this copy's switch and options (`clones/sync-settings.ts`). */
	keep: ({ params, locals, request }) => {
		const { figure } = variationOf(params, locals, 'read');
		return keepFrom(getDb(), locals.user!.id, 'figure', figure.id, request);
	},

	/** Drop my copy (board C5): this copy goes for another version, whose page opens. */
	drop: ({ params, locals, request }) => {
		const { figure } = variationOf(params, locals, 'read');
		return dropFrom(getDb(), wallOf(params, locals), 'figure', figure.id, request);
	},

	/** Detach (board C8): this copy stops following its source. */
	detach: ({ params, locals }) => {
		const { figure } = variationOf(params, locals, 'read');
		return detachFrom(getDb(), wallOf(params, locals).userId, 'figure', figure.id);
	},

	/** Same as… (board C7): the row's twins become exactly the ticked ones. */
	sameAs: async ({ params, locals, request }) => {
		const { figure } = variationOf(params, locals, 'read');
		const form = await request.formData();
		if (!setTwins(getDb(), wallOf(params, locals), 'figure', figure.id, ints(form, 'twin')))
			return fail(400, { action: 'sameAs', message: sameAsFailed() });
		return { action: 'sameAs' };
	},

	/** Not the same? Separate (board C7 p2): the row and the rest of its family leave their twins. */
	separate: ({ params, locals }) => {
		const { figure } = variationOf(params, locals, 'read');
		separateFamily(getDb(), wallOf(params, locals), 'figure', figure.id);
		return { action: 'separate' };
	},

	/** Copy to… (board C4): this row into your app or a group you own or edit. */
	copyTo: ({ params, locals, request }) => {
		const { figure } = variationOf(params, locals, 'read');
		return copyToFrom(getDb(), wallOf(params, locals), 'figure', figure.id, request);
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
			return fail(404, { action: 'takeRecording', message: recordingGone() });
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
		if (res.ok) {
			// The person's own copy gained a recording: it flows from there.
			await flowAfter(locals.user?.id, 'figure', into);
			return { action: 'takeRecording', taken: recordingId };
		}
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
					message: alreadyInYours(),
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
				message: t().figure.refused.recordingGone
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
				message: t().figure.refused.recordingGone
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
			return fail(400, { action: 'linkSection', message: t().figure.refused.pickSection });
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
		// The section's links are its video's root's (a lesson's, or a recording's figure's).
		const root = rootOfSpot(getDb(), spotId);
		if (root) await flowAfter(locals.user?.id, root.kind, root.id);
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
			return fail(404, { action: 'unlinkSection', message: t().figure.refused.linkGone });
		}
		const root = rootOfSpot(getDb(), link.spotId);
		if (root) await flowAfter(locals.user?.id, root.kind, root.id);
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
} satisfies Actions);
