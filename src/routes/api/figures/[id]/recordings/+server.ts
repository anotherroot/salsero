import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { addRecording, getFigure } from '$lib/server/figures';
import {
	MAX_RECORDING_BYTES,
	MAX_RECORDING_LABEL,
	extensionFor,
	recordingsDir
} from '$lib/server/files';
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
export const POST: RequestHandler = async ({ params, request }) => {
	const figureId = Number(params.id);
	const db = getDb();
	const found = Number.isInteger(figureId) ? getFigure(db, figureId) : null;
	if (!found || found.figure.archivedAt !== null) throw error(404, 'Figure not found');

	const mime = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	const kind = mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : null;
	if (!kind) throw error(415, 'Only video and audio files can be uploaded.');

	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > MAX_RECORDING_BYTES)
		throw error(413, `That file is larger than ${MAX_RECORDING_LABEL}.`);
	if (!request.body) throw error(400, 'Empty upload.');

	const originalName = decodeURIComponent(request.headers.get('x-filename') ?? '');
	const note =
		decodeURIComponent(request.headers.get('x-note') ?? '')
			.trim()
			.slice(0, 2000) || null;
	const file = `${randomUUID()}.${extensionFor(mime, originalName)}`;
	const path = join(recordingsDir(), file);

	let bytes = 0;
	const limit = new Transform({
		transform(chunk: Buffer, _enc, done) {
			bytes += chunk.length;
			if (bytes > MAX_RECORDING_BYTES) done(new Error('too large'));
			else done(null, chunk);
		}
	});

	try {
		await pipeline(
			Readable.fromWeb(request.body as unknown as WebReadableStream),
			limit,
			createWriteStream(path, { flags: 'wx' })
		);
	} catch (err) {
		// Never leave a half-written file behind for the backup to copy.
		await unlink(path).catch(() => {});
		if (bytes > MAX_RECORDING_BYTES)
			throw error(413, `That file is larger than ${MAX_RECORDING_LABEL}.`);
		console.error('recording upload failed', err);
		throw error(400, 'The upload was interrupted. Try again.');
	}

	if (bytes === 0) {
		await unlink(path).catch(() => {});
		throw error(400, 'Empty upload.');
	}

	const recording = addRecording(db, { figureId, file, mime, kind, sizeBytes: bytes, note });
	return json(recording, { status: 201 });
};
