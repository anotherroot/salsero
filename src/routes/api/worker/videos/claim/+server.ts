import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { claimVideoJob } from '$lib/server/video-downloads';
import type { RequestHandler } from './$types';

/**
 * The next YouTube link to save, or 204. A queue of its own rather than a kind
 * of song job — see `src/lib/server/video-downloads.ts`. The worker token is
 * checked in hooks.server.ts for all of /api/worker/.
 */
export const POST: RequestHandler = () => {
	const job = claimVideoJob(getDb(), Date.now());
	return job ? json(job) : new Response(null, { status: 204 });
};
