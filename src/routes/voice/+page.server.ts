import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail } from '@sveltejs/kit';
import { deleteCountTake, listCountTakes, restoreCountTake } from '$lib/server/countTakes';
import type { CountTake } from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';
import { countDir } from '$lib/server/files';
import { int } from '$lib/server/form';
import { Hold, UNDO_MS } from '$lib/server/undo-hold';
import { t } from '$lib/i18n/catalog';
import type { Actions, PageServerLoad } from './$types';

/**
 * A deleted take, held for Undo. The row is gone at once; the FILE stays on
 * disk for a minute so Undo has something to point at, and is unlinked when
 * the hold runs out. A restart forgets the hold and leaves the file behind as
 * unreferenced disk (as a failed unlink always could). The row never leaves
 * the server: the page only ever sees the id.
 */
const held = new Hold<CountTake>(UNDO_MS, (row) => {
	// A failed unlink must not fail anything: the row is what the app reads, a
	// file left behind is wasted disk, not a broken take.
	void unlink(join(countDir(), row.file)).catch(() => {});
});
/** Keyed by owner too: only the person who deleted a take can bring it back. */
const holdKey = (userId: string, id: number) => `take:${userId}:${id}`;

function userIdOf(locals: App.Locals): string {
	if (!locals.user) throw error(401, 'Sign in');
	return locals.user.id;
}

export const load: PageServerLoad = ({ locals }) => ({
	takes: listCountTakes(getDb(), userIdOf(locals))
});

export const actions: Actions = {
	/** Hard delete, like a recording: the row now, the file when Undo runs out. */
	delete: async ({ request, locals }) => {
		const id = int(await request.formData(), 'id');
		if (id === undefined) return fail(400, { message: t().settings.voice.unknownTake });
		const row = deleteCountTake(getDb(), userIdOf(locals), id);
		if (!row) return fail(404, { message: t().settings.voice.takeGone });
		held.put(holdKey(row.userId ?? '', id), row);
		return { deleted: id };
	},

	restore: async ({ request, locals }) => {
		const id = int(await request.formData(), 'id');
		const row = id === undefined ? null : held.take(holdKey(userIdOf(locals), id));
		if (!row) return fail(410, { message: t().settings.refusals.tooLate });
		if (restoreCountTake(getDb(), row) === 'taken') {
			// Recorded again meanwhile: the newer take stays and this one's file
			// is of no use to anyone.
			await unlink(join(countDir(), row.file)).catch(() => {});
			return fail(409, { message: t().settings.voice.newerTake });
		}
		return { ok: true };
	}
};
