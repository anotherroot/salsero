import { fail, redirect } from '@sveltejs/kit';
import { getDb, type Db } from '$lib/server/db';
import { figureLabels, listVersions } from '$lib/server/figures';
import { buildGraph } from '$lib/server/graph';
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
import { requireRoutineAccess, wallOf } from '$lib/server/scope';
import { entryFor } from '$lib/server/entries';
import type { Actions, PageServerLoad } from './$types';

/**
 * The routine this URL names, or a 404 — the same shape `figureOf`, `songOf`
 * and `lessonOf` use on their own detail pages. A form action runs before the
 * `[dance]` layout's gate, so the dance has to be resolved here on every
 * path, and doing it once by name beats nine copies.
 */
function routineOf(params: { dance: string; id: string }, locals: App.Locals) {
	return routineIn(params, locals).routine;
}

/**
 * The routine and the space it stands in (a person's or a group's). Edit, the
 * load included: this page is built from the routine's own space, never from
 * reach, so it is not a page a reader may open.
 */
function routineIn(params: { dance: string; id: string }, locals: App.Locals) {
	return requireRoutineAccess(getDb(), locals, params, params.id, 'edit');
}

export const load: PageServerLoad = ({ params, locals }) => {
	const wall = wallOf(params, locals);
	const db = getDb();
	const { routine, space } = routineIn(params, locals);
	const graph = buildGraph(db, space);
	const shapes = routineShapes(db, space);
	const shape = shapes.get(routine.id) ?? { slots: [] };
	const slots = routineSlots(db, routine.id);
	const positions = listPositions(db, wall.dance);

	// Flat indices where the routine's walk breaks — a slot's alternatives don't
	// share a start with the slot before it. Only the break count above the
	// slots reads these; the seams between cards come from `positionSeams` and
	// `timingSeams`, which are indexed by row.
	const flatBreaks = new Set(breaks(graph, shape));

	// What the picker can offer, each with where it begins and lands — resolved
	// here, through the graph, so an untagged figure is neutral on the client
	// exactly as it is on the server. Archived figures are not candidates; a slot
	// still holding one names it through `labels`.
	const candidates: Candidate[] = [
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
		...embeddable(db, routine.id).map((r): Candidate => {
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
		labels: Object.fromEntries(figureLabels(db, space)),
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
		taughtIn: routineTaughtIn(db, space, routine.id),
		candidates,
		// Per row, parallel to `slots`: where it begins and lands — the picker's
		// anchors and the seams' labels.
		edges: shape.slots.map((s) => rowEdges(graph, s)),
		positionSeams: positionSeams(graph, shape),
		// Why "Make routine" is greyed, named.
		embeddedIn: embeddedIn(db, routine.id).map((r) => r.name)
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
		const routine = routineOf(params, locals);
		const db = getDb();
		const form = await request.formData();
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
		updateRoutine(db, routine.id, { name, notes });
		return { ok: true };
	},

	duplicate: async ({ params, locals }) => {
		const routine = routineOf(params, locals);
		const copy = duplicateRoutine(getDb(), routine.id);
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
		archiveRoutine(getDb(), routine.id, Date.now());
		throw redirect(303, `/${params.dance}/routines`);
	},

	addOption: async ({ params, request, locals }) => {
		const routine = routineOf(params, locals);
		const db = getDb();
		const form = await request.formData();
		const stepId = int(form, 'stepId');
		const figureId = int(form, 'figureId');
		if (stepId === undefined || figureId === undefined) {
			return slotFail('Could not read that slot or figure.', stepId);
		}
		if (!ownsSlot(db, routine.id, stepId)) {
			return slotFail('That slot does not belong to this routine.', stepId);
		}
		if (!addOption(db, stepId, figureId)) {
			return slotFail(
				'That figure does not start and land like this slot’s figure, so it is not an alternative.',
				stepId
			);
		}
		return { ok: true };
	},

	removeOption: async ({ params, request, locals }) => {
		const routine = routineOf(params, locals);
		const db = getDb();
		const form = await request.formData();
		const stepId = int(form, 'stepId');
		const figureId = int(form, 'figureId');
		if (stepId === undefined || figureId === undefined) {
			return slotFail('Could not read that slot or figure.', stepId);
		}
		if (!ownsSlot(db, routine.id, stepId)) {
			return slotFail('That slot does not belong to this routine.', stepId);
		}
		if (!removeOption(db, stepId, figureId)) {
			return slotFail('A slot has to hold something.', stepId);
		}
		return { ok: true };
	},

	note: async ({ params, request, locals }) => {
		const routine = routineOf(params, locals);
		const db = getDb();
		const form = await request.formData();
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
		setSlotNote(db, stepId, note);
		return { ok: true };
	},

	insert: async ({ params, request, locals }) => {
		const routine = routineOf(params, locals);
		const db = getDb();
		const form = await request.formData();
		const at = int(form, 'at');
		const figureId = int(form, 'figureId');
		const childId = int(form, 'childId');
		if (at === undefined || (figureId === undefined) === (childId === undefined)) {
			return fail(400, { message: 'Could not read what to add, or where.' });
		}
		if (childId !== undefined) {
			// Only what the picker offered: `canEmbed` alone would accept an archived routine.
			const offered = embeddable(db, routine.id).some((r) => r.id === childId);
			const stepId = offered ? insertSlot(db, routine.id, at, { childId }) : null;
			if (stepId === null) return fail(400, { message: 'That routine cannot be embedded here.' });
			return { ok: true, stepId };
		}
		const stepId = insertSlot(db, routine.id, at, { figureId: figureId as number });
		if (stepId === null) return fail(400, { message: 'That figure is not part of this dance.' });
		return { ok: true, stepId };
	},

	reorder: async ({ params, request, locals }) => {
		const routine = routineOf(params, locals);
		const form = await request.formData();
		const stepId = int(form, 'stepId');
		const index = int(form, 'index');
		if (
			stepId === undefined ||
			index === undefined ||
			!moveSlotTo(getDb(), routine.id, stepId, index)
		) {
			return slotFail('That slot cannot move there.', stepId);
		}
		return { ok: true };
	},

	deleteMany: async ({ params, request, locals }) => {
		const routine = routineOf(params, locals);
		const form = await request.formData();
		const stepIds = ints(form, 'stepIds');
		const snapshot = stepIds.length === 0 ? null : deleteSlots(getDb(), routine.id, stepIds);
		if (!snapshot) return fail(400, { message: 'Those slots are already gone.' });
		// Handed back so the page can offer Undo, which posts it to `restore`.
		return { ok: true, snapshot };
	},

	restore: async ({ params, request, locals }) => {
		const routine = routineOf(params, locals);
		const form = await request.formData();
		const snapshot = parseSnapshots(String(form.get('snapshot') ?? ''));
		if (!snapshot || !restoreSlots(getDb(), routine.id, snapshot)) {
			return fail(400, { message: 'Those slots could not be put back.' });
		}
		return { ok: true };
	},

	restoreOption: async ({ params, request, locals }) => {
		const routine = routineOf(params, locals);
		const db = getDb();
		const form = await request.formData();
		const stepId = int(form, 'stepId');
		const figureId = int(form, 'figureId');
		if (stepId === undefined || figureId === undefined) {
			return slotFail('Could not read that slot or figure.', stepId);
		}
		if (!ownsSlot(db, routine.id, stepId)) {
			return slotFail('That slot does not belong to this routine.', stepId);
		}
		if (!restoreOption(db, stepId, figureId)) {
			return slotFail('That alternative could not be put back.', stepId);
		}
		return { ok: true };
	},

	duplicateMany: async ({ params, request, locals }) => {
		const routine = routineOf(params, locals);
		const form = await request.formData();
		const stepIds = ints(form, 'stepIds');
		if (stepIds.length === 0 || duplicateSlots(getDb(), routine.id, stepIds) === null) {
			return fail(400, { message: 'Those slots could not be copied.' });
		}
		return { ok: true };
	},

	extract: async ({ params, request, locals }) => {
		const routine = routineOf(params, locals);
		const form = await request.formData();
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
		const made = stepIds.length === 0 ? null : extractRoutine(getDb(), routine.id, stepIds, name);
		if (!made) {
			return fail(400, {
				action: 'extract',
				message:
					'Those slots cannot become a routine: they have to sit next to each other and hold no routine, and this routine cannot itself be embedded anywhere.'
			});
		}
		return { ok: true, stepId: made.stepId };
	}
};
