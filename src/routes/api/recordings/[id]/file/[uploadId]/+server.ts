import { rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { figures, recordings } from '$lib/server/db/schema';
import { t } from '$lib/i18n/catalog';
import { failJson as fail, recordingsDir, UPLOAD_ID_RE } from '$lib/server/files';
import { writeGate } from '$lib/server/sync/gate';
import { attachServerCopy } from '$lib/server/phone-videos';
import { finish, finishedRow, receiveChunk } from '$lib/server/chunked-upload';
import { flowAfter } from '$lib/server/clones/flow-hook';
import type { RequestHandler } from './$types';

/**
 * Upload later (offline phase 4c): one chunk of a phone-only recording's
 * server copy, written under the row's own file name. The person's own
 * recording only, and only while it has no server copy; anything else is 404.
 */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || !UPLOAD_ID_RE.test(params.uploadId) || !locals.user)
		return fail(404, t().video.refusal.noVideo);
	const db = getDb();
	const name = `rec-${id}-${params.uploadId}`;
	const finished = await finishedRow(name);
	if (finished) return Response.json(finished, { status: 201 });

	const row = db
		.select({ rec: recordings, figure: figures })
		.from(recordings)
		.innerJoin(figures, eq(figures.id, recordings.figureId))
		.where(eq(recordings.id, id))
		.get();
	if (
		!row ||
		row.figure.userId !== locals.user.id ||
		row.figure.teamId !== null ||
		row.rec.serverCopy
	)
		return fail(404, t().video.refusal.noVideo);

	const got = await receiveChunk(db, request, { userId: locals.user.id }, name);
	if (got instanceof Response) return got;
	const target = join(recordingsDir(), row.rec.file);
	await rename(got.partial, target);
	let attached;
	try {
		attached = await writeGate.shared(async () => attachServerCopy(db, 'recordings', id, got.size));
	} catch {
		await unlink(target).catch(() => {});
		return fail(500, t().lesson.upload.notSaved);
	}
	// Keep in step: the recording can travel now.
	await writeGate.shared(() => flowAfter(locals.user?.id, 'figure', row.figure.id));
	return finish(name, attached);
};
