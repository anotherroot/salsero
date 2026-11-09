/**
 * MCP over JSON-RPC, the part this server needs. PURE.
 *
 * Stateless, tools only: initialize, ping, tools/list, tools/call, and
 * notifications (answered with nothing). Hand-written rather than the SDK to
 * keep its dependency tree out of production; `sdk-compat.spec.ts` drives this
 * with the official client so protocol drift fails a test, not a phone.
 */

export const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;

export interface ToolDef {
	name: string;
	title: string;
	description: string;
	inputSchema: object;
	annotations: {
		readOnlyHint: boolean;
		destructiveHint: boolean;
		idempotentHint: boolean;
		openWorldHint: false;
	};
}

/** What a tool says. `isError` is for the MODEL to read and correct, not a protocol failure. */
export interface ToolResult {
	isError: boolean;
	text: string;
	/** Base64 images, sent as image content after the text. */
	images?: { data: string; mimeType: string }[];
}

export interface ToolHost {
	tools: readonly ToolDef[];
	call(name: string, args: Record<string, unknown>): Promise<ToolResult>;
}

export const INSTRUCTIONS =
	"A dance practice app: one person's salsa or bachata (one dance per account). A move holds figures (variations of it); a figure has a start count, a length in counts, start and end positions, notes and recordings with sections. Routines are ordered slots of figures. Drills are practice items. Lessons hold notes, videos with sections, and links to figures, routines, drills and positions; a group's lessons are drafts until published. Positions are holds and places a figure starts or ends in. Every id comes from search or a list tool; never invent one. Names and notes are the person's own words, often Slovenian or Spanish: never translate them. This version reads only; it cannot change anything.";

type Id = string | number | null;
const ok = (id: Id, result: object) => ({ jsonrpc: '2.0', id, result });
const err = (id: Id, code: number, message: string) => ({
	jsonrpc: '2.0',
	id,
	error: { code, message }
});

export async function handleRpc(msg: unknown, host: ToolHost): Promise<object | null> {
	if (!msg || typeof msg !== 'object' || Array.isArray(msg))
		return err(null, -32600, 'Invalid request');
	const m = msg as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
	if (m.jsonrpc !== '2.0' || typeof m.method !== 'string')
		return err(null, -32600, 'Invalid request');
	if (!('id' in m)) return null; // a notification
	if (typeof m.id !== 'string' && !(typeof m.id === 'number' && Number.isFinite(m.id))) {
		return err(null, -32600, 'Invalid request: id must be a string or number');
	}
	const id = m.id;
	const params = (m.params && typeof m.params === 'object' ? m.params : {}) as Record<
		string,
		unknown
	>;

	switch (m.method) {
		case 'initialize': {
			const asked = params.protocolVersion;
			const protocolVersion = (SUPPORTED_VERSIONS as readonly unknown[]).includes(asked)
				? (asked as string)
				: SUPPORTED_VERSIONS[0];
			return ok(id, {
				protocolVersion,
				capabilities: { tools: { listChanged: false } },
				serverInfo: { name: 'salsaapp', version: '1.0.0' },
				instructions: INSTRUCTIONS
			});
		}
		case 'ping':
			return ok(id, {});
		case 'tools/list':
			return ok(id, { tools: host.tools });
		case 'tools/call': {
			const name = params.name;
			if (typeof name !== 'string' || !host.tools.some((t) => t.name === name)) {
				return err(id, -32602, `Unknown tool: ${String(name)}`);
			}
			const args = params.arguments ?? {};
			if (typeof args !== 'object' || args === null || Array.isArray(args)) {
				return err(id, -32602, 'arguments must be an object');
			}
			let r: ToolResult;
			try {
				r = await host.call(name, args as Record<string, unknown>);
			} catch (e) {
				console.error(`[mcp] ${name} failed`, e);
				r = { isError: true, text: 'The server failed to run this tool.' };
			}
			return ok(id, {
				content: [
					{ type: 'text', text: r.text },
					...(r.images ?? []).map((i) => ({ type: 'image', data: i.data, mimeType: i.mimeType }))
				],
				isError: r.isError
			});
		}
		default:
			return err(id, -32601, `Method not found: ${m.method}`);
	}
}
