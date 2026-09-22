import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { failJob, getSong } from '$lib/server/songs';
import { workerTokenOk } from '$lib/server/worker-auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	if (!workerTokenOk(request.headers.get('authorization'), env.SALSA_WORKER_TOKEN)) {
		throw error(401, 'Bad worker token');
	}
	const s = getSong(getDb(), Number(params.id));
	if (!s) throw error(404, 'No such song');
	const body = (await request.json().catch(() => ({}))) as { error?: unknown; permanent?: unknown };
	failJob(getDb(), s.id, String(body.error ?? 'Unknown worker error'), body.permanent === true);
	return new Response(null, { status: 204 });
};
