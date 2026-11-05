import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { CLOSED_MESSAGE, commentState, restoreComment } from '$lib/server/comments';
import type { RequestHandler } from './$types';

/** Undo of a delete, by whoever may delete the comment. */
export const POST: RequestHandler = ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Sign in');
	const db = getDb();
	const id = Number(params.id);
	const state = Number.isInteger(id) ? commentState(db, locals.user.id, id) : 'missing';
	if (state === 'missing') throw error(404, 'No such comment');
	if (state === 'closed') return json({ message: CLOSED_MESSAGE }, { status: 403 });
	if (!restoreComment(db, locals.user.id, id)) throw error(404, 'No such comment');
	return json({ ok: true });
};
