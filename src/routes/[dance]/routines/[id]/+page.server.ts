import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb, type Db } from '$lib/server/db';
import { exercises } from '$lib/server/db/schema';
import { listFigures } from '$lib/server/figures';
import { buildGraph } from '$lib/server/graph';
import { routineTaughtIn } from '$lib/server/lessons';
import { listPositions } from '$lib/server/positions';
import { listReadySongs } from '$lib/server/songs';
import {
	addChildSlot,
	addFigureSlot,
	addOption,
	archiveRoutine,
	deleteSlot,
	duplicateRoutine,
	duplicateSlot,
	embeddable,
	moveSlot,
	removeOption,
	routineShapes,
	routineSlots,
	setSlotNote,
	updateRoutine
} from '$lib/server/routines';
import {
	breaks,
	loops,
	routineEnd,
	routineStarts,
	slotStarts,
	slotTiming,
	timingBreaks
} from '$lib/routines/routines';
import { endOf, figureById, nextCountOf } from '$lib/graph/graph';
import { int, optionalText, text } from '$lib/server/form';
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
	const shape = routineShapes(db, dance).get(routine.id) ?? { slots: [] };
	const slots = routineSlots(db, routine.id);
	const positions = listPositions(db, dance);
	// Each figure's landing — where it leaves the hands and on which count — so
	// the alternative picker can offer only the ones that fit a slot. The
	// server's `addOption` still decides; this only stops offering the refusals.
	const figures = listFigures(db, dance, {}).map((f) => {
		const node = figureById(graph, f.id);
		return {
			id: f.id,
			name: f.name,
			end: node ? endOf(graph, node) : null,
			next: node ? nextCountOf(node) : null
		};
	});

	// Flat indices where the routine's walk breaks — a slot's alternatives don't
	// share a start with the slot before it. The picker offers every figure of
	// the dance regardless; `addOption`'s shared-end check is what actually
	// refuses a wrong-end pick.
	const flatBreaks = new Set(breaks(graph, shape));

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
		figures,
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
		// Per slot, parallel to `slots`: which counts it begins on and which it
		// leaves the next on — the "5→1" on each row.
		slotTiming: shape.slots.map((s) => slotTiming(graph, s)),
		hasChild: slots.some((s) => s.childId !== null),
		embeddable: embeddable(db, routine.id),
		taughtIn: routineTaughtIn(db, routine.id),
		// Per slot: where it can be entered from, so the editor can say so.
		slotStarts: shape.slots.map((s) =>
			s.kind === 'child'
				? slotStarts(graph, s.slots[0] ?? { kind: 'options', figureIds: [] })
				: slotStarts(graph, s)
		)
	};
};

/**
 * Whether `stepId` names one of this routine's own slots.
 *
 * `addOption`, `removeOption` and `setSlotNote` take a bare slot id with no
 * routine id to check it against — unlike `deleteSlot` and `moveSlot`, which
 * take `routine.id` and enforce this themselves. Without this lookup here, a
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

	duplicateSlot: async ({ params, request }) => {
		const routine = routineOf(params);
		const form = await request.formData();
		const stepId = int(form, 'stepId');
		if (stepId === undefined || duplicateSlot(getDb(), routine.id, stepId) === null) {
			return slotFail('That slot could not be copied.', stepId);
		}
		return { ok: true };
	},

	archive: async ({ params }) => {
		const routine = routineOf(params);
		// The boolean is deliberately ignored: archiving twice is idempotent — the
		// row is archived either way and the list omits it — so a second attempt is
		// a no-op worth redirecting, not an error worth reporting.
		archiveRoutine(getDb(), routine.id, Date.now());
		throw redirect(303, `/${params.dance}/routines`);
	},

	addFigure: async ({ params, request }) => {
		const routine = routineOf(params);
		const db = getDb();
		const form = await request.formData();
		const figureId = int(form, 'figureId');
		if (figureId === undefined || addFigureSlot(db, routine.id, figureId) === null) {
			return fail(400, { message: 'That figure is not part of this dance.' });
		}
		return { ok: true };
	},

	addChild: async ({ params, request }) => {
		const routine = routineOf(params);
		const db = getDb();
		const form = await request.formData();
		const childId = int(form, 'childId');
		if (childId === undefined || addChildSlot(db, routine.id, childId) === null) {
			return fail(400, { message: 'That routine cannot be embedded here.' });
		}
		return { ok: true };
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

	remove: async ({ params, request }) => {
		const routine = routineOf(params);
		const db = getDb();
		const form = await request.formData();
		const stepId = int(form, 'stepId');
		if (stepId === undefined || !deleteSlot(db, routine.id, stepId)) {
			return slotFail('That slot is already gone.', stepId);
		}
		return { ok: true };
	},

	move: async ({ params, request }) => {
		const routine = routineOf(params);
		const db = getDb();
		const form = await request.formData();
		const stepId = int(form, 'stepId');
		const delta = int(form, 'delta');
		if (
			stepId === undefined ||
			(delta !== -1 && delta !== 1) ||
			!moveSlot(db, routine.id, stepId, delta)
		) {
			return slotFail('That slot cannot move that way.', stepId);
		}
		return { ok: true };
	}
};
