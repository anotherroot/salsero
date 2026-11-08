import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { addTemplates, createPosition } from '$lib/server/positions';
import { readNewPosition } from '$lib/server/position-form';
import { groupModeOf, spaceOf } from '$lib/server/group-mode';
import { wallOf } from '$lib/server/scope';
import { mapData } from '$lib/server/positions-map';
import { templateTypes } from '$lib/positions/templates';
import { t } from '$lib/i18n/catalog';
import type { Actions, PageServerLoad } from './$types';

/**
 * The map: on the desktop the pane beside the list with nothing open (the
 * phone's list page does not draw it). Its own key, as on the map route.
 */
export const load: PageServerLoad = ({ params, locals, cookies }) => {
	if (!locals.user) throw error(401);
	const wall = wallOf(params, locals);
	const db = getDb();
	return { map: mapData(db, wall, groupModeOf(db, wall.userId, wall.dance, cookies)) };
};

export const actions: Actions = {
	create: async ({ params, request, locals, cookies }) => {
		const db = getDb();
		// The cookie is the client's: `spaceOf` re-checks it, so a member who
		// is not an editor creates in their own space, never in the group.
		const space = spaceOf(db, params, locals, cookies);
		const form = await request.formData();
		const read = readNewPosition(form, space.dance);
		const typed = { action: 'create' as const, ...read.typed };
		if (!('input' in read)) {
			return fail(400, { ...typed, field: read.field, message: read.message });
		}
		const made = createPosition(db, space, read.input, Date.now());
		if ('field' in made) return fail(400, { ...typed, field: made.field, message: made.message });
		throw redirect(303, `/${space.dance}/positions/${made.id}`);
	},

	templates: async ({ params, request, locals, cookies }) => {
		const db = getDb();
		const space = spaceOf(db, params, locals, cookies);
		const form = await request.formData();
		const type = String(form.get('type') ?? '');
		const names = form.getAll('names').map(String);
		if (!templateTypes(space.dance).includes(type)) {
			return fail(400, {
				action: 'templates' as const,
				message: t().positions.templates.refused.type
			});
		}
		if (names.length === 0) {
			return fail(400, {
				action: 'templates' as const,
				message: t().positions.templates.refused.none
			});
		}
		const made = addTemplates(db, space, space.dance, type, names, Date.now());
		return { action: 'templates' as const, added: made.length };
	}
};
