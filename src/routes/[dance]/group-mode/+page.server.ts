import { error, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { wallOf } from '$lib/server/scope';
import { groupChoices } from '$lib/server/group-mode';
import { groupCookie, returnPath } from '$lib/teams/mode';
import type { Actions, PageServerLoad } from './$types';

/** Not a page: only the switch below. A visit lands on Moves. */
export const load: PageServerLoad = ({ params }) => {
	throw redirect(303, `/${params.dance}/figures`);
};

/**
 * Switch group mode on (a group the person owns or edits) or off ('mine').
 * A page action, not an endpoint, so `use:enhance` gets a redirect result it
 * can read (an endpoint's 303 would be followed to HTML and fail to parse).
 */
export const actions: Actions = {
	default: async ({ params, locals, request, cookies, url }) => {
		const wall = wallOf(params, locals);
		const form = await request.formData();
		const team = String(form.get('team') ?? '');
		const to = form.get('to');
		const name = groupCookie(wall.dance);
		if (team === 'mine') {
			cookies.delete(name, { path: '/' });
		} else {
			const id = Number(team);
			const ok =
				/^[1-9][0-9]*$/.test(team) &&
				groupChoices(getDb(), wall.userId, wall.dance).some((c) => c.teamId === id);
			if (!ok) throw error(404, 'No such group');
			cookies.set(name, String(id), {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: url.protocol === 'https:',
				maxAge: 60 * 60 * 24 * 365
			});
		}
		throw redirect(303, returnPath(typeof to === 'string' ? to : null, wall.dance));
	}
};
