import { describe, expect, it } from 'vitest';
import { DeviceRequest } from './request';

describe('DeviceRequest', () => {
	it('carries the cookie a Request would drop, and keeps its url and method', () => {
		const headers = new Headers({ cookie: 'theme=dark; lang=sl', accept: 'application/json' });
		const req = new DeviceRequest(
			'https://salsa.test/salsa/figures/__data.json?x=1',
			{ method: 'GET' },
			headers
		);
		expect(req.headers.get('cookie')).toBe('theme=dark; lang=sl');
		expect(req.headers.get('accept')).toBe('application/json');
		expect(req.url).toBe('https://salsa.test/salsa/figures/__data.json?x=1');
		expect(req.method).toBe('GET');
		expect(req).toBeInstanceOf(Request);
	});

	it('parses a multipart body through its own content type', async () => {
		const fd = new FormData();
		fd.set('note', 'from the studio');
		const sent = new Request('https://x/', { method: 'POST', body: fd });
		const headers = new Headers({
			'content-type': sent.headers.get('content-type')!,
			cookie: 'a=b'
		});
		const req = new DeviceRequest(
			'https://salsa.test/salsa?/done',
			{ method: 'POST', body: await sent.arrayBuffer() },
			headers
		);
		expect((await req.formData()).get('note')).toBe('from the studio');
	});
});
