import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { wallOf } from '$lib/server/scope';
import { CODE_REFUSALS } from '$lib/levels/first-run';
import { joinWithCode } from '$lib/server/join-code';
import { createTeam, teamLimit } from '$lib/server/teams';
import { limitLine, NAME_REFUSAL } from '$lib/teams/view';
import type { Actions } from './$types';

// The list is the layout's load (`+layout.server.ts`); New group posts here by name from any Groups page.
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
	// other dance is joined too, and opened in its own dance.
	joinCode: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const code = String((await request.formData()).get('code') ?? '').trim();
		if (!code) return fail(400, { action: 'joinCode', message: CODE_REFUSALS.empty });
		const joined = joinWithCode(getDb(), wall.userId, code, Date.now());
		if (!joined.ok) {
			return fail(400, { action: 'joinCode', message: CODE_REFUSALS[joined.reason] });
		}
		throw redirect(303, `/${joined.dance}/groups/${joined.teamId}`);
	}
};
