import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { listVersions, withFigureOrigins } from '$lib/server/figures';
import { createRoutineFromFigures, listRoutines, routineShapes } from '$lib/server/routines';
import { ints, text } from '$lib/server/form';
import { coverage, coverageGroups } from '$lib/routines/coverage';
import { wallOf } from '$lib/server/scope';
import { viewOf } from '$lib/server/group-mode';
import { withView } from '$lib/teams/group-view';
import { t } from '$lib/i18n/catalog';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals, route, url }) => {
	const wall = wallOf(params, locals);
	const db = getDb();
	// Coverage is the person's own; in a group's view the group's Figures is the way back.
	const view = viewOf(db, wall, locals.user?.level, { route, params, url });
	if (view) throw redirect(303, withView(`/${wall.dance}/figures`, view.teamId));
	// Derived per request, never stored: a slot edited on a routine page
	// changes these answers with nothing else touched.
	return {
		groups: coverageGroups(
			coverage(
				withFigureOrigins(db, wall.userId, listVersions(db, wall)),
				routineShapes(db, wall),
				listRoutines(db, wall)
			)
		)
	};
};

export const actions: Actions = {
	/** A new routine from the picked versions, in the order they were picked. */
	create: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const dance = wall.dance;
		const form = await request.formData();
		const name = text(form, 'name');
		// `ints` keeps first-seen order and drops duplicates.
		const figureIds = ints(form, 'figureIds');
		if (!name) {
			return fail(400, {
				field: 'name',
				message: t().moves.refused.routineName,
				name: String(form.get('name') ?? '')
			});
		}
		if (figureIds.length === 0) {
			return fail(400, { message: t().moves.refused.pickOne, name });
		}
		const made = createRoutineFromFigures(getDb(), wall, { name, notes: null }, figureIds);
		// Every id from the page is a live version of this dance; anything else
		// is a tampered body or a stale page, answered like every other
		// cross-dance id.
		if (!made) throw error(404, t().refusals.figureNotFound);
		throw redirect(303, `/${dance}/routines/${made.routine.id}`);
	}
};
