import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { wallOf } from '$lib/server/scope';
import { createTeam, listMyTeams, teamLimit } from '$lib/server/teams';
import { limitLine, NAME_REFUSAL } from '$lib/teams/view';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => {
	const wall = wallOf(params, locals);
	return { teams: listMyTeams(getDb(), wall.userId, wall.dance) };
};

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
	}
};
