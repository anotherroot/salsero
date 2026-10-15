import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `files.ts` resolves `DATA_DIR` through `$env/dynamic/private`, and
// SvelteKit bakes that module as a literal snapshot at Vite config time — a
// runtime `process.env.DATA_DIR = dir` assignment is invisible to it, so a
// spec that only sets `process.env` silently keeps writing to the real
// `$DATA_DIR` (see `sweepUploads` below). Mocking the module, the way
// `src/routes/[dance]/dance-wall.spec.ts` mocks `$lib/server/db`, is the only
// way to be sure. `files.ts` reads no other key from `$env/dynamic/private`.
// `vi.hoisted`, not a plain `const`: `vi.mock` factories are hoisted above
// every import (see `dance-wall.spec.ts` for the same pattern), so a plain
// module-scope binding would throw "Cannot access before initialization".
const envMock = vi.hoisted(() => ({ DATA_DIR: '' }));
vi.mock('$env/dynamic/private', () => ({ env: envMock }));

import {
	appendStream,
	extensionFor,
	OffsetError,
	parseContentRange,
	parseRange,
	RECORDING_FILE_RE,
	safeDecodeHeader,
	sweepUploads,
	TooLargeError,
	uploadsDir,
	writeChunk
} from './files';

describe('recording files', () => {
	it('picks an extension from the MIME type first, then the name', () => {
		expect(extensionFor('video/quicktime', 'IMG_0001.MOV')).toBe('mov');
		expect(extensionFor('video/mp4; codecs=avc1', 'x')).toBe('mp4');
		expect(extensionFor('application/octet-stream', 'clip.MKV')).toBe('mkv');
		expect(extensionFor('', 'no-extension')).toBe('bin');
	});

	it('accepts only our own stored names', () => {
		expect(RECORDING_FILE_RE.test('0f8fad5b-d9cb-469f-a165-70867728950e.mp4')).toBe(true);
		expect(RECORDING_FILE_RE.test('../salsa.db')).toBe(false);
		expect(RECORDING_FILE_RE.test('0f8fad5b-d9cb-469f-a165-70867728950e.mp4/..')).toBe(false);
	});
});

describe('safeDecodeHeader', () => {
	it('decodes a well-formed percent-encoded header', () => {
		expect(safeDecodeHeader('Vivir%20Mi%20Vida')).toBe('Vivir Mi Vida');
	});
	it('treats a missing or malformed header as absent', () => {
		expect(safeDecodeHeader(null)).toBe('');
		expect(safeDecodeHeader('%')).toBe('');
		expect(safeDecodeHeader('%E0%A4%A')).toBe('');
	});
});

describe('parseRange', () => {
	it('is null without a usable header', () => {
		expect(parseRange(null, 100)).toBeNull();
		expect(parseRange('bytes=-', 100)).toBeNull();
		expect(parseRange('items=0-1', 100)).toBeNull();
	});

	it('reads start-end, clamping the end to the file', () => {
		expect(parseRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
		expect(parseRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
	});

	it('reads open-ended and suffix ranges', () => {
		expect(parseRange('bytes=95-', 100)).toEqual({ start: 95, end: 99 });
		expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
		expect(parseRange('bytes=-500', 100)).toEqual({ start: 0, end: 99 });
	});

	it('refuses a range past the end', () => {
		expect(parseRange('bytes=100-', 100)).toBe('unsatisfiable');
		expect(parseRange('bytes=50-40', 100)).toBe('unsatisfiable');
	});
});

describe('parseContentRange', () => {
	it('reads the request form, with an absolute total', () => {
		expect(parseContentRange('bytes 0-8388607/1073741824')).toEqual({
			start: 0,
			end: 8388607,
			total: 1073741824
		});
	});

	it('handles a total past 2^31 without truncating it', () => {
		expect(parseContentRange('bytes 0-1/4294967296')?.total).toBe(4294967296);
	});

	it('refuses anything malformed, backwards, or past the total', () => {
		expect(parseContentRange(null)).toBeNull();
		expect(parseContentRange('bytes=0-10/20')).toBeNull();
		expect(parseContentRange('bytes 0-10/*')).toBeNull();
		expect(parseContentRange('bytes 10-5/20')).toBeNull();
		expect(parseContentRange('bytes 0-20/20')).toBeNull();
		expect(parseContentRange('bytes 0-0/0')).toBeNull();
	});
});

describe('appendStream', () => {
	const stream = (bytes: Uint8Array) =>
		new ReadableStream<Uint8Array>({
			start(c) {
				c.enqueue(bytes);
				c.close();
			}
		});
	const bytes = (n: number, fill = 7) => new Uint8Array(n).fill(fill);

	let dir: string;
	let path: string;
	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'salsa-append-'));
		path = join(dir, 'upload.part');
	});
	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it('creates the file, then appends to it, reporting the running total', async () => {
		expect(await appendStream(stream(bytes(10)), path, 0, 100)).toBe(10);
		expect(await appendStream(stream(bytes(5)), path, 10, 100)).toBe(15);
		expect((await readFile(path)).length).toBe(15);
	});

	it('refuses a chunk that does not start where the file ends', async () => {
		await appendStream(stream(bytes(10)), path, 0, 100);
		await expect(appendStream(stream(bytes(5)), path, 3, 100)).rejects.toBeInstanceOf(OffsetError);
		await expect(appendStream(stream(bytes(5)), path, 3, 100)).rejects.toMatchObject({
			received: 10
		});
	});

	it('treats a missing file as an offset of zero', async () => {
		await expect(appendStream(stream(bytes(5)), path, 4, 100)).rejects.toMatchObject({
			received: 0
		});
	});

	it('truncates back to the start when the cap is breached, so a retry works', async () => {
		await appendStream(stream(bytes(10)), path, 0, 100);
		await expect(appendStream(stream(bytes(50)), path, 10, 20)).rejects.toBeInstanceOf(
			TooLargeError
		);
		// The whole gigabyte must not be lost because one chunk was wrong.
		expect((await readFile(path)).length).toBe(10);
		expect(await appendStream(stream(bytes(5)), path, 10, 100)).toBe(15);
	});
});

describe('sweepUploads', () => {
	let dir: string;
	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'salsa-sweep-'));
		envMock.DATA_DIR = dir;
	});
	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it('removes stale partials, keeps fresh ones, and never touches anything else', async () => {
		const uploads = uploadsDir();
		const old = join(uploads, 'old.part');
		const fresh = join(uploads, 'fresh.part');
		const oldDone = join(uploads, 'old.done');
		const other = join(uploads, 'notes.txt');
		await writeFile(old, 'x');
		await writeFile(oldDone, '{}');
		await writeFile(fresh, 'x');
		await writeFile(other, 'x');
		const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
		await utimes(oldDone, longAgo, longAgo);
		await utimes(old, longAgo, longAgo);

		expect(await sweepUploads(24 * 60 * 60 * 1000)).toBe(2);
		expect(existsSync(old)).toBe(false);
		expect(existsSync(oldDone)).toBe(false);
		expect(existsSync(fresh)).toBe(true);
		expect(existsSync(other)).toBe(true);
	});
});

describe('writeChunk', () => {
	const MESSAGES = { notVideo: 'Videos only.', tooLarge: 'Too big for 20 bytes.' };
	let dir: string;
	let partial: string;
	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'salsa-chunk-'));
		partial = join(dir, 'x.part');
	});
	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	const chunk = (start: number, n: number, total: number, type = 'video/mp4', range?: string) =>
		new Request('http://localhost/', {
			method: 'PUT',
			headers: {
				'content-type': type,
				'content-range': range ?? `bytes ${start}-${start + n - 1}/${total}`
			},
			body: new Uint8Array(n).fill(7)
		});
	const write = (request: Request) => writeChunk(request, partial, 20, MESSAGES);
	const refusal = async (got: unknown) => {
		expect(got).toBeInstanceOf(Response);
		const res = got as Response;
		return {
			status: res.status,
			...(await res.json()),
			received: res.headers.get('x-received-bytes')
		};
	};

	it('appends chunk by chunk and says when the file is whole', async () => {
		expect(await write(chunk(0, 4, 10))).toEqual({ done: false, received: 4 });
		expect(await write(chunk(4, 6, 10))).toEqual({ done: true, total: 10 });
		expect((await readFile(partial)).length).toBe(10);
	});

	it('refuses a chunk that does not start where the file ends, saying where it does', async () => {
		await write(chunk(0, 4, 10));
		expect(await refusal(await write(chunk(6, 4, 10)))).toMatchObject({
			status: 409,
			received: '4'
		});
	});

	it('refuses a missing range, a total over the cap, and a type that is not video', async () => {
		expect(await refusal(await write(chunk(0, 4, 10, 'video/mp4', 'nonsense')))).toMatchObject({
			status: 400
		});
		expect(await refusal(await write(chunk(0, 4, 30)))).toMatchObject({
			status: 413,
			message: 'Too big for 20 bytes.'
		});
		expect(await refusal(await write(chunk(0, 4, 10, 'text/plain')))).toMatchObject({
			status: 415,
			message: 'Videos only.'
		});
		expect(existsSync(partial)).toBe(false);
	});
});
