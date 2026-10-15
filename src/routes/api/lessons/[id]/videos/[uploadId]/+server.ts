import { randomUUID } from 'node:crypto';
import { readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { addLessonVideo, getLesson } from '$lib/server/lessons';
import {
	extensionFor,
	failJson as fail,
	lessonVideosDir,
	safeDecodeHeader,
	uploadsDir,
	UPLOAD_ID_RE,
	writeChunk
} from '$lib/server/files';
import { MAX_LESSON_VIDEO_BYTES, MAX_LESSON_VIDEO_LABEL } from '$lib/limits';
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
export const PUT: RequestHandler = async ({ params, request }) => {
	const lessonId = Number(params.id);
	if (!Number.isInteger(lessonId) || lessonId < 1) return fail(404, 'No such lesson.');
	if (!UPLOAD_ID_RE.test(params.uploadId)) return fail(404, 'Bad upload id.');

	const db = getDb();
	const found = getLesson(db, lessonId);
	if (!found || found.lesson.archivedAt !== null) return fail(404, 'No such lesson.');

	// Already finished: the client lost our 201 and is asking again. Answer the
	// same row, or it would upload the whole video a second time as a new one.
	const done = join(uploadsDir(), `${params.uploadId}.done`);
	const finished = await readFile(done, 'utf8').then(
		(text) => JSON.parse(text) as unknown,
		() => null
	);
	if (finished) return json(finished, { status: 201 });

	const partial = join(uploadsDir(), `${params.uploadId}.part`);
	const chunk = await writeChunk(request, partial, MAX_LESSON_VIDEO_BYTES, {
		notVideo: 'Only video files can be added to a lesson.',
		tooLarge: `That video is bigger than the ${MAX_LESSON_VIDEO_LABEL} limit.`
	});
	if (chunk instanceof Response) return chunk;
	if (!chunk.done) {
		return new Response(null, {
			status: 204,
			headers: { 'x-received-bytes': String(chunk.received) }
		});
	}

	// Complete. Move it into place, THEN write the row: a crash between the two
	// leaves an orphan file, which is harmless, rather than a row pointing at
	// nothing. Same order the recordings path documents.
	const mime = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
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
		// Remembered for a day (swept with the partials), for a client whose 201 got lost.
		await writeFile(done, JSON.stringify(row)).catch(() => {});
		return json(row, { status: 201 });
	} catch {
		await unlink(target).catch(() => {});
		return fail(500, 'That video could not be saved.');
	}
};
