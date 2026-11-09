import { describe, expect, it } from 'vitest';
import { rangeResponse } from './media-range';

const SIZE = 1000;
const bytes = Uint8Array.from({ length: SIZE }, (_, i) => i % 251);
const file = new Blob([bytes]);
const MIME = 'audio/wav';

async function body(res: Response): Promise<Uint8Array> {
	return new Uint8Array(await res.arrayBuffer());
}

describe('media from the phone: Range', () => {
	it('no Range: 200, the whole file', async () => {
		const res = rangeResponse(file, null, MIME);
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Length')).toBe('1000');
		expect(res.headers.get('Accept-Ranges')).toBe('bytes');
		expect(res.headers.get('Content-Type')).toBe(MIME);
		expect(await body(res)).toEqual(bytes);
	});

	it('bytes=0-99: 206 and the first 100 bytes', async () => {
		const res = rangeResponse(file, 'bytes=0-99', MIME);
		expect(res.status).toBe(206);
		expect(res.headers.get('Content-Range')).toBe('bytes 0-99/1000');
		expect(res.headers.get('Content-Length')).toBe('100');
		expect(res.headers.get('Content-Type')).toBe(MIME);
		expect(await body(res)).toEqual(bytes.slice(0, 100));
	});

	it('bytes=0-: 206, the whole file (what <audio> sends first)', async () => {
		const res = rangeResponse(file, 'bytes=0-', MIME);
		expect(res.status).toBe(206);
		expect(res.headers.get('Content-Range')).toBe('bytes 0-999/1000');
		expect(await body(res)).toEqual(bytes);
	});

	it('an open end and a suffix: the last bytes', async () => {
		const open = rangeResponse(file, 'bytes=900-', MIME);
		expect(open.headers.get('Content-Range')).toBe('bytes 900-999/1000');
		expect(await body(open)).toEqual(bytes.slice(900));
		const suffix = rangeResponse(file, 'bytes=-100', MIME);
		expect(suffix.status).toBe(206);
		expect(suffix.headers.get('Content-Range')).toBe('bytes 900-999/1000');
		expect(await body(suffix)).toEqual(bytes.slice(900));
	});

	it('an end past the file is clamped', () => {
		const res = rangeResponse(file, 'bytes=950-2000', MIME);
		expect(res.status).toBe(206);
		expect(res.headers.get('Content-Range')).toBe('bytes 950-999/1000');
		expect(res.headers.get('Content-Length')).toBe('50');
	});

	it('a start past the end: 416', () => {
		const res = rangeResponse(file, 'bytes=1000-', MIME);
		expect(res.status).toBe(416);
		expect(res.headers.get('Content-Range')).toBe('bytes */1000');
	});

	it('a malformed or multi-range header: 200, the whole file', async () => {
		for (const range of ['items=0-5', 'bytes=0-1,5-9', 'bytes=abc', 'bytes=9-3']) {
			const res = rangeResponse(file, range, MIME);
			expect(res.status, range).toBe(200);
			expect(await body(res)).toEqual(bytes);
		}
	});
});
