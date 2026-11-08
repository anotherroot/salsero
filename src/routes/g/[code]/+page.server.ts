import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getDance } from '$lib/dances/dances';
import { peopleOf, roleOf, teamByCode } from '$lib/server/teams';
import { joinClass } from '$lib/server/auto-add';
import { t } from '$lib/i18n/catalog';
import type { Actions, PageServerLoad } from './$types';

import { serverNow } from '$lib/server/server-clock';
/** In the request's language: read per request, not at import. */
const stale = () => t().entry.classes.stale;
const signIn = () => t().entry.classes.signIn;

export const load: PageServerLoad = ({ params, locals }) => {
	if (!locals.user) throw error(401, signIn());
	const db = getDb();
	const team = teamByCode(db, params.code);
	// Another dance's group is as stale as no group (the dance split).
	if (!team || team.dance !== locals.user.dance) throw error(404, stale());
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
		if (!locals.user) throw error(401, signIn());
		const db = getDb();
		const team = teamByCode(db, params.code);
		if (!team || team.dance !== locals.user.dance) throw error(404, stale());
		// A first join brings the class's newest lesson to Today when auto-add is on.
		if (joinClass(db, locals.user.id, team.id, serverNow()) === 'refused') {
			return fail(404, { message: stale() });
		}
		throw redirect(303, `/${team.dance}/groups/${team.id}`);
	}
};
