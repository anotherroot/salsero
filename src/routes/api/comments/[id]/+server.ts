import { error, json } from '@sveltejs/kit';
import { t } from '$lib/i18n/catalog';
import { getDb } from '$lib/server/db';
import { closedMessage, commentState, deleteComment } from '$lib/server/comments';
import type { RequestHandler } from './$types';

/** Delete a comment (soft; Undo is `restore`). Not the author, not a teacher: the same 404. */
export const DELETE: RequestHandler = ({ params, locals }) => {
	if (!locals.user) throw error(401, t().comments.refused.signIn);
	const db = getDb();
	const id = Number(params.id);
	const state = Number.isInteger(id) ? commentState(db, locals.user.id, id) : 'missing';
	if (state === 'missing') throw error(404, t().comments.refused.noComment);
	if (state === 'closed') return json({ message: closedMessage() }, { status: 403 });
	if (!deleteComment(db, locals.user.id, id, Date.now()))
		throw error(404, t().comments.refused.noComment);
	return json({ ok: true });
};
