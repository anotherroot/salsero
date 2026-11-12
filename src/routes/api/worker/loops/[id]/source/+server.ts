import { join } from 'node:path';
import { getDb } from '$lib/server/db';
import { lessonVideosDir, recordingsDir, serveFile } from '$lib/server/files';
import { loopSource } from '$lib/server/loops/store';
import { gone, idOf } from '../../gone';
import type { RequestHandler } from './$types';

/** The video a loop is cut from, with Range (ffmpeg seeks it over HTTP). 410 once the section moved or went. */
export const GET: RequestHandler = async ({ params, request }) => {
	const id = idOf(params.id);
	const src = id ? loopSource(getDb(), id) : null;
	if (!src) return gone();
	const dir = src.kind === 'lesson-video' ? lessonVideosDir() : recordingsDir();
	return serveFile(join(dir, src.file), 'video/mp4', request);
};
