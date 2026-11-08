import { error, json } from '@sveltejs/kit';
import { t } from '$lib/i18n/catalog';
import { getDb } from '$lib/server/db';
import { closedMessage, commentState, restoreComment } from '$lib/server/comments';
import type { RequestHandler } from './$types';

/** Undo of a delete: the deleter, or a teacher of the lesson's group (an author cannot undo a teacher's delete). */
export const POST: RequestHandler = ({ params, locals }) => {
	if (!locals.user) throw error(401, t().comments.refused.signIn);
	const db = getDb();
	const id = Number(params.id);
	const state = Number.isInteger(id) ? commentState(db, locals.user.id, id) : 'missing';
	if (state === 'missing') throw error(404, t().comments.refused.noComment);
	if (state === 'closed') return json({ message: closedMessage() }, { status: 403 });
	if (!restoreComment(db, locals.user.id, id)) throw error(404, t().comments.refused.noComment);
	return json({ ok: true });
};
