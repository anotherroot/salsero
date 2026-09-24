import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	MAX_RECORDING_BYTES,
	MAX_RECORDING_LABEL,
	TooLargeError,
	audioDir,
	extensionFor,
	safeDecodeHeader,
	saveStream
} from '$lib/server/files';
import { createSongFromUpload } from '$lib/server/songs';
import { STYLES, type Style } from '$lib/labels';
import type { RequestHandler } from './$types';

/** Upload a song file from the browser. Raw body, streamed — see the recordings endpoint. */
export const POST: RequestHandler = async ({ request }) => {
	const mime = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	if (!mime.startsWith('audio/')) throw error(415, 'Only audio files can be added.');
	if (Number(request.headers.get('content-length') ?? 0) > MAX_RECORDING_BYTES) {
		throw error(413, `That file is larger than ${MAX_RECORDING_LABEL}.`);
	}
	if (!request.body) throw error(400, 'Empty upload.');

	const name = safeDecodeHeader(request.headers.get('x-filename'));
	const styleHeader = request.headers.get('x-style') ?? 'salsa';
	const style: Style = (STYLES as readonly string[]).includes(styleHeader)
		? (styleHeader as Style)
		: 'salsa';
	const file = `${randomUUID()}.${extensionFor(mime, name)}`;
	const path = join(audioDir(), file);

	let bytes: number;
	try {
		bytes = await saveStream(request.body, path, MAX_RECORDING_BYTES);
	} catch (err) {
		if (err instanceof TooLargeError)
			throw error(413, `That file is larger than ${MAX_RECORDING_LABEL}.`);
		throw error(400, 'The upload was interrupted. Try again.');
	}
	if (bytes === 0) {
		await unlink(path).catch(() => {});
		throw error(400, 'Empty upload.');
	}

	const title = name.replace(/\.[a-z0-9]{1,5}$/i, '').slice(0, 200);
	// TEMPORARY(dance): replaced by params.dance when routes move under [dance].
	const song = createSongFromUpload(getDb(), 'salsa', { file, mime, title, style });
	return json({ id: song.id }, { status: 201 });
};
