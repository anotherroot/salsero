import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb, type Db } from '$lib/server/db';
import { exercises } from '$lib/server/db/schema';
import { figureLabels, listVersions } from '$lib/server/figures';
import { buildGraph } from '$lib/server/graph';
import { routineTaughtIn } from '$lib/server/lessons';
import { listPositions } from '$lib/server/positions';
import { listReadySongs } from '$lib/server/songs';
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
import { danceOf, requireRoutineInDance } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

/**
 * The routine this URL names, or a 404 — the same shape `figureOf`, `songOf`
 * and `lessonOf` use on their own detail pages. A form action runs before the
 * `[dance]` layout's gate, so the dance has to be resolved here on every
 * path, and doing it once by name beats nine copies.
 */
function routineOf(params: { dance: string; id: string }) {
	return requireRoutineInDance(getDb(), danceOf(params), Number(params.id));
}

export const load: PageServerLoad = ({ params }) => {
	const dance = danceOf(params);
	const db = getDb();
	const routine = routineOf(params);
	const graph = buildGraph(db, dance);
	const shapes = routineShapes(db, dance);
	const shape = shapes.get(routine.id) ?? { slots: [] };
	const slots = routineSlots(db, routine.id);
	const positions = listPositions(db, dance);

	// Flat indices where the routine's walk breaks — a slot's alternatives don't
	// share a start with the slot before it. The picker offers every figure of
	// the dance regardless; `addOption`'s shared-end check is what actually
	// refuses a wrong-end pick.
	const flatBreaks = new Set(breaks(graph, shape));

	// What the picker can offer, each with where it begins and lands — resolved
	// here, through the graph, so an untagged figure is neutral on the client
	// exactly as it is on the server. Archived figures are not candidates; a slot
	// still holding one names it through `labels`.
	const candidates: Candidate[] = [
		...listVersions(db, dance).flatMap((v): Candidate[] => {
			const node = figureById(graph, v.id);
			if (!node) return [];
			return [
				{
					kind: 'figure',
					id: v.id,
					parentId: v.parentId,
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
				parentId: null,
				label: r.name,
				...rowEdges(graph, { kind: 'child', routineId: r.id, slots: own })
			};
		})
	];

	return {
		routine: { id: routine.id, name: routine.name, notes: routine.notes },
		// The routine's own exercise, so "Practise" can hand the player an exercise
		// id and the save sheet comes up with the right one already chosen.
		exerciseId:
			db
				.select({ id: exercises.id })
				.from(exercises)
				.where(eq(exercises.routineId, routine.id))
				.get()?.id ?? null,
		// Ready songs, so a routine can be practised over one. The player loads the
		// grid from `?song=`, so this only has to name them.
		songs: listReadySongs(db, dance),
		slots,
		// Names for every figure a slot can hold, archived ones included, so a slot
		// whose variation was archived still says what it was.
		labels: Object.fromEntries(figureLabels(db, dance)),
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
		taughtIn: routineTaughtIn(db, routine.id),
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
 * The page has one `addOption` form PER SLOT and they all fail with the same
 * sentence, so a bare message in the banner at the top says nothing about which
 * submission was refused — and `use:enhance` does not scroll, so from slot nine
 * of a long routine the refusal is invisible. A wrong-landing alternative pick is
 * ordinary use here, not an edge case: the picker deliberately offers every
 * figure, because the load carries no per-figure end to filter it by.
 *
 * `stepId` is omitted when the body's slot id could not be read at all. There is
 * no slot to attribute that to, and the page's banner is its right home.
 */
function slotFail(message: string, stepId: number | undefined) {
	return stepId === undefined ? fail(400, { message }) : fail(400, { message, stepId });
}

export const actions: Actions = {
	rename: async ({ params, request }) => {
		const routine = routineOf(params);
		const db = getDb();
		const form = await request.formData();
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		if (!name || notes === undefined) {
			return fail(400, { message: 'Give the routine a name (up to 200 characters).' });
		}
		updateRoutine(db, routine.id, { name, notes });
		return { ok: true };
	},

	duplicate: async ({ params }) => {
		const routine = routineOf(params);
		const copy = duplicateRoutine(getDb(), routine.id);
		if (!copy) return fail(400, { message: 'Could not copy that routine.' });
		// Straight to the copy: you duplicated it in order to change it, and landing
		// back on the original is how you end up editing the wrong one.
		throw redirect(303, `/${params.dance}/routines/${copy.id}`);
	},

	archive: async ({ params }) => {
		const routine = routineOf(params);
		// The boolean is deliberately ignored: archiving twice is idempotent — the
		// row is archived either way and the list omits it — so a second attempt is
		// a no-op worth redirecting, not an error worth reporting.
		archiveRoutine(getDb(), routine.id, Date.now());
		throw redirect(303, `/${params.dance}/routines`);
	},

	addOption: async ({ params, request }) => {
		const routine = routineOf(params);
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
				'Those figures do not land in the same place or on the same count, so they are not alternatives.',
				stepId
			);
		}
		return { ok: true };
	},

	removeOption: async ({ params, request }) => {
		const routine = routineOf(params);
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

	note: async ({ params, request }) => {
		const routine = routineOf(params);
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

	insert: async ({ params, request }) => {
		const routine = routineOf(params);
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

	reorder: async ({ params, request }) => {
		const routine = routineOf(params);
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

	deleteMany: async ({ params, request }) => {
		const routine = routineOf(params);
		const form = await request.formData();
		const stepIds = ints(form, 'stepIds');
		const snapshot = stepIds.length === 0 ? null : deleteSlots(getDb(), routine.id, stepIds);
		if (!snapshot) return fail(400, { message: 'Those slots are already gone.' });
		// Handed back so the page can offer Undo, which posts it to `restore`.
		return { ok: true, snapshot };
	},

	restore: async ({ params, request }) => {
		const routine = routineOf(params);
		const form = await request.formData();
		const snapshot = parseSnapshots(String(form.get('snapshot') ?? ''));
		if (!snapshot || !restoreSlots(getDb(), routine.id, snapshot)) {
			return fail(400, { message: 'Those slots could not be put back.' });
		}
		return { ok: true };
	},

	restoreOption: async ({ params, request }) => {
		const routine = routineOf(params);
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

	duplicateMany: async ({ params, request }) => {
		const routine = routineOf(params);
		const form = await request.formData();
		const stepIds = ints(form, 'stepIds');
		if (stepIds.length === 0 || duplicateSlots(getDb(), routine.id, stepIds) === null) {
			return fail(400, { message: 'Those slots could not be copied.' });
		}
		return { ok: true };
	},

	extract: async ({ params, request }) => {
		const routine = routineOf(params);
		const form = await request.formData();
		const stepIds = ints(form, 'stepIds');
		const name = text(form, 'name');
		if (!name) return fail(400, { message: 'Give the new routine a name (up to 200 characters).' });
		const made = stepIds.length === 0 ? null : extractRoutine(getDb(), routine.id, stepIds, name);
		if (!made) {
			return fail(400, {
				message:
					'Those slots cannot become a routine: they have to sit next to each other and hold no routine, and this routine cannot itself be embedded anywhere.'
			});
		}
		return { ok: true, stepId: made.stepId };
	}
};
