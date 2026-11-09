import { error, redirect } from '@sveltejs/kit';
import { t } from '$lib/i18n/catalog';
import { getDb } from '$lib/server/db';
import { wallOf } from '$lib/server/scope';
import { groupChoices } from '$lib/server/group-mode';
import { returnPath } from '$lib/teams/mode';
import { withView } from '$lib/teams/group-view';
import type { Actions, PageServerLoad } from './$types';

/** Not a page: only the switch below. A visit lands on Moves. */
export const load: PageServerLoad = ({ params }) => {
	throw redirect(303, `/${params.dance}/figures`);
};

/**
 * The Work in switch, kept for pages opened before the group view: it lands on
 * the same address in the chosen group's view (`?in=`), or without it for
 * 'mine'. It writes no cookie: the view lives in the address now.
 */
export const actions: Actions = {
	default: async ({ params, locals, request }) => {
		const wall = wallOf(params, locals);
		const form = await request.formData();
		const team = String(form.get('team') ?? '');
		const to = form.get('to');
		const back = returnPath(typeof to === 'string' ? to : null, wall.dance);
		if (team === 'mine') throw redirect(303, withView(back, null));
		const id = Number(team);
		const ok =
			/^[1-9][0-9]*$/.test(team) &&
			groupChoices(getDb(), wall.userId, wall.dance).some((c) => c.teamId === id);
		if (!ok) throw error(404, t().groups.page.noGroup);
		throw redirect(303, withView(back, id));
	}
};
