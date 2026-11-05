import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { addTemplates, createPosition } from '$lib/server/positions';
import { optionalText } from '$lib/server/form';
import { groupModeOf, spaceOf } from '$lib/server/group-mode';
import { wallOf } from '$lib/server/scope';
import { mapData } from '$lib/server/positions-map';
import { DANCES } from '$lib/dances/dances';
import { parseHold } from '$lib/positions/hold';
import { templateTypes } from '$lib/positions/templates';
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
		const styleTag = String(form.get('styleTag') ?? '');
		const typed = {
			action: 'create' as const,
			name: String(form.get('name') ?? ''),
			notes: String(form.get('notes') ?? ''),
			styleTag
		};
		const notes = optionalText(form, 'notes');
		if (notes === undefined) {
			return fail(400, {
				...typed,
				field: 'notes' as const,
				message: 'Notes are up to 2000 characters.'
			});
		}
		if (typed.name.trim().length > 200) {
			return fail(400, {
				...typed,
				field: 'name' as const,
				message: 'A name is up to 200 characters.'
			});
		}
		const made = createPosition(
			db,
			space,
			{
				name: typed.name,
				styleTag: DANCES[space.dance].styles.includes(styleTag) ? styleTag : null,
				hold: parseHold(form),
				notes,
				pictureSpotId: null
			},
			Date.now()
		);
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
			return fail(400, { action: 'templates' as const, message: 'Pick a type with templates.' });
		}
		if (names.length === 0) {
			return fail(400, { action: 'templates' as const, message: 'Tick at least one position.' });
		}
		const made = addTemplates(db, space, space.dance, type, names, Date.now());
		return { action: 'templates' as const, added: made.length };
	}
};
