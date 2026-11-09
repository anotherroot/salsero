import { describe, expect, it } from 'vitest';
import { handleRpc, type ToolHost } from './protocol';

const host: ToolHost = {
	tools: [
		{
			name: 'echo',
			title: 'Echo',
			description: 'e',
			inputSchema: { type: 'object' },
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false
			}
		}
	],
	call: async (name, args) =>
		name === 'echo'
			? { isError: false, text: JSON.stringify(args) }
			: { isError: true, text: `Unknown tool: ${name}` }
};
const rpc = (method: string, params?: unknown, id: number | null = 1) =>
	handleRpc({ jsonrpc: '2.0', ...(id === null ? {} : { id }), method, params }, host);

describe('handleRpc', () => {
	it('negotiates a version it supports, else offers its latest', async () => {
		expect(await rpc('initialize', { protocolVersion: '2025-06-18' })).toMatchObject({
			result: { protocolVersion: '2025-06-18' }
		});
		expect(await rpc('initialize', { protocolVersion: '1999-01-01' })).toMatchObject({
			result: { protocolVersion: '2025-11-25' }
		});
	});
	it('advertises tools and nothing else', async () => {
		const r = (await rpc('initialize', { protocolVersion: '2025-11-25' })) as {
			result: { capabilities: object };
		};
		expect(r.result.capabilities).toEqual({ tools: { listChanged: false } });
	});
	it('answers a notification with nothing', async () => {
		expect(await rpc('notifications/initialized', undefined, null)).toBeNull();
	});
	it('pings', async () => expect(await rpc('ping')).toEqual({ jsonrpc: '2.0', id: 1, result: {} }));
	it('lists tools', async () => {
		expect(await rpc('tools/list')).toMatchObject({ result: { tools: [{ name: 'echo' }] } });
	});
	it('calls a tool and wraps the result as text content', async () => {
		expect(await rpc('tools/call', { name: 'echo', arguments: { a: 1 } })).toEqual({
			jsonrpc: '2.0',
			id: 1,
			result: { content: [{ type: 'text', text: '{"a":1}' }], isError: false }
		});
	});
	it('refuses an unknown tool as INVALID PARAMS, not a tool error', async () => {
		expect(await rpc('tools/call', { name: 'nope' })).toMatchObject({ error: { code: -32602 } });
	});
	it('refuses arguments that are not an object', async () => {
		expect(await rpc('tools/call', { name: 'echo', arguments: [1] })).toMatchObject({
			error: { code: -32602 }
		});
	});
	it('refuses an unknown method', async () => {
		expect(await rpc('resources/list')).toMatchObject({ error: { code: -32601 } });
	});
	it('refuses malformed JSON-RPC and batches', async () => {
		expect(await handleRpc({ id: 1, method: 'ping' }, host)).toMatchObject({
			error: { code: -32600 }
		});
		expect(await handleRpc([{ jsonrpc: '2.0', id: 1, method: 'ping' }], host)).toMatchObject({
			error: { code: -32600 }
		});
		expect(await handleRpc('x', host)).toMatchObject({ error: { code: -32600 } });
	});
	it('turns a throwing tool into a tool error, not a crash', async () => {
		const boom: ToolHost = {
			...host,
			call: async () => {
				throw new Error('db down');
			}
		};
		expect(
			await handleRpc(
				{ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'echo' } },
				boom
			)
		).toMatchObject({
			result: { isError: true }
		});
	});
	it('refuses a request whose id is null, not a string or number', async () => {
		expect(await handleRpc({ jsonrpc: '2.0', id: null, method: 'ping' }, host)).toMatchObject({
			id: null,
			error: { code: -32600 }
		});
	});
	it('refuses a request whose id is an object', async () => {
		expect(await handleRpc({ jsonrpc: '2.0', id: { x: 1 }, method: 'ping' }, host)).toMatchObject({
			error: { code: -32600 }
		});
	});
	it('echoes back a string id', async () => {
		expect(await rpc('ping', undefined, 'abc' as unknown as number)).toMatchObject({ id: 'abc' });
	});
	it('echoes back a falsy numeric id of 0, not treating it as missing', async () => {
		expect(await rpc('ping', undefined, 0)).toEqual({ jsonrpc: '2.0', id: 0, result: {} });
	});
	it('an image result becomes image content after the text', async () => {
		const withImage: ToolHost = {
			tools: host.tools,
			call: async () => ({
				isError: false,
				text: 'Here',
				images: [{ data: 'QUJD', mimeType: 'image/jpeg' }]
			})
		};
		const r = await handleRpc(
			{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo' } },
			withImage
		);
		expect(r).toMatchObject({
			result: {
				content: [
					{ type: 'text', text: 'Here' },
					{ type: 'image', data: 'QUJD', mimeType: 'image/jpeg' }
				],
				isError: false
			}
		});
	});
	it('tools/call carries audio after images', async () => {
		const withAudio: ToolHost = {
			tools: host.tools,
			call: async () => ({
				isError: false,
				text: 'Here',
				images: [{ data: 'QUJD', mimeType: 'image/jpeg' }],
				audio: [{ data: 'REVG', mimeType: 'audio/mpeg' }]
			})
		};
		const r = (await handleRpc(
			{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo' } },
			withAudio
		)) as { result: { content: { type: string }[] } };
		expect(r.result.content.map((c) => c.type)).toEqual(['text', 'image', 'audio']);
		expect(r.result.content[2]).toEqual({ type: 'audio', data: 'REVG', mimeType: 'audio/mpeg' });
	});
	it('names itself salsaapp', async () => {
		expect(await rpc('initialize', { protocolVersion: '2025-06-18' })).toMatchObject({
			result: { serverInfo: { name: 'salsaapp', version: '1.0.0' } }
		});
	});
});
