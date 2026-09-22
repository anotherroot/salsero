import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	MAX_RECORDING_BYTES,
	TooLargeError,
	audioDir,
	extensionFor,
	safeDecodeHeader,
	saveStream,
	serveFile
} from '$lib/server/files';
import { getSong, storeFetchedAudio } from '$lib/server/songs';
import type { RequestHandler } from './$types';

// The worker token is checked in hooks.server.ts for all of /api/worker/.

function song(id: string) {
	const s = getSong(getDb(), Number(id));
	if (!s || s.archivedAt !== null) throw error(404, 'No such song');
	return s;
}

/** The worker fetches an uploaded song's audio to analyse it. */
export const GET: RequestHandler = ({ params, request }) => {
	const s = song(params.id);
	if (!s.audioFile || !s.mime) throw error(404, 'No audio yet');
	return serveFile(join(audioDir(), s.audioFile), s.mime, request);
};

const NOT_WAITING = 'This song is not waiting for a download.';

/** The worker delivers downloaded audio — only for a song still waiting for it. */
export const PUT: RequestHandler = async ({ params, request }) => {
	const s = song(params.id);
	// Before streaming: never replace the audio (and invalidate the anchors) of
	// an uploaded, analysed or already-delivered song.
	if (s.status !== 'waiting_download') throw error(409, NOT_WAITING);
	if (!request.body) throw error(400, 'Empty upload');
	const mime = (request.headers.get('content-type') ?? 'audio/mp4').split(';')[0].trim();
	if (!mime.startsWith('audio/')) throw error(415, 'Audio only');

	const title = safeDecodeHeader(request.headers.get('x-title')) || null;
	const file = `${randomUUID()}.${extensionFor(mime, '')}`;
	const path = join(audioDir(), file);
	try {
		await saveStream(request.body, path, MAX_RECORDING_BYTES);
	} catch (err) {
		if (err instanceof TooLargeError) throw error(413, 'Audio too large');
		throw error(400, 'Upload interrupted');
	}
	const duration = Number(request.headers.get('x-duration'));
	const stored = storeFetchedAudio(getDb(), s.id, {
		file,
		mime,
		title,
		durationS: Number.isFinite(duration) && duration > 0 ? duration : null
	});
	if (!stored) {
		// The song moved on while the body streamed in.
		await unlink(path).catch(() => {});
		throw error(409, NOT_WAITING);
	}
	return new Response(null, { status: 204 });
};
