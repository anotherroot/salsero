import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSong, storeFoundStart } from '$lib/server/songs';
import type { RequestHandler } from './$types';

/**
 * Where a ready song's music starts, measured by the worker. Worker state:
 * not logged, no `seen`. The worker token is checked in hooks.server.ts for
 * all of /api/worker/.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	const db = getDb();
	const song = getSong(db, Number(params.id));
	if (!song || song.archivedAt !== null) throw error(404, 'No such song');
	const body = (await request.json().catch(() => null)) as { startS?: unknown } | null;
	const startS = body?.startS;
	if (typeof startS !== 'number' || !storeFoundStart(db, song.id, startS))
		return json({ message: 'startS must be a time inside the song' }, { status: 400 });
	return new Response(null, { status: 204 });
};
