import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { parseAnalysis } from '$lib/server/analysis';
import { getSong, storeAnalysis } from '$lib/server/songs';
import type { RequestHandler } from './$types';

/** The worker token is checked in hooks.server.ts for all of /api/worker/. */
export const POST: RequestHandler = async ({ params, request }) => {
	const s = getSong(getDb(), Number(params.id));
	if (!s) throw error(404, 'No such song');
	const parsed = parseAnalysis(await request.json().catch(() => null));
	if (typeof parsed === 'string') return json({ message: parsed }, { status: 400 });
	storeAnalysis(getDb(), s.id, parsed);
	return new Response(null, { status: 204 });
};
