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
import { DANCES, isDanceSlug } from '$lib/dances/dances';
import type { RequestHandler } from './$types';

/** Upload a song file from the browser. Raw body, streamed — see the recordings endpoint. */
export const POST: RequestHandler = async ({ request, url }) => {
	// The endpoint is shared by both dances (it stays flat, out of `[dance]`),
	// so the caller has to say which one it is uploading into. No default: a
	// guess here would file the song on the wrong side of the wall.
	const dance = url.searchParams.get('dance') ?? '';
	if (!isDanceSlug(dance)) return new Response('Unknown dance', { status: 400 });

	const mime = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	if (!mime.startsWith('audio/')) throw error(415, 'Only audio files can be added.');
	if (Number(request.headers.get('content-length') ?? 0) > MAX_RECORDING_BYTES) {
		throw error(413, `That file is larger than ${MAX_RECORDING_LABEL}.`);
	}
	if (!request.body) throw error(400, 'Empty upload.');

	const name = safeDecodeHeader(request.headers.get('x-filename'));
	const styleHeader = request.headers.get('x-style') ?? '';
	const style = DANCES[dance].styles.includes(styleHeader) ? styleHeader : DANCES[dance].styles[0];
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
	const song = createSongFromUpload(getDb(), dance, { file, mime, title, style });
	return json({ id: song.id }, { status: 201 });
};
