import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { getCountTakeByFile } from '$lib/server/countTakes';
import { getDb } from '$lib/server/db';
import { RECORDING_FILE_RE, countDir, serveFile } from '$lib/server/files';
import type { RequestHandler } from './$types';

/**
 * One recorded count take, for `decodeAudioData`. Session-guarded like every
 * non-public path. The name is checked against the row rather than trusted, so
 * a crafted path can only ever reach a file we put there.
 */
export const GET: RequestHandler = ({ params, request }) => {
	if (!RECORDING_FILE_RE.test(params.file)) throw error(404, 'Not found');
	if (!getCountTakeByFile(getDb(), params.file)) throw error(404, 'Not found');
	return serveFile(join(countDir(), params.file), 'audio/wav', request);
};
