import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { failJob, getSong } from '$lib/server/songs';
import type { RequestHandler } from './$types';

/** The worker token is checked in hooks.server.ts for all of /api/worker/. */
export const POST: RequestHandler = async ({ params, request }) => {
	const s = getSong(getDb(), Number(params.id));
	if (!s) throw error(404, 'No such song');
	const body = (await request.json().catch(() => ({}))) as { error?: unknown; permanent?: unknown };
	failJob(getDb(), s.id, String(body.error ?? 'Unknown worker error'), body.permanent === true);
	return new Response(null, { status: 204 });
};
