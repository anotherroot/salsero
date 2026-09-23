import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fail } from '@sveltejs/kit';
import { deleteCountTake, listCountTakes } from '$lib/server/countTakes';
import { getDb } from '$lib/server/db';
import { countDir } from '$lib/server/files';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ takes: listCountTakes(getDb()) });

export const actions: Actions = {
	/** Hard delete, like a recording: a bad take is worth nothing kept. */
	delete: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400, { message: 'Unknown take.' });
		const file = deleteCountTake(getDb(), id);
		if (!file) return fail(404, { message: 'That take is already gone.' });
		// The row is what the app reads; a file left behind is wasted disk, not
		// a broken take, so a failed unlink must not fail the request.
		await unlink(join(countDir(), file)).catch(() => {});
		return { ok: true };
	}
};
