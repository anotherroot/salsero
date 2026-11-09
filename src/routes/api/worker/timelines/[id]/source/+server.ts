import { join } from 'node:path';
import { getDb } from '$lib/server/db';
import { lessonVideosDir, recordingsDir, serveFile } from '$lib/server/files';
import { timelineSource } from '$lib/server/ai-timelines/store';
import { gone, idOf } from '../../gone';
import type { RequestHandler } from './$types';

/** The video a timeline is cut from, with Range. 410 once the video is gone. */
export const GET: RequestHandler = async ({ params, request }) => {
	const id = idOf(params.id);
	const src = id ? timelineSource(getDb(), id) : null;
	if (!src) return gone(id);
	const dir = src.kind === 'lesson-video' ? lessonVideosDir() : recordingsDir();
	return serveFile(join(dir, src.file), 'video/mp4', request);
};
