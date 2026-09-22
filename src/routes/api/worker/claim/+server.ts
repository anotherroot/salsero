import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { claimJob } from '$lib/server/songs';
import type { RequestHandler } from './$types';

/** The worker token is checked in hooks.server.ts for all of /api/worker/. */
export const POST: RequestHandler = () => {
	const job = claimJob(getDb(), Date.now());
	return job ? json(job) : new Response(null, { status: 204 });
};
