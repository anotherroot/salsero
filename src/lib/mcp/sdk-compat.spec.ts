import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { handleMcpHttp } from './http';
import type { ToolHost } from './protocol';

/*
 * The drift guard. Our protocol is hand-written to keep express, hono and
 * friends out of production; the price is that nothing else notices when MCP
 * moves. The official client, driving our handler through a fetch that never
 * leaves the process, does.
 */
const host: ToolHost = {
	tools: [
		{
			name: 'search',
			title: 'Search',
			description: 'x',
			inputSchema: { type: 'object', properties: {} },
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false
			}
		}
	],
	call: async () => ({ isError: false, text: '[]' })
};

describe('the official MCP client against our handler', () => {
	it('initializes, lists tools and calls one', async () => {
		const transport = new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
			fetch: (url, init) => handleMcpHttp(new Request(url, init), host)
		});
		const client = new Client({ name: 'compat-test', version: '0' });
		await client.connect(transport);
		const { tools } = await client.listTools();
		expect(tools.map((t) => t.name)).toEqual(['search']);
		const r = await client.callTool({ name: 'search', arguments: {} });
		expect(r.content).toEqual([{ type: 'text', text: '[]' }]);
		await client.close();
	});

	it('reads image and audio content', async () => {
		const media: ToolHost = {
			tools: host.tools,
			call: async () => ({
				isError: false,
				text: 'Here',
				images: [{ data: 'QUJD', mimeType: 'image/jpeg' }],
				audio: [{ data: 'REVG', mimeType: 'audio/mpeg' }]
			})
		};
		const transport = new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
			fetch: (url, init) => handleMcpHttp(new Request(url, init), media)
		});
		const client = new Client({ name: 'compat-test', version: '0' });
		await client.connect(transport);
		const r = await client.callTool({ name: 'search', arguments: {} });
		expect(r.content).toEqual([
			{ type: 'text', text: 'Here' },
			{ type: 'image', data: 'QUJD', mimeType: 'image/jpeg' },
			{ type: 'audio', data: 'REVG', mimeType: 'audio/mpeg' }
		]);
		await client.close();
	});
});
