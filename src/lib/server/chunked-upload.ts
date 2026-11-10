/*
 * One chunk of a resumable upload (offline phase 4c), shared by a new
 * recording, and a phone-only recording's or lesson video's server copy.
 * As the lesson video's own route: the partial file IS the state, its size the
 * resume offset (409 + `x-received-bytes`); room is checked on every chunk
 * and again on the whole file; a finished upload is remembered for a day so a
 * client that lost the 201 gets the same row back.
 */
import { readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { json } from '@sveltejs/kit';
import type { Db } from './db';
import { t } from '$lib/i18n/catalog';
import { failJson as fail, parseContentRange, uploadsDir, writeChunk } from './files';
import { freeDisk, roomForOwner, type Owner } from './storage';
import { MAX_LESSON_VIDEO_BYTES } from '$lib/limits';

export type Received = { done: true; partial: string; size: number };

/** `name`: the upload's own name in the uploads folder (`rec-12-<uploadId>`), never a client's. */
export async function receiveChunk(
	db: Db,
	request: Request,
	owner: Owner,
	name: string
): Promise<Response | Received> {
	const range = parseContentRange(request.headers.get('content-range'));
	if (range) {
		// The chunks so far are already on the disk: the floor is what is free without them.
		const room = roomForOwner(db, owner, range.total, (await freeDisk()) + range.start);
		if (!room.ok) return fail(413, room.message);
	}
	const partial = join(uploadsDir(), `${name}.part`);
	const chunk = await writeChunk(request, partial, MAX_LESSON_VIDEO_BYTES, {
		notVideo: t().lesson.upload.notVideo,
		tooLarge: t().video.place.refusal.tooBig
	});
	if (chunk instanceof Response) return chunk;
	if (!chunk.done)
		return new Response(null, {
			status: 204,
			headers: { 'x-received-bytes': String(chunk.received) }
		});
	const size = await stat(partial).then(
		(s) => s.size,
		() => 0
	);
	if (size === 0) {
		await unlink(partial).catch(() => {});
		return fail(400, t().lesson.upload.empty);
	}
	// The real size, whatever the chunks declared; the file is on the disk already.
	const after = roomForOwner(db, owner, size, (await freeDisk()) + size);
	if (!after.ok) {
		await unlink(partial).catch(() => {});
		return fail(413, after.message);
	}
	return { done: true, partial, size };
}

/** The row a finished upload answered, if this upload finished already. */
export async function finishedRow(name: string): Promise<unknown> {
	return readFile(join(uploadsDir(), `${name}.done`), 'utf8').then(
		(text) => JSON.parse(text) as unknown,
		() => null
	);
}

/** Remember a finished upload's row (swept with the partials after a day), and answer it. */
export async function finish(name: string, row: unknown): Promise<Response> {
	await writeFile(join(uploadsDir(), `${name}.done`), JSON.stringify(row)).catch(() => {});
	return json(row, { status: 201 });
}
