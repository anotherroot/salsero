import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { songAccess } from '$lib/server/access';
import { AUDIO_FILE_RE, audioDir, serveFile } from '$lib/server/files';
import { getSongByAudioFile } from '$lib/server/songs';
import type { RequestHandler } from './$types';

/**
 * Song audio for the browser, with Range. Session-guarded like every
 * non-public path, then `access.ts`: the person's own song, a group's song
 * they edit, or a shared one of a group they are in. Anything else is the
 * missing file's 404.
 */
export const GET: RequestHandler = ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Sign in');
	if (!AUDIO_FILE_RE.test(params.file)) throw error(404, 'Not found');
	const db = getDb();
	const song = getSongByAudioFile(db, params.file);
	if (!song?.mime || songAccess(db, locals.user.id, song) === null) {
		throw error(404, 'Not found');
	}
	return serveFile(join(audioDir(), params.file), song.mime, request);
};
