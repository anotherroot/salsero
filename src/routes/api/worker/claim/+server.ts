import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { claimJob } from '$lib/server/songs';
import { workerTokenOk } from '$lib/server/worker-auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ request }) => {
	if (!workerTokenOk(request.headers.get('authorization'), env.SALSA_WORKER_TOKEN)) {
		throw error(401, 'Bad worker token');
	}
	const job = claimJob(getDb(), Date.now());
	return job ? json(job) : new Response(null, { status: 204 });
};
