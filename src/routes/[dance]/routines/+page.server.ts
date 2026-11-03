import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { graphFor } from '$lib/server/graph';
import {
	createRoutine,
	listAddedRoutines,
	listRoutines,
	routineShapes
} from '$lib/server/routines';
import { breaks, loops, timingBreaks } from '$lib/routines/routines';
import { optionalText, text } from '$lib/server/form';
import { wallOf } from '$lib/server/scope';
import { groupModeOf, spaceOf } from '$lib/server/group-mode';
import { publishedReach } from '$lib/server/access';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals, cookies }) => {
	const wall = wallOf(params, locals);
	const db = getDb();
	const mode = groupModeOf(db, wall.userId, wall.dance, cookies);
	// In group mode the page reads the group's side; the person's own is not shown.
	const space = mode ? { dance: wall.dance, teamId: mode.teamId, actorId: wall.userId } : wall;
	const reach = mode ? publishedReach(db, mode.teamId) : null;
	// A person's routines may hold group figures they may use (`graphFor`).
	const graph = graphFor(db, space);
	const shapes = routineShapes(db, space);
	// Derived per request, never stored — the same rule urgency follows. A tag
	// edited on a figure page changes these answers with no routine touched.
	return {
		groups: mode ? [] : listAddedRoutines(db, wall),
		routines: listRoutines(db, space).map((r) => {
			const shape = shapes.get(r.id) ?? { slots: [] };
			return {
				...r,
				...(reach ? { membersSee: reach.routines.has(r.id) } : {}),
				loops: loops(graph, shape),
				// A seam that breaks in the hands AND on the count is one problem, not two.
				breaks: new Set([...breaks(graph, shape), ...timingBreaks(graph, shape)]).size
			};
		})
	};
};

export const actions: Actions = {
	create: async ({ params, request, locals, cookies }) => {
		const space = spaceOf(getDb(), params, locals, cookies);
		const form = await request.formData();
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		// A refusal names its field, so the sheet shows it under that field and
		// keeps everything typed.
		const refuse = (field: 'name' | 'notes', message: string) =>
			fail(400, {
				field,
				message,
				name: String(form.get('name') ?? ''),
				notes: String(form.get('notes') ?? '')
			});
		if (!name) return refuse('name', 'Give the routine a name (up to 200 characters).');
		if (notes === undefined) return refuse('notes', 'Notes are up to 2000 characters.');
		const { routine } = createRoutine(getDb(), space, { name, notes });
		throw redirect(303, `/${space.dance}/routines/${routine.id}`);
	}
	// No `archive` here on purpose. Archiving a routine is a real loss of a thing
	// you built, and a Remove button sitting on every row of the library is one
	// mis-tap away from it. It lives on the routine's own page, behind a confirm,
	// where you have already opened the thing you are about to discard.
};
