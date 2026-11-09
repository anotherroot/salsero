import { SUPPORTED_VERSIONS, handleRpc, type ToolHost } from './protocol';

/**
 * Streamable HTTP, JSON-only. PURE — standard Request/Response, no DOM, no db.
 * Authentication happens BEFORE this, in the route; by here the caller is known.
 *
 * The method check runs before anything else, including before the body is
 * read. The SDK client may open an optional GET SSE stream against this same
 * endpoint; answering that with a 400 parse error (from trying to read a body
 * that isn't there) breaks the client instead of just declining the stream.
 */
export async function handleMcpHttp(request: Request, host: ToolHost): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(null, { status: 405, headers: { allow: 'POST' } });
	}
	const version = request.headers.get('mcp-protocol-version');
	if (version && !(SUPPORTED_VERSIONS as readonly string[]).includes(version)) {
		return Response.json(
			{
				jsonrpc: '2.0',
				id: null,
				error: { code: -32600, message: `Unsupported protocol version ${version}` }
			},
			{ status: 400 }
		);
	}
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json(
			{ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
			{ status: 400 }
		);
	}
	const out = await handleRpc(body, host);
	return out === null ? new Response(null, { status: 202 }) : Response.json(out);
}
