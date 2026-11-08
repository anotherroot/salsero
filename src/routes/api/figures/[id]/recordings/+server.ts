import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { freeDisk, ownerOfRow, roomForOwner } from '$lib/server/storage';
import { allows, figureAccess } from '$lib/server/access';
import { addRecording, getFigure } from '$lib/server/figures';
import {
	MAX_RECORDING_BYTES,
	MAX_RECORDING_LABEL,
	TooLargeError,
	extensionFor,
	recordingsDir,
	safeDecodeHeader,
	saveStream
} from '$lib/server/files';
import { flowAfter } from '$lib/server/clones/flow-hook';
import { t } from '$lib/i18n/catalog';
import type { RequestHandler } from './$types';

/**
 * Upload one recording for a figure.
 *
 * The body is the RAW file, not multipart: `request.formData()` would buffer
 * a large phone video in memory before a single byte reached disk. Streamed,
 * memory stays flat whatever the size. Metadata rides in headers.
 *
 * Size is enforced twice: against `content-length` up front, so an honest
 * client is refused before uploading anything, and by counting bytes while
 * streaming, because the header can be absent or wrong.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const figureId = Number(params.id);
	const db = getDb();
	const found = Number.isInteger(figureId) ? getFigure(db, figureId, locals.user?.id ?? '') : null;
	// Uploading needs edit: a group's figure for its editors, a person's for them.
	if (
		!found ||
		found.figure.archivedAt !== null ||
		!locals.user ||
		!allows(figureAccess(db, locals.user.id, found.figure), 'edit')
	)
		throw error(404, t().refusals.figureNotFound);
	// The figure's owner pays: a group's figure fills the group's room, not the uploader's.
	const owner = ownerOfRow(found.figure);

	const mime = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	const kind = mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : null;
	if (!kind) throw error(415, t().figure.refused.onlyMedia);

	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > MAX_RECORDING_BYTES)
		throw error(413, t().shell.upload.larger(MAX_RECORDING_LABEL));
	const room = roomForOwner(db, owner, declared, await freeDisk());
	if (!room.ok) throw error(413, room.message);
	if (!request.body) throw error(400, t().shell.upload.empty);

	const originalName = safeDecodeHeader(request.headers.get('x-filename'));
	const note = safeDecodeHeader(request.headers.get('x-note')).trim().slice(0, 2000) || null;
	const file = `${randomUUID()}.${extensionFor(mime, originalName)}`;
	const path = join(recordingsDir(), file);

	let bytes: number;
	try {
		bytes = await saveStream(request.body, path, MAX_RECORDING_BYTES);
	} catch (err) {
		if (err instanceof TooLargeError) {
			throw error(413, t().shell.upload.larger(MAX_RECORDING_LABEL));
		}
		console.error('recording upload failed', err);
		throw error(400, t().shell.upload.interrupted);
	}

	if (bytes === 0) {
		await unlink(path).catch(() => {});
		throw error(400, t().shell.upload.empty);
	}

	// The header can be absent or wrong: check the bytes that really arrived.
	// The file is already on the disk: the floor is what is free without it.
	const after = roomForOwner(db, owner, bytes, (await freeDisk()) + bytes);
	if (!after.ok) {
		await unlink(path).catch(() => {});
		throw error(413, after.message);
	}
	const recording = addRecording(
		db,
		{ figureId, file, mime, kind, sizeBytes: bytes, note },
		locals.user?.id
	);
	// Keep in step: the variation gained a recording; the flow runs from it.
	await flowAfter(locals.user?.id, 'figure', figureId);
	return json(recording, { status: 201 });
};
