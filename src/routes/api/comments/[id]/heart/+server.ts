import { error, json } from '@sveltejs/kit';
import { t } from '$lib/i18n/catalog';
import { getDb } from '$lib/server/db';
import { closedMessage, commentState, toggleHeart } from '$lib/server/comments';
import type { RequestHandler } from './$types';

import { serverNow } from '$lib/server/server-clock';
/** Toggles the person's heart; answers the count and whether it is now hearted. */
export const POST: RequestHandler = ({ params, locals }) => {
	if (!locals.user) throw error(401, t().comments.refused.signIn);
	const db = getDb();
	const id = Number(params.id);
	const state = Number.isInteger(id) ? commentState(db, locals.user.id, id) : 'missing';
	if (state === 'missing') throw error(404, t().comments.refused.noComment);
	if (state === 'closed') return json({ message: closedMessage() }, { status: 403 });
	const result = toggleHeart(db, locals.user.id, id, serverNow());
	if (!result) throw error(404, t().comments.refused.noComment);
	return json(result);
};
