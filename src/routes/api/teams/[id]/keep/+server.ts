import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getTeam, roleOf } from '$lib/server/teams';
import { keepBytes, keepPreview } from '$lib/server/clones/keep';
import { readKeepChoice } from '$lib/server/keep-form';
import type { RequestHandler } from './$types';

/**
 * What leaving would keep, for the leave sheet. Without `mode` it is the
 * preview; with one (`mode=chosen&lesson=…`) it is `{ bytes }`, what that choice
 * charges (nested copies counted once, which item bytes cannot add up to).
 * Only a member of a live group asks; anyone else gets the same 404.
 */
export const GET: RequestHandler = ({ params, locals, url }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Sign in');
	const id = Number(params.id);
	const db = getDb();
	const team = Number.isInteger(id) ? getTeam(db, id) : null;
	if (!team || team.deletedAt !== null || roleOf(db, user.id, team.id) === null) {
		throw error(404, 'No such group');
	}
	if (!url.searchParams.has('mode')) return json(keepPreview(db, user.id, team.id));
	const choice = readKeepChoice(url.searchParams);
	if (!choice) throw error(400, 'Bad request');
	return json({ bytes: keepBytes(db, user.id, team.id, choice) });
};
