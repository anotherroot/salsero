import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { parseAnalysis } from '$lib/server/analysis';
import { getSong, storeAnalysis } from '$lib/server/songs';
import { workerTokenOk } from '$lib/server/worker-auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	if (!workerTokenOk(request.headers.get('authorization'), env.SALSA_WORKER_TOKEN)) {
		throw error(401, 'Bad worker token');
	}
	const s = getSong(getDb(), Number(params.id));
	if (!s) throw error(404, 'No such song');
	const parsed = parseAnalysis(await request.json().catch(() => null));
	if (typeof parsed === 'string') return json({ message: parsed }, { status: 400 });
	storeAnalysis(getDb(), s.id, parsed);
	return new Response(null, { status: 204 });
};
