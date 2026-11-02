import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getFigure, getRecordingByFile } from '$lib/server/figures';
import { RECORDING_FILE_RE, recordingsDir, serveFile } from '$lib/server/files';
import type { RequestHandler } from './$types';

/** Serve a recording with HTTP Range. Behind the session guard in hooks.server.ts. */
export const GET: RequestHandler = async ({ params, request, locals }) => {
	if (!RECORDING_FILE_RE.test(params.file)) throw error(404, 'Not found');
	const rec = getRecordingByFile(getDb(), params.file);
	// Another person's recording and a missing one get the same 404.
	const owner = rec ? getFigure(getDb(), rec.figureId)?.figure.userId : null;
	if (!rec || !locals.user || owner !== locals.user.id) throw error(404, 'Not found');
	return serveFile(join(recordingsDir(), rec.file), rec.mime, request);
};
