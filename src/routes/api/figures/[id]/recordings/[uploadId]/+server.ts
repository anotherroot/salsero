import { randomUUID } from 'node:crypto';
import { rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { getDb } from '$lib/server/db';
import { t } from '$lib/i18n/catalog';
import {
	extensionFor,
	failJson as fail,
	recordingsDir,
	safeDecodeHeader,
	UPLOAD_ID_RE
} from '$lib/server/files';
import { ownerOfRow } from '$lib/server/storage';
import { allows, figureAccess } from '$lib/server/access';
import { addRecording, getFigure } from '$lib/server/figures';
import { writeGate } from '$lib/server/sync/gate';
import { finish, finishedRow, receiveChunk } from '$lib/server/chunked-upload';
import { flowAfter } from '$lib/server/clones/flow-hook';
import type { RequestHandler } from './$types';

/**
 * One chunk of a new recording (offline phase 4c: recordings upload in chunks,
 * like lesson videos, up to 1 GiB). The single POST beside it stays for older
 * Android apps. Needs edit on the figure; a group's figure fills the group's room.
 */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const figureId = Number(params.id);
	if (!Number.isInteger(figureId) || !UPLOAD_ID_RE.test(params.uploadId) || !locals.user)
		return fail(404, t().refusals.figureNotFound);
	const db = getDb();
	const name = `fig-${figureId}-${params.uploadId}`;
	const finished = await finishedRow(name);
	if (finished && (finished as { figureId?: unknown }).figureId === figureId)
		return Response.json(finished, { status: 201 });
	if (finished) return fail(404, t().refusals.chunk.badUploadId);

	const found = getFigure(db, figureId, locals.user.id);
	if (
		!found ||
		found.figure.archivedAt !== null ||
		!allows(figureAccess(db, locals.user.id, found.figure), 'edit')
	)
		return fail(404, t().refusals.figureNotFound);

	const got = await receiveChunk(db, request, ownerOfRow(found.figure), name);
	if (got instanceof Response) return got;
	const mime = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	const file = `${randomUUID()}.${extensionFor(mime, safeDecodeHeader(request.headers.get('x-filename')))}`;
	const note = safeDecodeHeader(request.headers.get('x-note')).trim().slice(0, 2000) || null;
	const target = join(recordingsDir(), file);
	await rename(got.partial, target);
	let row;
	try {
		row = await writeGate.shared(async () =>
			addRecording(
				db,
				{ figureId, file, mime, kind: 'video', sizeBytes: got.size, note },
				locals.user?.id
			)
		);
	} catch {
		await unlink(target).catch(() => {});
		return fail(500, t().lesson.upload.notSaved);
	}
	await writeGate.shared(() => flowAfter(locals.user?.id, 'figure', figureId));
	return finish(name, row);
};
