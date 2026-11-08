import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { wallOf } from '$lib/server/scope';
import { groupModeOf, spaceOf } from '$lib/server/group-mode';
import { mapData } from '$lib/server/positions-map';
import { createRoutineFromFigures } from '$lib/server/routines';
import { orderedInts, text } from '$lib/server/form';
import { t } from '$lib/i18n/catalog';
import type { Actions, PageServerLoad } from './$types';

/** The map (`mapData`), under its own key: the layouts' `groupMode` is another thing. */
export const load: PageServerLoad = ({ params, locals, cookies }) => {
	if (!locals.user) throw error(401);
	const wall = wallOf(params, locals);
	const db = getDb();
	return { map: mapData(db, wall, groupModeOf(db, wall.userId, wall.dance, cookies)) };
};

export const actions: Actions = {
	/**
	 * A walk on the map made into a routine: one slot per walked figure, in the
	 * order walked, the same figure as often as it was walked (`orderedInts`, not
	 * Coverage's `ints`). In group mode it is the group's (`spaceOf`). Forms post
	 * here by the explicit URL: on the desktop the map is the Positions list's pane.
	 */
	routine: async ({ params, request, locals, cookies }) => {
		const db = getDb();
		const space = spaceOf(db, params, locals, cookies);
		const form = await request.formData();
		const name = text(form, 'name');
		const figureIds = orderedInts(form, 'figureIds');
		if (!name) {
			return fail(400, {
				field: 'name',
				message: t().map.walk.nameError,
				name: String(form.get('name') ?? '')
			});
		}
		if (figureIds.length === 0) return fail(400, { message: t().map.walk.noFigures, name });
		const made = createRoutineFromFigures(db, space, { name, notes: null }, figureIds);
		// Every id from the page is a figure the space may use; anything else is a
		// tampered body or a stale page, answered as every other id out of reach.
		if (!made) throw error(404, t().map.walk.notFound);
		throw redirect(303, `/${space.dance}/routines/${made.routine.id}`);
	}
};
