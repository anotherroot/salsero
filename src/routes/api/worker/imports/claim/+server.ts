import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { claimImportJob } from '$lib/server/song-imports';
import { serverNow } from '$lib/server/server-clock';
import type { RequestHandler } from './$types';

/** A pasted playlist to read. The worker token is checked in hooks.server.ts for all of /api/worker/. */
export const POST: RequestHandler = () => {
	const job = claimImportJob(getDb(), serverNow());
	return job ? json(job) : new Response(null, { status: 204 });
};
