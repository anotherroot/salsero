import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { wallOf } from '$lib/server/scope';
import { codeRefusal } from '$lib/levels/first-run';
import { joinWithCode } from '$lib/server/join-code';
import { createTeam, teamLimit } from '$lib/server/teams';
import { limitLine, NAME_REFUSAL } from '$lib/teams/view';
import { levelShown } from '$lib/levels/levels';
import type { Actions, PageServerLoad } from './$types';

/**
 * The list is the layout's load (`+layout.server.ts`). At Follow my class the
 * tab is My class, and in one class it opens that class's page (levels spec,
 * "My class"): the tab's landing, not a wall, so every group page still opens
 * by its URL at every level.
 */
export const load: PageServerLoad = async ({ parent, params, locals }) => {
	if (levelShown(locals.user!.level) !== 'follow') return {};
	const live = (await parent()).teams.filter((t) => t.deletedAt === null);
	if (live.length === 1) throw redirect(303, `/${params.dance}/groups/${live[0].id}`);
	return {};
};

// New group posts here by name from any Groups page.
export const actions: Actions = {
	create: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const db = getDb();
		const name = String((await request.formData()).get('name') ?? '');
		const made = createTeam(db, wall.userId, wall.dance, name, Date.now());
		if (!made.ok) {
			const message =
				made.reason === 'limit' ? limitLine(teamLimit(db, wall.userId)) : NAME_REFUSAL;
			return fail(400, { action: 'create', message, name });
		}
		throw redirect(303, `/${wall.dance}/groups/${made.teamId}`);
	},

	// Join with a code: the Groups tab's field and the sheet. A class of the
	// other dance is an unknown code (the dance split).
	joinCode: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const code = String((await request.formData()).get('code') ?? '').trim();
		if (!code) return fail(400, { action: 'joinCode', message: codeRefusal('empty') });
		const joined = joinWithCode(getDb(), wall.userId, code, Date.now());
		if (!joined.ok) {
			return fail(400, { action: 'joinCode', message: codeRefusal(joined.reason) });
		}
		throw redirect(303, `/${joined.dance}/groups/${joined.teamId}`);
	}
};
