import { getDb } from '$lib/server/db';
import { failTimeline } from '$lib/server/ai-timelines/store';
import { serverNow } from '$lib/server/server-clock';
import { idOf } from '../../gone';
import type { RequestHandler } from './$types';

/** The worker could not prepare it. A gone or finished timeline is ignored. */
export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => ({}))) as { error?: unknown; permanent?: unknown };
	failTimeline(
		getDb(),
		idOf(params.id),
		String(body.error ?? 'Unknown worker error'),
		body.permanent === true,
		serverNow()
	);
	return new Response(null, { status: 204 });
};
