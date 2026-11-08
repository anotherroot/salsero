import { randomUUID } from 'node:crypto';
import { rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	failJson,
	lessonVideosDir,
	recordingsDir,
	uploadsDir,
	writeChunk
} from '$lib/server/files';
import { completeVideoJob, videoJobRequester, videoJobTarget } from '$lib/server/video-downloads';
import { flowAfter, rootOfRecording, rootOfVideo } from '$lib/server/clones/flow-hook';
import { freeDisk } from '$lib/server/storage';
import { MAX_LESSON_VIDEO_BYTES, MAX_LESSON_VIDEO_LABEL } from '$lib/limits';
import type { RequestHandler } from './$types';

/**
 * One chunk of a saved YouTube video, from the home worker. The lesson-video
 * protocol (`writeChunk`): the partial's size is the resume offset. The last
 * chunk turns the job into a recording or a lesson video.
 *
 * A job that no longer exists — its link was removed, or this is the last
 * chunk again after a lost 201 — is 410, and any partial goes with it.
 * The worker token is checked in hooks.server.ts for all of /api/worker/.
 */
const GONE = 'This video is no longer wanted.';

export const PUT: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	const db = getDb();
	const target = Number.isSafeInteger(id) && id > 0 ? videoJobTarget(db, id) : null;
	const partial = join(uploadsDir(), `video-${Number.isSafeInteger(id) ? id : 0}.part`);
	if (!target) {
		await unlink(partial).catch(() => {});
		return failJson(410, GONE);
	}

	const chunk = await writeChunk(request, partial, MAX_LESSON_VIDEO_BYTES, {
		notVideo: 'Only a video can be saved.',
		tooLarge: `That video is bigger than the ${MAX_LESSON_VIDEO_LABEL} limit.`
	});
	if (chunk instanceof Response) return chunk;
	if (!chunk.done) {
		return new Response(null, {
			status: 204,
			headers: { 'x-received-bytes': String(chunk.received) }
		});
	}

	// Whose save it was, read before the job goes: Keep in step's flow runs as them.
	const by = videoJobRequester(db, id);
	// File first, then the row: a crash between the two leaves an orphan file,
	// which is harmless, rather than a row pointing at nothing.
	const file = `${randomUUID()}.mp4`;
	const dest = join(target === 'recording' ? recordingsDir() : lessonVideosDir(), file);
	await rename(partial, dest);
	// The file is already on the disk: the floor is what is free without it.
	const done = completeVideoJob(
		db,
		id,
		{ file, mime: 'video/mp4', sizeBytes: chunk.total },
		(await freeDisk()) + chunk.total
	);
	if (!done) {
		// The link was removed while the last chunk streamed in.
		await unlink(dest).catch(() => {});
		return failJson(410, GONE);
	}
	if ('refused' in done) {
		// The owner's room is gone: the job has failed with the reason, which the
		// worker's report of this 413 cannot overwrite (a failed job ignores it).
		await unlink(dest).catch(() => {});
		return failJson(413, done.refused);
	}
	// The link became a recording or a lesson video: the flow runs from its root.
	const root =
		'recordingId' in done
			? rootOfRecording(db, done.recordingId)
			: rootOfVideo(db, done.lessonVideoId);
	if (root) await flowAfter(by, root.kind, root.id);
	return json(done, { status: 201 });
};
