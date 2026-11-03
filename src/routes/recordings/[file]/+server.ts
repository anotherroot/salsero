import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { fileAccess } from '$lib/server/access';
import { RECORDING_FILE_RE, recordingsDir, serveFile } from '$lib/server/files';
import type { RequestHandler } from './$types';

/** Serve a recording with HTTP Range. Behind the session guard in hooks.server.ts. */
export const GET: RequestHandler = async ({ params, request, locals }) => {
	if (!RECORDING_FILE_RE.test(params.file) || !locals.user) throw error(404, 'Not found');
	// The person's own, or a group's they may read: anything else is a missing file's 404.
	const rec = fileAccess(getDb(), locals.user.id, 'recording', params.file);
	return serveFile(join(recordingsDir(), rec.file), rec.mime, request);
};
