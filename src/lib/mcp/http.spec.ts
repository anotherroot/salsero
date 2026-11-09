import { describe, expect, it } from 'vitest';
import { handleMcpHttp } from './http';
import type { ToolHost } from './protocol';

const host: ToolHost = {
	tools: [],
	call: async () => ({ isError: false, text: '' })
};

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
	handleMcpHttp(
		new Request('http://test.local/mcp', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body
		}),
		host
	);

describe('handleMcpHttp', () => {
	it('answers a non-POST request with 405 before reading a body', async () => {
		const res = await handleMcpHttp(new Request('http://test.local/mcp', { method: 'GET' }), host);
		expect(res.status).toBe(405);
		expect(res.headers.get('allow')).toBe('POST');
	});

	it('refuses an unsupported protocol version with 400', async () => {
		const res = await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }), {
			'mcp-protocol-version': '1999-01-01'
		});
		expect(res.status).toBe(400);
	});

	it('refuses invalid JSON with 400 and a JSON-RPC parse error', async () => {
		const res = await post('not json');
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toMatchObject({ error: { code: -32700 } });
	});

	it('answers a notification with 202 and an empty body', async () => {
		const res = await post(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
		expect(res.status).toBe(202);
		expect(await res.text()).toBe('');
	});

	it('answers ping with 200 JSON', async () => {
		const res = await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ jsonrpc: '2.0', id: 1, result: {} });
	});
});
