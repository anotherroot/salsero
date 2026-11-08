import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { restoreTrash, trashSpace } from '$lib/server/trash';
import { trashRefusalLine } from '$lib/teams/deleted';
import type { RequestHandler } from './$types';
import { serverNow } from '$lib/server/server-clock';

/**
 * Restore one trash entry: the player's Undo for a group's section, so the
 * same section comes back rather than a twin (risk 18). Only a group's
 * editors; anyone else, and a missing id, get the same 404. A refusal is a
 * 409 with its words ("Restore the video first").
 */
export const POST: RequestHandler = ({ params, locals }) => {
	const id = /^\d+$/.test(params.id) ? Number(params.id) : 0;
	const db = getDb();
	const found = locals.user && id > 0 ? trashSpace(db, locals.user.id, id) : null;
	if (!found) throw error(404, 'No such thing to restore');
	const done = restoreTrash(db, found.space, id, serverNow());
	if (done.ok) return json({ ok: true });
	if (done.reason === 'not-found') throw error(404, 'No such thing to restore');
	return json({ message: trashRefusalLine(found.kind, done.reason) }, { status: 409 });
};
