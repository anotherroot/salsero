import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb, type Db } from '$lib/server/db';
import { exercises } from '$lib/server/db/schema';
import { listFigures } from '$lib/server/figures';
import { buildGraph } from '$lib/server/graph';
import { listPositions } from '$lib/server/positions';
import {
	addChildSlot,
	addFigureSlot,
	addOption,
	archiveRoutine,
	deleteSlot,
	embeddable,
	moveSlot,
	removeOption,
	routineShapes,
	routineSlots,
	setSlotNote,
	updateRoutine
} from '$lib/server/routines';
import { breaks, loops, routineEnd, routineStarts, slotStarts } from '$lib/routines/routines';
import { int, optionalText, text } from '$lib/server/form';
import { danceOf, requireRoutineInDance } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const dance = danceOf(params);
	const db = getDb();
	const routine = requireRoutineInDance(db, dance, Number(params.id));
	const graph = buildGraph(db, dance);
	const shape = routineShapes(db, dance).get(routine.id) ?? { slots: [] };
	const slots = routineSlots(db, routine.id);
	const positions = listPositions(db, dance);
	const figures = listFigures(db, dance, {}).map((f) => ({ id: f.id, name: f.name }));

	// Which figures could be added as an option to each slot: the ones that end
	// where that slot already ends. Suggestion, not restriction — the write path
	// is what refuses, and it refuses for the same reason.
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
		hasChild: slots.some((s) => s.childId !== null),
		embeddable: embeddable(db, routine.id),
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

export const actions: Actions = {
	rename: async ({ params, request }) => {
		const dance = danceOf(params);
		const db = getDb();
		const routine = requireRoutineInDance(db, dance, Number(params.id));
		const form = await request.formData();
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		if (!name || notes === undefined) {
			return fail(400, { message: 'Give the routine a name (up to 200 characters).' });
		}
		updateRoutine(db, routine.id, { name, notes });
		return { ok: true };
	},

	archive: async ({ params }) => {
		const dance = danceOf(params);
		const db = getDb();
		const routine = requireRoutineInDance(db, dance, Number(params.id));
		archiveRoutine(db, routine.id, Date.now());
		throw redirect(303, `/${dance}/routines`);
	},

	addFigure: async ({ params, request }) => {
		const dance = danceOf(params);
		const db = getDb();
		const routine = requireRoutineInDance(db, dance, Number(params.id));
		const form = await request.formData();
		const figureId = int(form, 'figureId');
		if (figureId === undefined || addFigureSlot(db, routine.id, figureId) === null) {
			return fail(400, { message: 'That figure is not part of this dance.' });
		}
		return { ok: true };
	},

	addChild: async ({ params, request }) => {
		const dance = danceOf(params);
		const db = getDb();
		const routine = requireRoutineInDance(db, dance, Number(params.id));
		const form = await request.formData();
		const childId = int(form, 'childId');
		if (childId === undefined || addChildSlot(db, routine.id, childId) === null) {
			return fail(400, { message: 'That routine cannot be embedded here.' });
		}
		return { ok: true };
	},

	addOption: async ({ params, request }) => {
		const dance = danceOf(params);
		const db = getDb();
		const routine = requireRoutineInDance(db, dance, Number(params.id));
		const form = await request.formData();
		const stepId = int(form, 'stepId');
		const figureId = int(form, 'figureId');
		if (stepId === undefined || figureId === undefined || !ownsSlot(db, routine.id, stepId)) {
			return fail(400, { message: 'That slot does not belong to this routine.' });
		}
		if (!addOption(db, stepId, figureId)) {
			return fail(400, {
				message: 'Those figures do not end in the same place, so they are not variants.'
			});
		}
		return { ok: true };
	},

	removeOption: async ({ params, request }) => {
		const dance = danceOf(params);
		const db = getDb();
		const routine = requireRoutineInDance(db, dance, Number(params.id));
		const form = await request.formData();
		const stepId = int(form, 'stepId');
		const figureId = int(form, 'figureId');
		if (stepId === undefined || figureId === undefined || !ownsSlot(db, routine.id, stepId)) {
			return fail(400, { message: 'That slot does not belong to this routine.' });
		}
		if (!removeOption(db, stepId, figureId)) {
			return fail(400, { message: 'A slot has to hold something.' });
		}
		return { ok: true };
	},

	note: async ({ params, request }) => {
		const dance = danceOf(params);
		const db = getDb();
		const routine = requireRoutineInDance(db, dance, Number(params.id));
		const form = await request.formData();
		const stepId = int(form, 'stepId');
		const note = optionalText(form, 'note', 200);
		if (note === undefined) {
			return fail(400, { message: 'Keep the note to 200 characters.' });
		}
		if (stepId === undefined || !ownsSlot(db, routine.id, stepId)) {
			return fail(400, { message: 'That slot does not belong to this routine.' });
		}
		setSlotNote(db, stepId, note);
		return { ok: true };
	},

	remove: async ({ params, request }) => {
		const dance = danceOf(params);
		const db = getDb();
		const routine = requireRoutineInDance(db, dance, Number(params.id));
		const form = await request.formData();
		const stepId = int(form, 'stepId');
		if (stepId === undefined || !deleteSlot(db, routine.id, stepId)) {
			return fail(400, { message: 'That slot is already gone.' });
		}
		return { ok: true };
	},

	move: async ({ params, request }) => {
		const dance = danceOf(params);
		const db = getDb();
		const routine = requireRoutineInDance(db, dance, Number(params.id));
		const form = await request.formData();
		const stepId = int(form, 'stepId');
		const delta = int(form, 'delta');
		if (
			stepId === undefined ||
			(delta !== -1 && delta !== 1) ||
			!moveSlot(db, routine.id, stepId, delta)
		) {
			return fail(400, { message: 'That slot cannot move that way.' });
		}
		return { ok: true };
	}
};
