import { randomUUID } from 'node:crypto';
import { readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { t } from '$lib/i18n/catalog';
import { addLessonVideo, getLesson } from '$lib/server/lessons';
import {
	extensionFor,
	failJson as fail,
	lessonVideosDir,
	safeDecodeHeader,
	uploadsDir,
	parseContentRange,
	UPLOAD_ID_RE,
	writeChunk
} from '$lib/server/files';
import { freeDisk, ownerOfRow, roomForOwner } from '$lib/server/storage';
import { allows, lessonAccess } from '$lib/server/access';
import { MAX_LESSON_VIDEO_BYTES, MAX_LESSON_VIDEO_LABEL } from '$lib/limits';
import { flowAfter } from '$lib/server/clones/flow-hook';
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
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const lessonId = Number(params.id);
	if (!Number.isInteger(lessonId) || lessonId < 1) return fail(404, t().lesson.upload.noLesson);
	if (!UPLOAD_ID_RE.test(params.uploadId)) return fail(404, t().refusals.chunk.badUploadId);

	const db = getDb();
	const found = getLesson(db, lessonId, locals.user?.id ?? '');
	// Flat: no dance in the URL, so the person and their groups are the wall.
	// Uploading needs edit: a member's lesson, another person's and a missing
	// one get the same 404.
	const mayEdit =
		found !== null &&
		!!locals.user &&
		allows(lessonAccess(db, locals.user.id, found.lesson), 'edit');
	if (!found || !mayEdit || found.lesson.archivedAt !== null)
		return fail(404, t().lesson.upload.noLesson);
	// The lesson's owner pays: a group's lesson fills the group's room, not the uploader's.
	const owner = ownerOfRow(found.lesson);

	// Already finished: the client lost our 201 and is asking again. Answer the
	// same row, or it would upload the whole video a second time as a new one.
	const done = join(uploadsDir(), `${lessonId}-${params.uploadId}.done`);
	const finished = await readFile(done, 'utf8').then(
		(text) => JSON.parse(text) as unknown,
		() => null
	);
	// Only for this lesson: an upload id is the client's, and a finished one of
	// another lesson's is not this request's to read back.
	if (finished && (finished as { lessonId?: unknown }).lessonId === lessonId) {
		return json(finished, { status: 201 });
	}
	if (finished) return fail(404, t().refusals.chunk.badUploadId);

	// The total is declared with every chunk, and a client could change it
	// mid-upload: check each one against what the finished video will add, before
	// any byte of the chunk is written.
	const range = parseContentRange(request.headers.get('content-range'));
	if (range) {
		// The chunks so far are already on the disk: the floor is what is free without them.
		const room = roomForOwner(db, owner, range.total, (await freeDisk()) + range.start);
		if (!room.ok) return fail(413, room.message);
	}

	const partial = join(uploadsDir(), `${lessonId}-${params.uploadId}.part`);
	const chunk = await writeChunk(request, partial, MAX_LESSON_VIDEO_BYTES, {
		notVideo: t().lesson.upload.notVideo,
		tooLarge: t().lesson.upload.tooLarge(MAX_LESSON_VIDEO_LABEL)
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
	// The real size, whatever the chunks declared along the way.
	// The file is already on the disk: the floor is what is free without it.
	const after = roomForOwner(db, owner, size, (await freeDisk()) + size);
	if (!after.ok) {
		await unlink(target).catch(() => {});
		return fail(413, after.message);
	}
	if (size === 0) {
		await unlink(target).catch(() => {});
		return fail(400, t().lesson.upload.empty);
	}

	let row;
	try {
		row = addLessonVideo(db, { lessonId, file, mime, sizeBytes: size }, locals.user?.id);
	} catch {
		await unlink(target).catch(() => {});
		return fail(500, t().lesson.upload.notSaved);
	}
	// Remembered for a day (swept with the partials), for a client whose 201 got lost.
	await writeFile(done, JSON.stringify(row)).catch(() => {});
	// Keep in step, on the last chunk only: the lesson gained a video.
	await flowAfter(locals.user?.id, 'lesson', lessonId);
	return json(row, { status: 201 });
};
