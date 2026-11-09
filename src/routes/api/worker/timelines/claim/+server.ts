import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { claimTimeline } from '$lib/server/ai-timelines/store';
import { serverNow } from '$lib/server/server-clock';
import type { RequestHandler } from './$types';

/**
 * The next video to prepare for the AI, or 204. The worker token is checked
 * in hooks.server.ts for all of /api/worker/.
 */
export const POST: RequestHandler = async () => {
	const job = claimTimeline(getDb(), serverNow());
	return job ? json(job) : new Response(null, { status: 204 });
};
