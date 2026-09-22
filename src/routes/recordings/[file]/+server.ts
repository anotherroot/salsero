import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getRecordingByFile } from '$lib/server/figures';
import { RECORDING_FILE_RE, recordingsDir } from '$lib/server/files';
import type { RequestHandler } from './$types';

/**
 * Serve a recording, with HTTP Range support.
 *
 * Range is not optional: iOS Safari refuses to play a <video> whose server
 * answers a range request with a plain 200, and seeking on any phone would
 * otherwise re-download the file from the start. Behind the session guard in
 * hooks.server.ts like every other non-public path.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!RECORDING_FILE_RE.test(params.file)) throw error(404, 'Not found');
	const rec = getRecordingByFile(getDb(), params.file);
	if (!rec) throw error(404, 'Not found');

	const path = join(recordingsDir(), rec.file);
	const size = await stat(path).then(
		(s) => s.size,
		() => null
	);
	if (size === null) throw error(404, 'The file for this recording is missing.');

	const headers: Record<string, string> = {
		'content-type': rec.mime,
		'accept-ranges': 'bytes',
		'cache-control': 'private, max-age=31536000, immutable'
	};

	const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
	if (!range || (range[1] === '' && range[2] === '')) {
		const body = Readable.toWeb(createReadStream(path)) as unknown as ReadableStream;
		return new Response(body, { headers: { ...headers, 'content-length': String(size) } });
	}

	// `bytes=-500` is the LAST 500 bytes; `bytes=500-` is from 500 to the end.
	let start = range[1] === '' ? Math.max(size - Number(range[2]), 0) : Number(range[1]);
	let end = range[1] === '' || range[2] === '' ? size - 1 : Number(range[2]);
	end = Math.min(end, size - 1);
	if (start > end || start >= size) {
		return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
	}
	start = Math.max(start, 0);

	const body = Readable.toWeb(createReadStream(path, { start, end })) as unknown as ReadableStream;
	return new Response(body, {
		status: 206,
		headers: {
			...headers,
			'content-range': `bytes ${start}-${end}/${size}`,
			'content-length': String(end - start + 1)
		}
	});
};
