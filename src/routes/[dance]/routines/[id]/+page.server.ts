import { fail, redirect } from '@sveltejs/kit';
import { getDb, type Db } from '$lib/server/db';
import { figureLabels, listVersions } from '$lib/server/figures';
import { graphFor } from '$lib/server/graph';
import { usableOf } from '$lib/server/usable';
import { routineTaughtIn } from '$lib/server/lessons';
import { listPositions } from '$lib/server/positions';
import {
	addOption,
	archiveRoutine,
	deleteSlots,
	duplicateRoutine,
	duplicateSlots,
	embeddable,
	embeddedIn,
	extractRoutine,
	insertSlot,
	moveSlotTo,
	removeOption,
	restoreOption,
	restoreSlots,
	routineShapes,
	routineSlots,
	setSlotNote,
	updateRoutine
} from '$lib/server/routines';
import {
	breaks,
	loops,
	positionSeams,
	routineEnd,
	routineStarts,
	rowEdges,
	timingBreaks,
	timingSeams,
	type OptionsSlot
} from '$lib/routines/routines';
import { endOf, figureById, nextCountOf, startsOf } from '$lib/graph/graph';
import { int, ints, optionalText, text } from '$lib/server/form';
import { parseSnapshots } from '$lib/routines/snapshot';
import type { Candidate } from '$lib/routines/fit';
import { isTeam, requireRoutineAccess, spaceOfRow, wallOf } from '$lib/server/scope';
import { entryFor } from '$lib/server/entries';
import { MISSING_SEEN, routineSeen, seenRefusal } from '$lib/server/clash';
import { goneTitle, routineFingerprint, staleRoutine } from '$lib/clash/clash';
import { archivedRefusal, editedBy } from '$lib/server/changes';
import type { Routine } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

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
			note: s.note
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
		return fail(410, { ...named, message: goneTitle(gone, Date.now()), gone });
	}
	const sent = form.get('fingerprint');
	if (typeof sent !== 'string' || sent === '') {
		return routine.teamId !== null ? fail(400, { ...named, message: MISSING_SEEN }) : null;
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

export const load: PageServerLoad = ({ params, locals }) => {
	const wall = wallOf(params, locals);
	const db = getDb();
	const { routine, space, access, reach: visible } = routineIn(params, locals, 'read');
	const canEdit = access === 'edit';
	// A reader's lists hold only what the published lessons reach (risk 20).
	// A person's routine may hold the group figures and routines they may use
	// (`usableOf`): those are on the graph, named, and offered to embed.
	const usable = isTeam(space) ? undefined : usableOf(db, space);
	const graph = graphFor(db, space, usable);
	const shapes = routineShapes(db, space, { usable, extra: usable?.routines });
	const shape = shapes.get(routine.id) ?? { slots: [] };
	const slots = routineSlots(db, routine.id, usable);
	const positions = listPositions(db, wall.dance);
	// A reader is told the names this routine's own slots use, and no other: its
	// slots (and its embedded routines') are in their reach by construction.
	const named = new Set(
		shape.slots.flatMap((s) => (s.kind === 'options' ? [s] : s.slots).flatMap((o) => o.figureIds))
	);
	const labels = [...figureLabels(db, space, usable)].filter(([id]) => !visible || named.has(id));

	// Flat indices where the routine's walk breaks — a slot's alternatives don't
	// share a start with the slot before it. Only the break count above the
	// slots reads these; the seams between cards come from `positionSeams` and
	// `timingSeams`, which are indexed by row.
	const flatBreaks = new Set(breaks(graph, shape));

	// What the picker can offer, each with where it begins and lands — resolved
	// here, through the graph, so an untagged figure is neutral on the client
	// exactly as it is on the server. Archived figures are not candidates; a slot
	// still holding one names it through `labels`.
	const candidates: Candidate[] = !canEdit
		? []
		: [
				...listVersions(db, space).flatMap((v): Candidate[] => {
					const node = figureById(graph, v.id);
					if (!node) return [];
					return [
						{
							kind: 'figure',
							id: v.id,
							groupId: v.groupId,
							figure: v.figure,
							label: v.label,
							starts: startsOf(graph, node),
							startCounts: [node.start],
							end: endOf(graph, node),
							next: nextCountOf(node)
						}
					];
				}),
				...embeddable(db, routine.id, usable).map((r): Candidate => {
					// An embeddable routine embeds nothing, so its own slots are all options.
					const own = (shapes.get(r.id)?.slots ?? []).filter(
						(s): s is OptionsSlot => s.kind === 'options'
					);
					return {
						kind: 'routine',
						id: r.id,
						groupId: null,
						figure: null,
						label: r.name,
						...rowEdges(graph, { kind: 'child', routineId: r.id, slots: own })
					};
				})
			];

	return {
		routine: { id: routine.id, name: routine.name, notes: routine.notes },
		canEdit,
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
		// Names for every figure a slot can hold, archived ones included, so a slot
		// whose variation was archived still says what it was.
		labels: Object.fromEntries(labels),
		positions: positions.map((p) => ({ id: p.id, name: p.name })),
		starts: routineStarts(graph, shape),
		end: routineEnd(graph, shape),
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
		// Per row, parallel to `slots`: where it begins and lands — the picker's
		// anchors and the seams' labels.
		edges: shape.slots.map((s) => rowEdges(graph, s)),
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

export const actions: Actions = {
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
				message: 'Give the routine a name (up to 200 characters).',
				...typed
			});
		}
		if (notes === undefined) {
			return fail(400, {
				action: 'rename',
				field: 'notes',
				message: 'Notes are up to 2000 characters.',
				...typed
			});
		}
		const clash = seenRefusal(
			form,
			routine.teamId !== null,
			routine.archivedAt === null ? routineSeen(routine) : null,
			{ action: 'rename' as const, ...typed },
			Date.now(),
			() => editedBy(db, routine.teamId, 'routine', routine.id)
		);
		if (clash) return clash;
		updateRoutine(db, routine.id, { name, notes }, by(params, locals));
		return { ok: true };
	},

	duplicate: async ({ params, locals }) => {
		const routine = routineOf(params, locals);
		const copy = duplicateRoutine(getDb(), routine.id, by(params, locals));
		if (!copy) return fail(400, { message: 'Could not copy that routine.' });
		// Straight to the copy: you duplicated it in order to change it, and landing
		// back on the original is how you end up editing the wrong one.
		throw redirect(303, `/${params.dance}/routines/${copy.id}`);
	},

	archive: async ({ params, locals }) => {
		const routine = routineOf(params, locals);
		// The boolean is deliberately ignored: archiving twice is idempotent — the
		// row is archived either way and the list omits it — so a second attempt is
		// a no-op worth redirecting, not an error worth reporting.
		archiveRoutine(getDb(), routine.id, Date.now(), by(params, locals));
		throw redirect(303, `/${params.dance}/routines`);
	},

	addOption: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const stale = staleSlots(db, routine, form);
		if (stale) return stale;
		const stepId = int(form, 'stepId');
		const figureId = int(form, 'figureId');
		if (stepId === undefined || figureId === undefined) {
			return slotFail('Could not read that slot or figure.', stepId);
		}
		if (!ownsSlot(db, routine.id, stepId)) {
			return slotFail('That slot does not belong to this routine.', stepId);
		}
		if (!addOption(db, stepId, figureId, by(params, locals))) {
			const space = spaceOfRow(routine, by(params, locals));
			const archived = archivedRefusal(db, space, { figureId }, { stepId });
			if (archived) return archived;
			return slotFail(
				'That figure does not start and land like this slot’s figure, so it is not an alternative.',
				stepId
			);
		}
		return done(routine.id);
	},

	removeOption: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const stale = staleSlots(db, routine, form);
		if (stale) return stale;
		const stepId = int(form, 'stepId');
		const figureId = int(form, 'figureId');
		if (stepId === undefined || figureId === undefined) {
			return slotFail('Could not read that slot or figure.', stepId);
		}
		if (!ownsSlot(db, routine.id, stepId)) {
			return slotFail('That slot does not belong to this routine.', stepId);
		}
		const now = Date.now();
		if (!removeOption(db, stepId, figureId, now, by(params, locals))) {
			return slotFail('A slot has to hold something.', stepId);
		}
		// Handed back so Undo can bring back the entries this remove took (R10).
		return done(routine.id, { removedAt: now });
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
			return slotFail('Keep the note to 200 characters.', stepId);
		}
		if (stepId === undefined || !ownsSlot(db, routine.id, stepId)) {
			return slotFail('That slot does not belong to this routine.', stepId);
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
			return fail(400, { message: 'Could not read what to add, or where.' });
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
				return archived ?? fail(400, { message: 'That routine cannot be embedded here.' });
			}
			return done(routine.id, { stepId });
		}
		const stepId = insertSlot(
			db,
			routine.id,
			at,
			{ figureId: figureId as number },
			by(params, locals)
		);
		if (stepId === null) {
			const space = spaceOfRow(routine, by(params, locals));
			const archived = archivedRefusal(db, space, { figureId: figureId as number }, {});
			return archived ?? fail(400, { message: 'That figure is not part of this dance.' });
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
			return slotFail('That slot cannot move there.', stepId);
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
				: deleteSlots(getDb(), routine.id, stepIds, Date.now(), by(params, locals));
		if (!snapshot) return fail(400, { message: 'Those slots are already gone.' });
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
			return fail(400, { message: 'Those slots could not be put back.' });
		}
		return done(routine.id);
	},

	restoreOption: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const stale = staleSlots(db, routine, form);
		if (stale) return stale;
		const stepId = int(form, 'stepId');
		const figureId = int(form, 'figureId');
		if (stepId === undefined || figureId === undefined) {
			return slotFail('Could not read that slot or figure.', stepId);
		}
		if (!ownsSlot(db, routine.id, stepId)) {
			return slotFail('That slot does not belong to this routine.', stepId);
		}
		const removedAt = int(form, 'removedAt');
		if (!restoreOption(db, stepId, figureId, by(params, locals), removedAt)) {
			return slotFail('That alternative could not be put back.', stepId);
		}
		return done(routine.id);
	},

	duplicateMany: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const stale = staleSlots(db, routine, form);
		if (stale) return stale;
		const stepIds = ints(form, 'stepIds');
		if (
			stepIds.length === 0 ||
			duplicateSlots(getDb(), routine.id, stepIds, by(params, locals)) === null
		) {
			return fail(400, { message: 'Those slots could not be copied.' });
		}
		return done(routine.id);
	},

	extract: async ({ params, request, locals }) => {
		const db = getDb();
		const form = await request.formData();
		// Read after the body: the routine as it is now, not before the wait.
		const routine = routineOf(params, locals);
		const stale = staleSlots(db, routine, form, 'extract');
		if (stale) return stale;
		const stepIds = ints(form, 'stepIds');
		const name = text(form, 'name');
		if (!name) {
			return fail(400, {
				action: 'extract',
				field: 'name',
				message: 'Give the new routine a name (up to 200 characters).',
				name: String(form.get('name') ?? '')
			});
		}
		const made =
			stepIds.length === 0
				? null
				: extractRoutine(getDb(), routine.id, stepIds, name, by(params, locals));
		if (!made) {
			return fail(400, {
				action: 'extract',
				message:
					'Those slots cannot become a routine: they have to sit next to each other and hold no routine, and this routine cannot itself be embedded anywhere.'
			});
		}
		return done(routine.id, { stepId: made.stepId });
	}
};
