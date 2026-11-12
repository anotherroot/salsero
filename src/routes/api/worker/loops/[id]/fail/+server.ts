import { getDb } from '$lib/server/db';
import { failLoop } from '$lib/server/loops/store';
import { serverNow } from '$lib/server/server-clock';
import { idOf } from '../../gone';
import type { RequestHandler } from './$types';

/** The worker could not cut it. A gone or finished loop is ignored. */
export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => ({}))) as { error?: unknown; permanent?: unknown };
	failLoop(
		getDb(),
		idOf(params.id),
		String(body.error ?? 'Unknown worker error'),
		body.permanent === true,
		serverNow()
	);
	return new Response(null, { status: 204 });
};
