import { randomUUID } from 'node:crypto';
import { rename, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { addLessonVideo, getLesson } from '$lib/server/lessons';
import {
	appendStream,
	extensionFor,
	lessonVideosDir,
	OffsetError,
	parseContentRange,
	safeDecodeHeader,
	TooLargeError,
	uploadsDir,
	UPLOAD_ID_RE
} from '$lib/server/files';
import {
	MAX_LESSON_VIDEO_BYTES,
	MAX_LESSON_VIDEO_LABEL,
	MAX_UPLOAD_CHUNK_BYTES
} from '$lib/limits';
import type { RequestHandler } from './$types';

/**
 * One chunk of a lesson video.
 *
 * Deliberately stateless and table-free: the partial file on disk IS the state,
 * and its size IS the resume offset. Every chunk repeats the metadata, so a
 * restart between chunks loses nothing but the bytes not yet written, and the
 * last chunk — the one whose end reaches `total` — finalises the upload.
 *
 * A chunk must start exactly where the file currently ends. Refusing holes is
 * what lets the size stand in for the whole protocol; supporting them would
 * need a manifest, which is the table this avoids.
 */

/** Uploads being written right now. One process, one port: a Set is honest here. */
const writing = new Set<string>();

const fail = (status: number, message: string, headers?: Record<string, string>) =>
	json({ message }, { status, headers });

export const PUT: RequestHandler = async ({ params, request }) => {
	const lessonId = Number(params.id);
	if (!Number.isInteger(lessonId) || lessonId < 1) return fail(404, 'No such lesson.');
	if (!UPLOAD_ID_RE.test(params.uploadId)) return fail(404, 'Bad upload id.');

	const db = getDb();
	const found = getLesson(db, lessonId);
	if (!found || found.lesson.archivedAt !== null) return fail(404, 'No such lesson.');

	const range = parseContentRange(request.headers.get('content-range'));
	if (!range)
		return fail(400, 'A content-range header of bytes <start>-<end>/<total> is required.');
	if (range.total > MAX_LESSON_VIDEO_BYTES) {
		return fail(413, `That video is bigger than the ${MAX_LESSON_VIDEO_LABEL} limit.`);
	}
	if (range.end - range.start + 1 > MAX_UPLOAD_CHUNK_BYTES)
		return fail(413, 'That chunk is too big.');

	const mime = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	if (!mime.startsWith('video/')) return fail(415, 'Only video files can be added to a lesson.');

	if (!request.body) return fail(400, 'Empty chunk.');

	// A second writer for the same id would interleave appends and corrupt the
	// file. Refusing is right: the client uploads its chunks in sequence.
	if (writing.has(params.uploadId)) return fail(409, 'That upload is already being written.');
	writing.add(params.uploadId);

	const partial = join(uploadsDir(), `${params.uploadId}.part`);
	let received: number;
	try {
		received = await appendStream(request.body, partial, range.start, range.total);
	} catch (err) {
		if (err instanceof OffsetError) {
			return fail(409, 'That chunk starts in the wrong place.', {
				'x-received-bytes': String(err.received)
			});
		}
		if (err instanceof TooLargeError) return fail(413, 'That video is too large.');
		// adapter-node enforces BODY_SIZE_LIMIT by destroying the body stream with
		// a 413. Its default is 512 KB — far below one chunk — so a host that has
		// not raised it fails every upload, and a generic 400 here would send
		// whoever debugs that looking in entirely the wrong place.
		if (typeof err === 'object' && err !== null && 'status' in err && err.status === 413) {
			return fail(413, 'The server refused a chunk that size. Check BODY_SIZE_LIMIT on the host.');
		}
		return fail(400, 'That chunk could not be saved.');
	} finally {
		writing.delete(params.uploadId);
	}

	if (received < range.total) {
		return new Response(null, { status: 204, headers: { 'x-received-bytes': String(received) } });
	}

	// Complete. Move it into place, THEN write the row: a crash between the two
	// leaves an orphan file, which is harmless, rather than a row pointing at
	// nothing. Same order the recordings path documents.
	const originalName = safeDecodeHeader(request.headers.get('x-filename'));
	const file = `${randomUUID()}.${extensionFor(mime, originalName)}`;
	const target = join(lessonVideosDir(), file);
	await rename(partial, target);

	const size = await stat(target).then(
		(s) => s.size,
		() => 0
	);
	if (size === 0) {
		await unlink(target).catch(() => {});
		return fail(400, 'That upload was empty.');
	}

	try {
		const row = addLessonVideo(db, { lessonId, file, mime, sizeBytes: size });
		return json(row, { status: 201 });
	} catch {
		await unlink(target).catch(() => {});
		return fail(500, 'That video could not be saved.');
	}
};
