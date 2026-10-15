import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { uploadsDir } from '$lib/server/files';
import { claimVideoJob } from '$lib/server/video-downloads';
import type { RequestHandler } from './$types';

/**
 * The next YouTube link to save, or 204. A queue of its own rather than a kind
 * of song job — see `src/lib/server/video-downloads.ts`. The worker token is
 * checked in hooks.server.ts for all of /api/worker/.
 *
 * A claim is a fresh attempt: the worker downloads and encodes again, and a
 * new encode need not be byte-identical to the last one (a yt-dlp or ffmpeg
 * update, a different format from YouTube). So an earlier attempt's partial is
 * dropped here; resuming is only for chunks within one attempt.
 */
export const POST: RequestHandler = async () => {
	const job = claimVideoJob(getDb(), Date.now());
	if (!job) return new Response(null, { status: 204 });
	await unlink(join(uploadsDir(), `video-${job.id}.part`)).catch(() => {});
	return json(job);
};
