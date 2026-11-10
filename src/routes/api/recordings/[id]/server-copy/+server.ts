import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { t } from '$lib/i18n/catalog';
import { recordingsDir } from '$lib/server/files';
import { removeServerCopyFor } from '$lib/server/phone-videos';
import type { RequestHandler } from './$types';

/**
 * Remove server copy (offline phase 4c): the video is only on the phone again.
 * Body `{ slot }`: the asking device, which must hold the original. Network
 * only: the file is the server's.
 */
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	const id = Number(params.id);
	if (!locals.user || !Number.isInteger(id)) throw error(404, t().video.refusal.noVideo);
	const body: unknown = await request.json().catch(() => null);
	const done = removeServerCopyFor(getDb(), locals.user.id, 'recordings', id, body);
	if (!done.ok) throw error(done.status, done.message);
	await unlink(join(recordingsDir(), done.file)).catch(() => {});
	return json(done.row);
};
