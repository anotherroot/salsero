import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fail } from '@sveltejs/kit';
import { deleteCountTake, listCountTakes, restoreCountTake } from '$lib/server/countTakes';
import type { CountTake } from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';
import { countDir } from '$lib/server/files';
import { int } from '$lib/server/form';
import { Hold, UNDO_MS } from '$lib/server/undo-hold';
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
const holdKey = (id: number) => `take:${id}`;

export const load: PageServerLoad = () => ({ takes: listCountTakes(getDb()) });

export const actions: Actions = {
	/** Hard delete, like a recording: the row now, the file when Undo runs out. */
	delete: async ({ request }) => {
		const id = int(await request.formData(), 'id');
		if (id === undefined) return fail(400, { message: 'Unknown take.' });
		const row = deleteCountTake(getDb(), id);
		if (!row) return fail(404, { message: 'That take is already gone.' });
		held.put(holdKey(id), row);
		return { deleted: id };
	},

	restore: async ({ request }) => {
		const id = int(await request.formData(), 'id');
		const row = id === undefined ? null : held.take(holdKey(id));
		if (!row) return fail(410, { message: 'Too late to undo.' });
		if (restoreCountTake(getDb(), row) === 'taken') {
			// Recorded again meanwhile: the newer take stays and this one's file
			// is of no use to anyone.
			await unlink(join(countDir(), row.file)).catch(() => {});
			return fail(409, { message: 'A newer take holds that slot now.' });
		}
		return { ok: true };
	}
};
