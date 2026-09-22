import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import {
	MAX_RECORDING_BYTES,
	TooLargeError,
	audioDir,
	extensionFor,
	saveStream,
	serveFile
} from '$lib/server/files';
import { getSong, storeFetchedAudio } from '$lib/server/songs';
import { workerTokenOk } from '$lib/server/worker-auth';
import type { RequestHandler } from './$types';

function authorize(request: Request) {
	if (!workerTokenOk(request.headers.get('authorization'), env.SALSA_WORKER_TOKEN)) {
		throw error(401, 'Bad worker token');
	}
}

function song(id: string) {
	const s = getSong(getDb(), Number(id));
	if (!s || s.archivedAt !== null) throw error(404, 'No such song');
	return s;
}

/** The worker fetches an uploaded song's audio to analyse it. */
export const GET: RequestHandler = ({ params, request }) => {
	authorize(request);
	const s = song(params.id);
	if (!s.audioFile || !s.mime) throw error(404, 'No audio yet');
	return serveFile(join(audioDir(), s.audioFile), s.mime, request);
};

/** The worker delivers downloaded audio. */
export const PUT: RequestHandler = async ({ params, request }) => {
	authorize(request);
	const s = song(params.id);
	if (!request.body) throw error(400, 'Empty upload');
	const mime = (request.headers.get('content-type') ?? 'audio/mp4').split(';')[0].trim();
	if (!mime.startsWith('audio/')) throw error(415, 'Audio only');

	const file = `${randomUUID()}.${extensionFor(mime, '')}`;
	try {
		await saveStream(request.body, join(audioDir(), file), MAX_RECORDING_BYTES);
	} catch (err) {
		if (err instanceof TooLargeError) throw error(413, 'Audio too large');
		throw error(400, 'Upload interrupted');
	}
	const duration = Number(request.headers.get('x-duration'));
	storeFetchedAudio(getDb(), s.id, {
		file,
		mime,
		title: decodeURIComponent(request.headers.get('x-title') ?? '') || null,
		durationS: Number.isFinite(duration) && duration > 0 ? duration : null
	});
	return new Response(null, { status: 204 });
};
