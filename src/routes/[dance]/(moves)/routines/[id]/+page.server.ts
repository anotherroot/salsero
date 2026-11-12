import { fail, redirect } from '@sveltejs/kit';
import { t } from '$lib/i18n/catalog';
import { getDb, type Db } from '$lib/server/db';
import { figureLabels, listVersions, withFigureOrigins } from '$lib/server/figures';
import { graphFor } from '$lib/server/graph';
import { usableOf, usableVersions } from '$lib/server/usable';
import { foldNamed, foldVersions, sameAsOffer } from '$lib/server/twins';
import { mineTarget } from '$lib/server/mine-target';
import { groupModeFor, listInViewOf } from '$lib/server/group-mode';
import { routineTaughtIn } from '$lib/server/lessons';
import {
	setOptionLength,
	setSlotEnd,
	archiveRoutine,
	deleteSlots,
	duplicateRoutine,
	duplicateSlots,
	embeddable,
	embeddedIn,
	makeSection,
	getRoutine,
	moveSlotInto,
	holds,
	promoteSection,
	unpackSlot,
	packSlots,
	detachSection,
	insertSlot,
	moveSlotTo,
	restoreSlots,
	routineShapes,
	routineSlots,
	setSlotNote,
	updateRoutine
} from '$lib/server/routines';
import {
	breaks,
	flatten,
	loops,
	positionSeams,
	routineEnds,
	routineStarts,
	rowEdges,
	rowEdgesIn,
	rowEndsIn,
	timingBreaks,
	timingSeams,
	type OptionsSlot,
	routineSize,
	optionSlots
} from '$lib/routines/routines';
import { countsOf, figureById, nextCountOf, type Graph } from '$lib/graph/graph';
import { int, ints, optionalText, text } from '$lib/server/form';
import { parseSnapshots } from '$lib/routines/snapshot';
import type { Candidate } from '$lib/routines/fit';
import { addSongFrom, noteSongFrom, removeSongFrom } from '$lib/server/music-form';
import { listMusic, musicChoices } from '$lib/server/song-links';
import { isTeam, requireRoutineAccess, spaceOfRow, wallOf } from '$lib/server/scope';
import { entryFor } from '$lib/server/entries';
import { missingSeen, routineSeen, seenRefusal } from '$lib/server/clash';
import { goneTitle, routineFingerprint, staleRoutine } from '$lib/clash/clash';
import { archivedRefusal, editedBy } from '$lib/server/changes';
import { getTeam } from '$lib/server/teams';
import { elsewhereGroup } from '$lib/server/elsewhere';
import { makeMineFrom, makeMineOffer } from '$lib/server/make-mine-form';
import {
	copyToFrom,
	detachFrom,
	dropFrom,
	keepFrom,
	sameAsFrom,
	separateFrom,
	syncFromForm
} from '$lib/server/take-form';
import { copyOffer } from '$lib/server/clones/copy-to';
import { detachOffer } from '$lib/server/clones/detach';
import { familyView } from '$lib/server/clones/send';
import { keepView, stepStatus } from '$lib/server/clones/step';
import { dropOptions } from '$lib/server/clones/drop';
import type { Routine } from '$lib/server/db/schema';
import { pageSources } from '$lib/server/clones/sources';
import { flowing, idParam } from '$lib/server/clones/flow-hook';
import { hasCopies } from '$lib/server/clones/genes';
import type { Actions, PageServerLoad } from './$types';
import { serverNow } from '$lib/server/server-clock';
import { childViews } from '$lib/server/section-views';
import { and, eq, isNull } from 'drizzle-orm';
import { routineSteps, routines } from '$lib/server/db/schema';
import { demoteImpact, demoteRoutine, routinesHolding } from '$lib/server/sections';

/**
 * The routine this URL names, or a 404 — the same shape `figureOf`, `songOf`
 * and `lessonOf` use on their own detail pages. A form action runs before the
 * `[dance]` layout's gate, so the dance has to be resolved here on every
 * path, and doing it once by name beats nine copies.
 */
function routineOf(params: { dance: string; id: string }, locals: App.Locals) {
	return routineIn(params, locals, 'edit').routine;
}

/** The routine's slots as one string: what a slot action saw (the clash check). */
function fingerprintOf(db: Db, routineId: number): string {
	return routineFingerprint(
		routineSlots(db, routineId).map((s) => ({
			position: s.position,
			childRoutineId: s.childId,
			figureIds: s.figureIds,
			note: s.note,
			// A slot's lengths (spec 2026-11-11), only when it has any: a routine without
			// them keeps the fingerprint it had.
			...(Object.keys(s.lengths).length > 0 ? { lengths: s.lengths } : {}),
			end: s.end
		}))
	);
}

/** Who acts: History names them on a group's routine. */
const by = (params: { dance: string }, locals: App.Locals) => wallOf(params, locals).userId;

/** A slot action's success, with the routine's new fingerprint for the next one. */
function done<T extends Record<string, unknown>>(routineId: number, extra?: T) {
	return { ok: true as const, fingerprint: fingerprintOf(getDb(), routineId), ...extra };
}

/**
 * A slot action aimed at a routine that changed since its page last loaded:
 * refused, doing nothing (409), so a drag or a delete never lands on a slot
 * someone else just moved. A group's routine needs the fingerprint; a
 * person's own accepts an action without one, from a tab opened before the
 * check. In a group, History names who changed it last.
 */
function staleSlots(db: Db, routine: Routine, form: FormData, action?: 'extract') {
	const named = action ? { action } : {};
	const who = () => editedBy(db, routine.teamId, 'routine', routine.id);
	if (routine.archivedAt !== null) {
		const gone = who();
		return fail(410, { ...named, message: goneTitle(gone, serverNow()), gone });
	}
	const sent = form.get('fingerprint');
	if (typeof sent !== 'string' || sent === '') {
		// A group's routine, or one with copies (a change may flow in), must say what it saw.
		const required = routine.teamId !== null || hasCopies(db, 'routine', routine.id);
		return required ? fail(400, { ...named, message: missingSeen() }) : null;
	}
	if (sent === fingerprintOf(db, routine.id)) return null;
	return fail(409, { ...named, message: staleRoutine(who().by), stale: true });
}

/**
 * The routine, the space it stands in (a person's or a group's) and this
 * person's access. The load reads; every action edits, so a member who posts
 * gets the stranger's 404.
 */
function routineIn(
	params: { dance: string; id: string },
	locals: App.Locals,
	need: 'read' | 'edit'
) {
	return requireRoutineAccess(getDb(), locals, params, params.id, need);
}

/**
 * A routine candidate's ends when its last slot's options disagree (`slotEnds`
 * null; only legacy slots, since `addOption` forbids it now): the union of
 * the options' ends, so the picker still offers it. Lenient on purpose: the
 * editor shows the seam where one option breaks.
 */
function unionOfEnds(g: Graph, slots: OptionsSlot[]): number[] {
	const flat = flatten(g, { slots });
	const last = flat[flat.length - 1];
	if (!last) return [];
	const ends = last.figureIds.flatMap((id) => figureById(g, id)?.ends ?? []);
	return [...new Set(ends)].sort((a, b) => a - b);
}

export const load: PageServerLoad = ({ params, locals, url }) => {
	const wall = wallOf(params, locals);
	const db = getDb();
	const { routine, space, access, reach: visible } = routineIn(params, locals, 'read');
	const canEdit = access === 'edit';
	// Group mode has no twins: no twin tab, no Same as….
	const inGroupMode =
		groupModeFor(db, wall.userId, wall.dance, routine.teamId, locals.user?.level) !== null;
	// A reader's lists hold only what the published lessons reach (risk 20).
	// A person's routine may hold the group figures and routines they may use
	// (`usableOf`): those are on the graph, named, and offered to embed.
	const usable = isTeam(space) ? undefined : usableOf(db, space);
	const graph = graphFor(db, space, usable);
	const shapes = routineShapes(db, space, { usable, extra: usable?.routines });
	const shape = shapes.get(routine.id) ?? { slots: [] };
	const slots = routineSlots(db, routine.id, usable);
	// A reader is told the names this routine's own slots use, and no other: its
	// slots (and its embedded routines') are in their reach by construction.
	const named = new Set(shape.slots.flatMap((s) => optionSlots(s).flatMap((o) => o.figureIds)));
	const labels = [...figureLabels(db, space, usable)].filter(([id]) => !visible || named.has(id));

	// The group figures this person's routine uses: each one's group and move,
	// for the source chip on its slot and the note under the list. Only while
	// usable (`usableVersions`), so a figure they lost shows no group name.
	const groupFigures: Record<number, { team: string; name: string }> = usable
		? Object.fromEntries(
				usableVersions(db, wall, usable, 'keep')
					.filter((v) => named.has(v.id))
					.map((v) => [v.id, { team: v.team.name, name: v.figure }])
			)
		: {};

	// Flat indices where the routine's walk breaks — a slot's alternatives don't
	// share a start with the slot before it. Only the break count above the
	// slots reads these; the seams between cards come from `positionSeams` and
	// `timingSeams`, which are indexed by row.
	const flatBreaks = new Set(breaks(graph, shape));

	// What the picker can offer, each with where it begins and lands — resolved
	// here, through the graph, so positions compare by family on the client
	// exactly as on the server; an untagged side is [] (anywhere). Archived figures are not candidates; a slot
	// still holding one names it through `labels`.
	const candidates: Candidate[] = !canEdit
		? []
		: [
				// Twins show as one (board C7): a set is one candidate; a group's routine folds nothing.
				...withFigureOrigins(
					db,
					wall.userId,
					foldVersions(db, space, [
						...listVersions(db, space),
						// A person's routine may use the group figures they reach, each under its group.
						...(usable ? usableVersions(db, wall, usable) : [])
					])
				).flatMap((v): Candidate[] => {
					const node = figureById(graph, v.id);
					if (!node) return [];
					return [
						{
							kind: 'figure',
							id: v.id,
							groupId: v.groupId,
							figure: v.figure,
							label: v.label,
							from: v.from,
							starts: node.starts,
							startCounts: countsOf(node),
							ends: node.ends,
							next: nextCountOf(node),
							// Spec 2026-11-11: its own length, and whether a routine sets it.
							length: node.length,
							...(node.free ? { free: true } : {}),
							...(v.team ? { team: v.team } : {}),
							...(v.twins ? { twins: v.twins } : {})
						}
					];
				}),
				// Twins show as one here too: a set is one routine to embed.
				...pickOrder(
					routine.id,
					foldNamed(db, space, 'routine', embeddable(db, routine.id, usable))
				).map((r): Candidate => {
					// Its slots at any depth (spec 2026-11-12).
					const slots = shapes.get(r.id)?.slots ?? [];
					const own = slots.flatMap((s) => optionSlots(s));
					const edges = rowEdges(graph, { kind: 'child', routineId: r.id, slots });
					return {
						kind: 'routine',
						id: r.id,
						groupId: null,
						figure: null,
						label: r.name,
						...(r.team ? { team: r.team } : {}),
						...(r.twins ? { twins: r.twins } : {}),
						...(r.isSection ? { section: r.holders.map((h) => h.name).join(', ') } : {}),
						...edges,
						ends: edges.ends ?? unionOfEnds(graph, own)
					};
				})
			];

	return {
		routine: { id: routine.id, name: routine.name, notes: routine.notes },
		canEdit,
		/** Music (spec B): its suggested songs, and what "+ Add" offers an editor. */
		music: listMusic(db, { routineId: routine.id }, wall.userId),
		musicChoices: canEdit ? musicChoices(db, space) : [],
		/** A tab per source, the subtitle's facts, and `?vs=` (`clones/sources.ts`). */
		...pageSources(db, wall.userId, 'routine', routine.id, url, !inGroupMode),
		/** Copies you can see, for the Versions list (`clones/send.ts`). */
		family: familyView(db, wall.userId, 'routine', routine.id),
		step: stepStatus(db, wall.userId, 'routine', routine.id),
		/** Keep in step under Versions, and how Sync opens (`clones/step.ts`). */
		keep: keepView(db, wall.userId, 'routine', routine.id),
		/** Drop my copy (board C5): the person’s own copy, while another version is readable. */
		drop: dropOptions(db, wall, 'routine', routine.id),
		detach: detachOffer(db, wall.userId, 'routine', routine.id),
		/** Same as… (board C7): the other routines in your app; none in a group's workspace. */
		/** Where Mine lands in the group's view (group view spec, rule 6); null: the tab's list. */
		mineHref: inGroupMode ? mineTarget(db, wall, 'routine', routine.id) : null,
		sameAs: sameAsOffer(db, wall, 'routine', routine.id, routine.name, inGroupMode),
		/** Copy to… (board C4): your app or a group you own or edit; null when there is none. */
		// A section is copied with the routine that holds it, never alone (review I4).
		copyTo: routine.isSection === 1 ? null : copyOffer(db, wall.userId, 'routine', routine.id),
		/** A reader's Edit: Make it mine (ruling 1: an editor's Edit edits the group's). */
		makeMine:
			canEdit || routine.teamId === null
				? null
				: makeMineOffer(db, wall, 'routine', routine.id, getTeam(db, routine.teamId)),
		/** A group routine's History: its editors'. */
		historyHref:
			canEdit && routine.teamId !== null
				? `/${wall.dance}/groups/${routine.teamId}/history/routine/${routine.id}`
				: null,
		// What the Edit form saw, and the slots as one string: what a save and a
		// slot action carry back (the clash check).
		seen: routineSeen(routine),
		fingerprint: fingerprintOf(db, routine.id),
		// The routine's own exercise, so "Practise" can hand the player an exercise
		// id and the save sheet comes up with the right one already chosen.
		exerciseId: entryFor(db, wall.userId, { routineId: routine.id })?.id ?? null,
		slots,
		// How many slots each embedded routine has, by its id — the card's
		// "Routine · 3 slots" — counted from the shapes already built.
		childSlots: Object.fromEntries(
			slots.flatMap((s) =>
				s.childId === null ? [] : [[s.childId, shapes.get(s.childId)?.slots.length ?? 0]]
			)
		) as Record<number, number>,
		// The sections and routines the slots hold, at any depth, as the editor
		// opens them in place (spec 2026-11-12).
		children: childViews(
			db,
			wall.dance,
			graph,
			shapes,
			slots.flatMap((s) => (s.childId === null ? [] : [s.childId])),
			(
				(m) => (id: number) =>
					m.get(id) ?? ''
			)(new Map(labels)),
			usable
		),
		isSection: routine.isSection === 1,
		// A section's page (spec 2026-11-12): the slot it was opened from (`?from=`), the
		// routines holding it, its size; a routine's: what Turn into a section would touch.
		fromSlot: fromSlot(db, url, routine.id),
		holders: routine.isSection === 1 ? routinesHolding(db, routine.id, routine) : [],
		// Slots holding it in its owner's routines: Detach here needs two (review; the same
		// section twice in one routine counts twice).
		uses: routine.isSection === 1 ? usesOf(db, routine) : 0,
		size: routineSize(graph, shape),
		demote: canEdit && routine.isSection === 0 ? demoteImpact(db, routine.id) : null,
		// Names for every figure a slot can hold, archived ones included, so a slot
		// whose variation was archived still says what it was.
		labels: Object.fromEntries(labels),
		groupFigures,
		// Names for the facts, the slots' meta and the seams. A reader is told only
		// those this routine's own figures are tagged with, as with `labels`.
		positions: graph.positions
			.filter(
				(p) =>
					!visible ||
					graph.figures.some(
						(f) => named.has(f.id) && (f.starts.includes(p.id) || f.ends.includes(p.id))
					)
			)
			.map((p) => ({ id: p.id, name: p.name })),
		starts: routineStarts(graph, shape),
		ends: routineEnds(graph, shape) ?? [],
		loops: loops(graph, shape),
		// Flat indices, which line up with `slots` only while no slot holds a
		// child. The page shows the count when they diverge rather than pointing
		// at the wrong slot.
		breaks: [...flatBreaks],
		// Same indexing as `breaks`: flat, so only trustworthy per row while no
		// slot holds a child.
		timingBreaks: timingBreaks(graph, shape),
		// The per-row markers, indexed by `slots` rather than the flat run, so an
		// archived-only slot or an embedded routine cannot shift them.
		timingSeams: timingSeams(graph, shape),
		taughtIn: routineTaughtIn(db, space, routine.id).filter(
			(l) => !visible || visible.lessons.has(l.id)
		),
		candidates,
		/** A group's routine, for an editor: its slot picker also finds other places' (link from other places). */
		elsewhere: (() => {
			if (!canEdit || routine.teamId === null) return null;
			if (!elsewhereGroup(db, wall.userId, wall.dance, routine.teamId)) return null;
			const team = getTeam(db, routine.teamId);
			return team ? { teamId: team.id, name: team.name } : null;
		})(),
		// Per row, parallel to `slots`: where it begins and lands — the picker's
		// anchors and the seams' labels.
		// As the routine walks (spec 2026-11-11): each row entered where the one before leaves off.
		edges: rowEdgesIn(graph, shape),
		// Per row, parallel to `slots`: its end's state and the Where does it end? sheet's
		// rows (spec 2026-11-11, slot end); null for an embedded or empty row.
		slotEnds: rowEndsIn(graph, shape),
		positionSeams: positionSeams(graph, shape),
		// Why "Make routine" is greyed, named.
		embeddedIn: embeddedIn(db, routine.id)
			.filter((r) => !visible || visible.routines.has(r.id))
			.map((r) => r.name)
	};
};

/**
 * Whether `stepId` names one of this routine's own slots.
 *
 * `addOption`, `removeOption` and `setSlotNote` take a bare slot id with no
 * routine id to check it against — unlike `reorder`, `deleteMany`,
 * `duplicateMany` and `extract`, which take `routine.id` and enforce this
 * themselves. Without this lookup here, a
 * salsa request could edit a slot belonging to a different salsa routine, or
 * to another dance's, since the id in a form body is just a number.
 */
function ownsSlot(db: Db, routineId: number, stepId: number): boolean {
	return routineSlots(db, routineId).some((s) => s.id === stepId);
}

/**
 * A failure from an action that acts on one slot, carrying the slot it was aimed
 * at so the page can print the message under that slot.
 *
 * The page posts these from a swipe, a drag, the note field or the picker,
 * anywhere down a long routine, and nothing scrolls to the banner — from slot
 * nine a refusal up there is invisible. The picker offers only alternatives
 * that fit, but what it offered can be stale by the time it is posted (a
 * figure's tags changed, the slot was deleted in another tab), so a refusal is
 * still ordinary use, and its home is under the slot it was aimed at.
 *
 * `stepId` is omitted when the body's slot id could not be read at all. There is
 * no slot to attribute that to, and the page's banner is its right home.
 */
function slotFail(message: string, stepId: number | undefined) {
	return stepId === undefined ? fail(400, { message }) : fail(400, { message, stepId });
}

/** Every action runs Keep in step's flow from this routine after it (`flowing`). */
export const actions: Actions = flowing('routine', (e) => idParam(e.params.id), {
	rename: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		// What was typed comes back, so a refused Save does not empty the form.
		const typed = { name: String(form.get('name') ?? ''), notes: String(form.get('notes') ?? '') };
		if (!name) {
			return fail(400, {
				action: 'rename',
				field: 'name',
				message: t().moves.refused.routineName,
				...typed
			});
		}
		if (notes === undefined) {
			return fail(400, {
				action: 'rename',
				field: 'notes',
				message: t().moves.refused.notes,
				...typed
			});
		}
		const clash = seenRefusal(
			form,
			{ team: routine.teamId !== null, copies: hasCopies(db, 'routine', routine.id) },
			routine.archivedAt === null ? routineSeen(routine) : null,
			{ action: 'rename' as const, ...typed },
			serverNow(),
			() => editedBy(db, routine.teamId, 'routine', routine.id)
		);
		if (clash) return clash;
		updateRoutine(db, routine.id, { name, notes }, by(params, locals));
		return { ok: true };
	},

	duplicate: async ({ params, locals }) => {
		const routine = routineOf(params, locals);
		const copy = duplicateRoutine(getDb(), routine.id, by(params, locals));
		if (!copy) return fail(400, { message: t().routine.refused.copy });
		// Straight to the copy: you duplicated it in order to change it, and landing
		// back on the original is how you end up editing the wrong one.
		throw redirect(303, `/${params.dance}/routines/${copy.id}`);
	},

	/** Make it mine: a reader's own copy of this group routine, and its page opens (`clones/edit.ts`). */
	makeMine: ({ params, locals }) => {
		const { routine } = routineIn(params, locals, 'read');
		return makeMineFrom(getDb(), wallOf(params, locals), 'routine', routine.id);
	},

	/** Sync (the Sync sheet, or a reader's Update mine): the merge lands on every ticked copy (`clones/sync.ts`). */
	sync: ({ params, locals, request }) => {
		const { routine } = routineIn(params, locals, 'read');
		return syncFromForm(getDb(), locals.user!.id, 'routine', routine.id, request);
	},

	/** Keep in step (under Versions): this copy's switch and options (`clones/sync-settings.ts`). */
	keep: ({ params, locals, request }) => {
		const { routine } = routineIn(params, locals, 'read');
		return keepFrom(getDb(), locals.user!.id, 'routine', routine.id, request);
	},

	/** Drop my copy (board C5): this copy goes for another version, whose page opens. */
	drop: ({ params, locals, request }) => {
		const { routine } = routineIn(params, locals, 'read');
		return dropFrom(getDb(), wallOf(params, locals), 'routine', routine.id, request);
	},

	/** Detach (board C8): this copy stops following its source. */
	detach: ({ params, locals }) => {
		const { routine } = routineIn(params, locals, 'read');
		return detachFrom(getDb(), wallOf(params, locals).userId, 'routine', routine.id);
	},

	/** Same as… (board C7): the row's twins become exactly the ticked ones. */
	sameAs: ({ params, locals, request }) => {
		const { routine } = routineIn(params, locals, 'read');
		return sameAsFrom(getDb(), wallOf(params, locals), 'routine', routine.id, request);
	},

	/** Not the same? Separate (board C7 p2): the row and the rest of its family leave their twins. */
	separate: ({ params, locals }) => {
		const { routine } = routineIn(params, locals, 'read');
		return separateFrom(getDb(), wallOf(params, locals), 'routine', routine.id);
	},

	/** Copy to… (board C4): this row into your app or a group you own or edit. */
	copyTo: ({ params, locals, request }) => {
		const { routine } = routineIn(params, locals, 'read');
		return copyToFrom(getDb(), wallOf(params, locals), 'routine', routine.id, request);
	},

	// Make routine (spec 2026-11-12): a section joins the Routines list; an unnamed one takes `name`.
	promote: async ({ params, request, locals }) => {
		const form = await request.formData();
		const routine = routineOf(params, locals);
		const name = text(form, 'name');
		if (!promoteSection(getDb(), routine.id, name ?? null, by(params, locals))) {
			return fail(400, { action: 'promote', field: 'name', message: t().routine.refused.newName });
		}
		return done(routine.id);
	},
	// Turn into a section (spec 2026-11-12): refused when no routine uses it.
	demote: async ({ params, locals }) => {
		const routine = routineOf(params, locals);
		if (!demoteRoutine(getDb(), routine.id, by(params, locals))) {
			return fail(400, { action: 'demote', message: t().routine.refused.demote });
		}
		return done(routine.id);
	},
	archive: async ({ params, locals }) => {
		const routine = routineOf(params, locals);
		// The boolean is deliberately ignored: archiving twice is idempotent — the
		// row is archived either way and the list omits it — so a second attempt is
		// a no-op worth redirecting, not an error worth reporting.
		archiveRoutine(getDb(), routine.id, serverNow(), by(params, locals));
		const wall = wallOf(params, locals);
		throw redirect(
			303,
			listInViewOf(getDb(), wall, locals.user?.level, routine.teamId, `/${params.dance}/routines`)
		);
	},

	/** An option's length in its slot: the How long? sheet from the slot's chip (spec 2026-11-11). */
	length: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const stale = staleSlots(db, routine, form);
		if (stale) return stale;
		const stepId = int(form, 'stepId');
		const figureId = int(form, 'figureId');
		const length = int(form, 'length');
		if (stepId === undefined || figureId === undefined || length === undefined) {
			return slotFail(t().routine.refused.readSlot, stepId);
		}
		if (!ownsSlot(db, routine.id, stepId)) {
			return slotFail(t().routine.refused.notThisRoutine, stepId);
		}
		if (!setOptionLength(db, stepId, figureId, length, by(params, locals))) {
			return slotFail(t().routine.refused.length, stepId);
		}
		return done(routine.id);
	},

	/** A slot's end: the Where does it end? sheet (spec 2026-11-11, slot end). No position clears it. */
	end: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const stale = staleSlots(db, routine, form);
		if (stale) return stale;
		const stepId = int(form, 'stepId');
		const raw = String(form.get('positionId') ?? '').trim();
		const positionId = raw === '' ? null : int(form, 'positionId');
		if (stepId === undefined || positionId === undefined) {
			return slotFail(t().routine.refused.readSlot, stepId);
		}
		if (!ownsSlot(db, routine.id, stepId)) {
			return slotFail(t().routine.refused.notThisRoutine, stepId);
		}
		if (!setSlotEnd(db, stepId, positionId, by(params, locals))) {
			return slotFail(t().routine.refused.end, stepId);
		}
		return done(routine.id);
	},

	addSong: async ({ params, request, locals }) => {
		const routine = routineOf(params, locals);
		const db = getDb();
		return addSongFrom(request, db, spaceOfRow(routine, wallOf(params, locals).userId), {
			routineId: routine.id
		});
	},
	noteSong: async ({ params, request, locals }) => {
		const routine = routineOf(params, locals);
		const space = spaceOfRow(routine, wallOf(params, locals).userId);
		return noteSongFrom(request, getDb(), space, { routineId: routine.id });
	},
	removeSong: async ({ params, request, locals }) => {
		const routine = routineOf(params, locals);
		const space = spaceOfRow(routine, wallOf(params, locals).userId);
		return removeSongFrom(request, getDb(), space, { routineId: routine.id });
	},

	note: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const stale = staleSlots(db, routine, form);
		if (stale) return stale;
		const stepId = int(form, 'stepId');
		const note = optionalText(form, 'note', 200);
		// Order kept as it was: an overlong note is reported as an overlong note even
		// when the slot id is unreadable too. Only the attribution is new.
		if (note === undefined) {
			return slotFail(t().routine.refused.note, stepId);
		}
		if (stepId === undefined || !ownsSlot(db, routine.id, stepId)) {
			return slotFail(t().routine.refused.notThisRoutine, stepId);
		}
		setSlotNote(db, stepId, note, by(params, locals));
		return done(routine.id);
	},

	insert: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const stale = staleSlots(db, routine, form);
		if (stale) return stale;
		const at = int(form, 'at');
		const figureId = int(form, 'figureId');
		const childId = int(form, 'childId');
		if (at === undefined || (figureId === undefined) === (childId === undefined)) {
			return fail(400, { message: t().routine.refused.readInsert });
		}
		if (childId !== undefined) {
			// Only what the picker offered: `canEmbed` alone would accept an archived routine.
			const offered = embeddable(db, routine.id).some((r) => r.id === childId);
			const stepId = offered
				? insertSlot(db, routine.id, at, { childId }, by(params, locals))
				: null;
			if (stepId === null) {
				const space = spaceOfRow(routine, by(params, locals));
				const archived = archivedRefusal(db, space, { routineId: childId }, {});
				return archived ?? fail(400, { message: t().routine.refused.embed });
			}
			return done(routine.id, { stepId });
		}
		const stepId = insertSlot(
			db,
			routine.id,
			at,
			{ figureId: figureId as number, length: int(form, 'length') },
			by(params, locals)
		);
		if (stepId === null) {
			const space = spaceOfRow(routine, by(params, locals));
			const archived = archivedRefusal(db, space, { figureId: figureId as number }, {});
			return archived ?? fail(400, { message: t().routine.refused.notThisDance });
		}
		return done(routine.id, { stepId });
	},

	reorder: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const stale = staleSlots(db, routine, form);
		if (stale) return stale;
		const stepId = int(form, 'stepId');
		const index = int(form, 'index');
		if (
			stepId === undefined ||
			index === undefined ||
			!moveSlotTo(getDb(), routine.id, stepId, index, by(params, locals))
		) {
			return slotFail(t().routine.refused.move, stepId);
		}
		return done(routine.id);
	},

	deleteMany: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const stale = staleSlots(db, routine, form);
		if (stale) return stale;
		const stepIds = ints(form, 'stepIds');
		const snapshot =
			stepIds.length === 0
				? null
				: deleteSlots(getDb(), routine.id, stepIds, serverNow(), by(params, locals));
		if (!snapshot) return fail(400, { message: t().routine.refused.gone });
		// Handed back so the page can offer Undo, which posts it to `restore`.
		return done(routine.id, { snapshot });
	},

	restore: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const stale = staleSlots(db, routine, form);
		if (stale) return stale;
		const snapshot = parseSnapshots(String(form.get('snapshot') ?? ''));
		if (!snapshot || !restoreSlots(getDb(), routine.id, snapshot, by(params, locals))) {
			return fail(400, { message: t().routine.refused.putBack });
		}
		return done(routine.id);
	},

	// Unpack (spec 2026-11-12): the slot's section or routine opens into its slots here.
	unpack: async ({ params, request, locals }) => {
		const form = await request.formData();
		const routine = routineOf(params, locals);
		const stepId = int(form, 'stepId');
		const out =
			stepId === undefined ? null : unpackSlot(getDb(), routine.id, stepId, by(params, locals));
		if (!out) return fail(400, { message: t().routine.refused.unpack });
		return done(routine.id, { unpacked: out });
	},
	// Drag into a section held here, or back out (spec 2026-11-12): both ends must be this
	// routine or something it holds.
	moveInto: async ({ params, request, locals }) => {
		const form = await request.formData();
		const routine = routineOf(params, locals);
		const db = getDb();
		const stepId = int(form, 'stepId');
		const targetId = int(form, 'targetId');
		const index = int(form, 'index') ?? 1_000_000;
		const within = (id: number) => id === routine.id || holds(db, routine.id, id);
		const from =
			stepId === undefined
				? undefined
				: db
						.select({ r: routineSteps.routineId })
						.from(routineSteps)
						.where(eq(routineSteps.id, stepId))
						.get()?.r;
		if (
			stepId === undefined ||
			targetId === undefined ||
			from === undefined ||
			!within(from) ||
			!within(targetId) ||
			!moveSlotInto(db, stepId, targetId, index, by(params, locals), undefined, routine.id)
		) {
			return fail(400, { message: t().routine.refused.moveInto });
		}
		return done(routine.id, { from });
	},
	// Unpack's Undo.
	pack: async ({ params, request, locals }) => {
		const form = await request.formData();
		const routine = routineOf(params, locals);
		const sectionId = int(form, 'sectionId');
		const stepIds = ints(form, 'stepIds');
		const step =
			sectionId === undefined
				? null
				: packSlots(getDb(), routine.id, stepIds, sectionId, by(params, locals));
		if (step === null) return fail(400, { message: t().routine.refused.unpack });
		return done(routine.id, { stepId: step });
	},
	// Detach here (spec 2026-11-12): this one slot gets its own copy of the section.
	detachHere: async ({ params, request, locals }) => {
		const form = await request.formData();
		const routine = routineOf(params, locals);
		const stepId = int(form, 'stepId');
		const copy =
			stepId === undefined ? null : detachSection(getDb(), routine.id, stepId, by(params, locals));
		if (copy === null) return fail(400, { message: t().routine.refused.detachHere });
		return done(routine.id, { sectionId: copy });
	},
	duplicateMany: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const stale = staleSlots(db, routine, form);
		if (stale) return stale;
		const stepIds = ints(form, 'stepIds');
		const copies =
			stepIds.length === 0
				? null
				: duplicateSlots(getDb(), routine.id, stepIds, by(params, locals));
		if (copies === null) return fail(400, { message: t().routine.refused.copySlots });
		// The copies glow where they landed, and Undo removes them (spec 2026-11-12, D1).
		return done(routine.id, { copies });
	},

	extract: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const stale = staleSlots(db, routine, form, 'extract');
		if (stale) return stale;
		// Section (spec 2026-11-12): no name asked; an unnamed section at once.
		const stepIds = ints(form, 'stepIds');
		const made =
			stepIds.length === 0 ? null : makeSection(getDb(), routine.id, stepIds, by(params, locals));
		if (!made) {
			return fail(400, {
				action: 'extract',
				message: t().routine.refused.extract
			});
		}
		return done(routine.id, { stepId: made.stepId });
	}
} satisfies Actions);

/** The slot a section's page was opened from (`?from=<step id>`), when it holds this one. */
function fromSlot(db: ReturnType<typeof getDb>, url: URL, id: number) {
	const stepId = Number(url.searchParams.get('from'));
	if (!Number.isInteger(stepId) || stepId <= 0) return null;
	const step = db
		.select({ routineId: routineSteps.routineId, childId: routineSteps.childRoutineId })
		.from(routineSteps)
		.where(eq(routineSteps.id, stepId))
		.get();
	if (!step || step.childId !== id) return null;
	const parent = getRoutine(db, step.routineId);
	return parent
		? { stepId, routineId: parent.id, name: parent.name || t().routine.section.unnamed }
		: null;
}

/**
 * The picker's routines (spec 2026-11-12, P2): this routine's own named sections
 * first, then each routine followed by the named sections it holds, then any
 * section held only elsewhere.
 */
function pickOrder<T extends { id: number; isSection: boolean; holders: { id: number }[] }>(
	routineId: number,
	rows: T[]
): T[] {
	const sections = rows.filter((r) => r.isSection);
	const out: T[] = sections.filter((s) => s.holders.some((h) => h.id === routineId));
	for (const r of rows.filter((x) => !x.isSection)) {
		out.push(
			r,
			...sections.filter((s) => !out.includes(s) && s.holders.some((h) => h.id === r.id))
		);
	}
	return [...out, ...sections.filter((s) => !out.includes(s))];
}

/** How many live slots of its owner's routines hold this section. */
function usesOf(
	db: ReturnType<typeof getDb>,
	section: { id: number; userId: string | null; teamId: number | null }
) {
	return db
		.select({ id: routineSteps.id, userId: routines.userId, teamId: routines.teamId })
		.from(routineSteps)
		.innerJoin(routines, eq(routines.id, routineSteps.routineId))
		.where(and(eq(routineSteps.childRoutineId, section.id), isNull(routines.archivedAt)))
		.all()
		.filter((s) => s.userId === section.userId && s.teamId === section.teamId).length;
}
