import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { failJson, loopsDir } from '$lib/server/files';
import { finishLoop, loopFiles } from '$lib/server/loops/store';
import { serverNow } from '$lib/server/server-clock';
import { gone, idOf } from '../../gone';
import type { RequestHandler } from './$types';

/** The clip and the still are in: the loop is ready. */
export const POST: RequestHandler = async ({ params }) => {
	const id = idOf(params.id);
	const db = getDb();
	const files = loopFiles(db, id);
	if (!files) return gone();
	if (!existsSync(join(loopsDir(), files.clip)) || !existsSync(join(loopsDir(), files.still)))
		return failJson(409, 'The clip and the still must both be in.');
	if (!finishLoop(db, id, serverNow())) return gone();
	return json({ ok: true }, { status: 201 });
};
