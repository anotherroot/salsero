import { error, fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { requireTeam } from '$lib/server/scope';
import { listTrash, restoreDeleted } from '$lib/server/trash';
import { int } from '$lib/server/form';
import { KIND_NAME } from '$lib/teams/deleted';
import type { DeletedKind } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';
import { serverNow } from '$lib/server/server-clock';

const KINDS = Object.keys(KIND_NAME) as DeletedKind[];

/**
 * The group, for its editors and owner only: a member gets the stranger's
 * 404, as History does. A group being deleted shows nothing but its own
 * Restore, on the group page.
 */
function teamOf(params: { dance: string; id: string }, locals: App.Locals) {
	const db = getDb();
	const found = requireTeam(db, locals, params, 'editor');
	if (found.team.deletedAt !== null) throw error(404, 'No such group');
	return { db, ...found };
}

export const load: PageServerLoad = ({ params, locals }) => {
	const { db, team } = teamOf(params, locals);
	return {
		team: { id: team.id, name: team.name },
		items: listTrash(db, team.id, locals.user!.timezone),
		now: serverNow()
	};
};

export const actions: Actions = {
	/**
	 * Restore one row: a trash entry, or an archived lesson, variation,
	 * routine or drill. A refusal ("Restore the video first", "Enchufla is
	 * taken; rename that one first") shows on its row.
	 */
	restore: async ({ params, locals, request }) => {
		const { db, space } = teamOf(params, locals);
		const form = await request.formData();
		const kind = KINDS.find((k) => k === form.get('kind'));
		const id = int(form, 'id');
		const key = `${kind}-${id}`;
		const done =
			kind === undefined || id === undefined
				? null
				: restoreDeleted(db, space, kind, id, serverNow());
		if (!done) return fail(404, { action: 'restore', key, message: 'That is no longer here.' });
		if (!done.ok) return fail(409, { action: 'restore', key, message: done.message });
		return { action: 'restore', ok: true, key };
	}
};
