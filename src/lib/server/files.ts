import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { env } from '$env/dynamic/private';
import { MAX_RECORDING_BYTES, MAX_RECORDING_LABEL } from '$lib/limits';

export { MAX_RECORDING_BYTES, MAX_RECORDING_LABEL };

/** `$DATA_DIR/recordings`, created on first use. */
export function recordingsDir(): string {
	if (!env.DATA_DIR) throw new Error('DATA_DIR is not set');
	const dir = join(env.DATA_DIR, 'recordings');
	mkdirSync(dir, { recursive: true });
	return dir;
}

/** Stored names are ours: a uuid and a short extension. Anything else is refused before touching disk. */
export const RECORDING_FILE_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,5}$/;

const EXT_BY_MIME: Record<string, string> = {
	'video/mp4': 'mp4',
	'video/quicktime': 'mov',
	'video/webm': 'webm',
	'video/3gpp': '3gp',
	'audio/mpeg': 'mp3',
	'audio/mp4': 'm4a',
	'audio/x-m4a': 'm4a',
	'audio/aac': 'aac',
	'audio/ogg': 'ogg',
	'audio/webm': 'weba',
	'audio/wav': 'wav',
	'audio/x-wav': 'wav',
	'audio/flac': 'flac'
};

/** An extension for a stored file: from the MIME type, else the original name, else `bin`. */
export function extensionFor(mime: string, originalName: string): string {
	const known = EXT_BY_MIME[mime.split(';')[0].trim().toLowerCase()];
	if (known) return known;
	const m = /\.([a-z0-9]{1,5})$/i.exec(originalName);
	return m ? m[1].toLowerCase() : 'bin';
}

/** `$DATA_DIR/audio`, created on first use. Song audio lives here. */
export function audioDir(): string {
	if (!env.DATA_DIR) throw new Error('DATA_DIR is not set');
	const dir = join(env.DATA_DIR, 'audio');
	mkdirSync(dir, { recursive: true });
	return dir;
}

/** Stored song audio names: the same uuid-plus-extension shape as recordings. */
export const AUDIO_FILE_RE = RECORDING_FILE_RE;

/**
 * Parse a `Range: bytes=…` header against a file size.
 * `bytes=-500` is the LAST 500 bytes; `bytes=500-` is from 500 to the end.
 */
export function parseRange(
	header: string | null,
	size: number
): { start: number; end: number } | 'unsatisfiable' | null {
	const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
	if (!m || (m[1] === '' && m[2] === '')) return null;
	const start = m[1] === '' ? Math.max(size - Number(m[2]), 0) : Number(m[1]);
	const end = Math.min(m[1] === '' || m[2] === '' ? size - 1 : Number(m[2]), size - 1);
	if (start > end || start >= size) return 'unsatisfiable';
	return { start, end };
}

/**
 * Serve a file with HTTP Range support. Range is not optional: iOS Safari
 * refuses to play media whose server answers a range request with a plain 200.
 */
export async function serveFile(path: string, mime: string, request: Request): Promise<Response> {
	const size = await stat(path).then(
		(s) => s.size,
		() => null
	);
	if (size === null) return new Response('The file is missing.', { status: 404 });

	const headers: Record<string, string> = {
		'content-type': mime,
		'accept-ranges': 'bytes',
		'cache-control': 'private, max-age=31536000, immutable'
	};
	const range = parseRange(request.headers.get('range'), size);
	if (range === 'unsatisfiable') {
		return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
	}
	if (range === null) {
		const body = Readable.toWeb(createReadStream(path)) as unknown as ReadableStream;
		return new Response(body, { headers: { ...headers, 'content-length': String(size) } });
	}
	const body = Readable.toWeb(
		createReadStream(path, { start: range.start, end: range.end })
	) as unknown as ReadableStream;
	return new Response(body, {
		status: 206,
		headers: {
			...headers,
			'content-range': `bytes ${range.start}-${range.end}/${size}`,
			'content-length': String(range.end - range.start + 1)
		}
	});
}

/** A worker or browser can send a malformed `%` sequence; treat it as if the header were absent rather than 500ing. */
export function safeDecodeHeader(value: string | null): string {
	try {
		return decodeURIComponent(value ?? '');
	} catch {
		return '';
	}
}

export class TooLargeError extends Error {}

/**
 * Stream a request body to `path`, counting bytes so a missing or lying
 * `content-length` cannot get past the cap. Never leaves a partial file: on
 * any failure the file is removed and the error rethrown.
 */
export async function saveStream(
	body: ReadableStream<Uint8Array>,
	path: string,
	maxBytes: number
): Promise<number> {
	let bytes = 0;
	const limit = new Transform({
		transform(chunk: Buffer, _enc, done) {
			bytes += chunk.length;
			if (bytes > maxBytes) done(new TooLargeError('too large'));
			else done(null, chunk);
		}
	});
	try {
		await pipeline(
			Readable.fromWeb(body as unknown as NodeWebReadableStream),
			limit,
			createWriteStream(path, { flags: 'wx' })
		);
	} catch (err) {
		await unlink(path).catch(() => {});
		throw bytes > maxBytes ? new TooLargeError('too large') : err;
	}
	return bytes;
}
