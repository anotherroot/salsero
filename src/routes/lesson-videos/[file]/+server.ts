import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getLessonVideoByFile } from '$lib/server/lessons';
import { LESSON_VIDEO_FILE_RE, lessonVideosDir, serveFile } from '$lib/server/files';
import type { RequestHandler } from './$types';

/**
 * Serve a lesson video with HTTP Range. Behind the session guard in
 * hooks.server.ts. Range matters twice over here: iOS refuses to play media
 * without it, and these files run to a gigabyte.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!LESSON_VIDEO_FILE_RE.test(params.file)) throw error(404, 'Not found');
	const video = getLessonVideoByFile(getDb(), params.file);
	if (!video) throw error(404, 'Not found');
	return serveFile(join(lessonVideosDir(), video.file), video.mime, request);
};
