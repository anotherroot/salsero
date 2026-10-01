import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { listVersions } from '$lib/server/figures';
import { createRoutineFromFigures, listRoutines, routineShapes } from '$lib/server/routines';
import { ints, text } from '$lib/server/form';
import { coverage, coverageGroups } from '$lib/routines/coverage';
import { danceOf } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const dance = danceOf(params);
	const db = getDb();
	// Derived per request, never stored: a slot edited on a routine page
	// changes these answers with nothing else touched.
	return {
		groups: coverageGroups(
			coverage(listVersions(db, dance), routineShapes(db, dance), listRoutines(db, dance))
		)
	};
};

export const actions: Actions = {
	/** A new routine from the picked versions, in the order they were picked. */
	create: async ({ params, request }) => {
		const dance = danceOf(params);
		const form = await request.formData();
		const name = text(form, 'name');
		// `ints` keeps first-seen order and drops duplicates.
		const figureIds = ints(form, 'figureIds');
		if (!name) {
			return fail(400, {
				message: 'Give the routine a name (up to 200 characters).',
				name: String(form.get('name') ?? '')
			});
		}
		if (figureIds.length === 0) {
			return fail(400, { message: 'Pick at least one figure.', name });
		}
		const made = createRoutineFromFigures(getDb(), dance, { name, notes: null }, figureIds);
		// Every id from the page is a live version of this dance; anything else
		// is a tampered body or a stale page, answered like every other
		// cross-dance id.
		if (!made) throw error(404, 'Figure not found');
		throw redirect(303, `/${dance}/routines/${made.routine.id}`);
	}
};
