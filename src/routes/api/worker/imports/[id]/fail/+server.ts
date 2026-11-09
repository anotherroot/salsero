import { getDb } from '$lib/server/db';
import { failImportJob } from '$lib/server/song-imports';
import type { RequestHandler } from './$types';

/** The worker token is checked in hooks.server.ts for all of /api/worker/. A gone import is ignored. */
export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => ({}))) as { error?: unknown; permanent?: unknown };
	failImportJob(
		getDb(),
		Number(params.id),
		String(body.error ?? 'Unknown worker error'),
		body.permanent === true
	);
	return new Response(null, { status: 204 });
};
