import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { claimLoop, queueLoops, removeLoopFiles } from '$lib/server/loops/store';
import { serverNow } from '$lib/server/server-clock';
import type { RequestHandler } from './$types';

/**
 * The next section to cut a loop of, or 204. Queues what has no loop first
 * (`queueLoops`), so a new link or an edited span waits at most one worker
 * tick. The worker token is checked in hooks.server.ts for all of /api/worker/.
 */
export const POST: RequestHandler = async () => {
	const db = getDb();
	const now = serverNow();
	await removeLoopFiles(queueLoops(db, now).stale);
	const job = claimLoop(db, now);
	return job
		? json({ id: job.id, start_ms: job.startMs, end_ms: job.endMs })
		: new Response(null, { status: 204 });
};
