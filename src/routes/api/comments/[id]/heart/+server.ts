import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { CLOSED_MESSAGE, commentState, toggleHeart } from '$lib/server/comments';
import type { RequestHandler } from './$types';

/** Toggles the person's heart; answers the count and whether it is now hearted. */
export const POST: RequestHandler = ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Sign in');
	const db = getDb();
	const id = Number(params.id);
	const state = Number.isInteger(id) ? commentState(db, locals.user.id, id) : 'missing';
	if (state === 'missing') throw error(404, 'No such comment');
	if (state === 'closed') return json({ message: CLOSED_MESSAGE }, { status: 403 });
	const result = toggleHeart(db, locals.user.id, id, Date.now());
	if (!result) throw error(404, 'No such comment');
	return json(result);
};
