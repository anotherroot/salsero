import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getDance } from '$lib/dances/dances';
import { peopleOf, roleOf, teamByCode } from '$lib/server/teams';
import { joinClass } from '$lib/server/auto-add';
import type { Actions, PageServerLoad } from './$types';

const STALE = 'This code no longer works';

export const load: PageServerLoad = ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Sign in');
	const db = getDb();
	const team = teamByCode(db, params.code);
	if (!team) throw error(404, STALE);
	if (roleOf(db, locals.user.id, team.id) !== null) {
		throw redirect(303, `/${team.dance}/groups/${team.id}`);
	}
	return {
		code: params.code,
		name: team.name,
		dance: team.dance,
		danceLabel: getDance(team.dance).label,
		people: peopleOf(db, team.id).length
	};
};

export const actions: Actions = {
	join: ({ params, locals }) => {
		if (!locals.user) throw error(401, 'Sign in');
		const db = getDb();
		const team = teamByCode(db, params.code);
		if (!team) throw error(404, STALE);
		// A first join brings the class's newest lesson to Today when auto-add is on.
		if (joinClass(db, locals.user.id, team.id, Date.now()) === 'refused') {
			return fail(404, { message: STALE });
		}
		throw redirect(303, `/${team.dance}/groups/${team.id}`);
	}
};
