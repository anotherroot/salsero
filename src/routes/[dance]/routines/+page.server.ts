import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { buildGraph } from '$lib/server/graph';
import { createRoutine, listRoutines, routineShapes } from '$lib/server/routines';
import { breaks, loops } from '$lib/routines/routines';
import { optionalText, text } from '$lib/server/form';
import { danceOf } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const dance = danceOf(params);
	const db = getDb();
	const graph = buildGraph(db, dance);
	const shapes = routineShapes(db, dance);
	// Derived per request, never stored — the same rule urgency follows. A tag
	// edited on a figure page changes these answers with no routine touched.
	return {
		routines: listRoutines(db, dance).map((r) => {
			const shape = shapes.get(r.id) ?? { slots: [] };
			return {
				...r,
				loops: loops(graph, shape),
				breaks: breaks(graph, shape).length
			};
		})
	};
};

export const actions: Actions = {
	create: async ({ params, request }) => {
		const dance = danceOf(params);
		const form = await request.formData();
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		if (!name || notes === undefined) {
			return fail(400, {
				message: 'Give the routine a name (up to 200 characters).',
				name: String(form.get('name') ?? ''),
				notes: String(form.get('notes') ?? '')
			});
		}
		const { routine } = createRoutine(getDb(), dance, { name, notes });
		throw redirect(303, `/${dance}/routines/${routine.id}`);
	}
	// No `archive` here on purpose. Archiving a routine is a real loss of a thing
	// you built, and a Remove button sitting on every row of the library is one
	// mis-tap away from it. It lives on the routine's own page, behind a confirm,
	// where you have already opened the thing you are about to discard.
};
