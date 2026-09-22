import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { AUDIO_FILE_RE, audioDir, serveFile } from '$lib/server/files';
import { getSongByAudioFile } from '$lib/server/songs';
import type { RequestHandler } from './$types';

/** Song audio for the browser, with Range. Session-guarded like every non-public path. */
export const GET: RequestHandler = ({ params, request }) => {
	if (!AUDIO_FILE_RE.test(params.file)) throw error(404, 'Not found');
	const song = getSongByAudioFile(getDb(), params.file);
	if (!song?.mime) throw error(404, 'Not found');
	return serveFile(join(audioDir(), params.file), song.mime, request);
};
