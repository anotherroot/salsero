import { getDb } from '$lib/server/db';
import { failVideoJob } from '$lib/server/video-downloads';
import type { RequestHandler } from './$types';

/** The worker token is checked in hooks.server.ts for all of /api/worker/. A gone job is ignored. */
export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => ({}))) as { error?: unknown; permanent?: unknown };
	failVideoJob(
		getDb(),
		Number(params.id),
		String(body.error ?? 'Unknown worker error'),
		body.permanent === true
	);
	return new Response(null, { status: 204 });
};
