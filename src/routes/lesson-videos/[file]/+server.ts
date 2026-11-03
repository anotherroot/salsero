import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { fileAccess } from '$lib/server/access';
import { LESSON_VIDEO_FILE_RE, lessonVideosDir, serveFile } from '$lib/server/files';
import type { RequestHandler } from './$types';

/**
 * Serve a lesson video with HTTP Range. Behind the session guard in
 * hooks.server.ts. Range matters twice over here: iOS refuses to play media
 * without it, and these files run to a gigabyte.
 */
export const GET: RequestHandler = async ({ params, request, locals }) => {
	if (!LESSON_VIDEO_FILE_RE.test(params.file) || !locals.user) throw error(404, 'Not found');
	// The person's own, or a group's they may read: anything else is a missing file's 404.
	const video = fileAccess(getDb(), locals.user.id, 'lesson-video', params.file);
	return serveFile(join(lessonVideosDir(), video.file), video.mime, request);
};
