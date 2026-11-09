/** The /mcp route, called in process with a test db and a real grant and token. */
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
const handleEnv = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => handleEnv);
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});
// The route builds its host from TOOL_MODULES; the test swaps in one tool.
vi.mock('$lib/server/mcp/modules', () => ({
	TOOL_MODULES: [
		{
			defs: [
				{
					name: 'whoami',
					title: 'Who am I',
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
			impls: {
				whoami: async (_a: unknown, ctx: { userId: string; dance: string }) => ({
					isError: false,
					text: `${ctx.userId} ${ctx.dance}`
				})
			}
		}
	]
}));

import { openDb, type Db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { approve, exchangeCode, listGrants, revokeGrant } from '$lib/server/oauth/store';
import { serverNow } from '$lib/server/server-clock';
import { DELETE, GET, POST } from './+server';

const VERIFIER = 'v'.repeat(50);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const CLIENT = 'https://claude.ai/meta';
const HOSTS = 'salsa.anotherroot.eu=salsa,bachata.anotherroot.eu=bachata';

let db: Db;
const tokens: Record<string, string> = {};
beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	handleEnv.env = {};
	for (const [id, dance] of [
		['u1', 'salsa'],
		['b1', 'bachata']
	] as const) {
		db.insert(users)
			.values({ id, email: `${id}@example.com`, passwordHash: 'x', dance })
			.run();
		const now = serverNow();
		const code = approve(
			db,
			{
				userId: id,
				clientId: CLIENT,
				clientName: 'Claude',
				redirectUri: REDIRECT,
				codeChallenge: CHALLENGE
			},
			now
		);
		const r = exchangeCode(
			db,
			{ code, verifier: VERIFIER, redirectUri: REDIRECT, clientId: CLIENT },
			now
		);
		if ('error' in r) throw new Error(r.description);
		tokens[id] = r.access_token;
	}
});

const ev = (request: Request) => ({ request, url: new URL(request.url) }) as never;
const rpcCall = (method: string, params?: object) => ({ jsonrpc: '2.0', id: 1, method, params });
const call = (
	headers: Record<string, string>,
	body: unknown = rpcCall('tools/list'),
	origin = 'https://salsa.anotherroot.eu'
) =>
	POST(
		ev(
			new Request(`${origin}/mcp`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify(body)
			})
		)
	);
const bearer = (id = 'u1') => ({ authorization: `Bearer ${tokens[id]}` });

describe('POST /mcp', () => {
	it('no token is 401 with WWW-Authenticate naming the metadata', async () => {
		const res = await call({});
		expect(res.status).toBe(401);
		expect(res.headers.get('www-authenticate')).toContain(
			'https://salsa.anotherroot.eu/.well-known/oauth-protected-resource/mcp'
		);
	});
	it("a revoked grant's token is 401", async () => {
		const [g] = listGrants(db, 'u1', serverNow());
		revokeGrant(db, 'u1', g.id, serverNow());
		expect((await call(bearer())).status).toBe(401);
	});
	it('a session cookie is no way in', async () => {
		expect((await call({ cookie: 'salsa_session=abc' })).status).toBe(401);
	});
	it('another Origin is 403, the app`s own is let through', async () => {
		expect((await call({ ...bearer(), origin: 'https://evil.example' })).status).toBe(403);
		expect((await call({ ...bearer(), origin: 'https://salsa.anotherroot.eu' })).status).toBe(200);
	});
	it('GET and DELETE are 405 with allow: POST', async () => {
		for (const h of [GET, DELETE]) {
			const res = await h(ev(new Request('https://salsa.anotherroot.eu/mcp')));
			expect(res.status).toBe(405);
			expect(res.headers.get('allow')).toBe('POST');
		}
	});
	it("tools/call reaches the host with the token's person and dance", async () => {
		const res = await call(bearer(), rpcCall('tools/call', { name: 'whoami', arguments: {} }));
		expect(await res.json()).toMatchObject({
			result: { content: [{ type: 'text', text: 'u1 salsa' }], isError: false }
		});
	});
	it("on a dance's host, the other dance's token is 401", async () => {
		handleEnv.env = { DANCE_HOSTS: HOSTS };
		expect((await call(bearer('b1'))).status).toBe(401);
		expect((await call(bearer('b1'), undefined, 'https://bachata.anotherroot.eu')).status).toBe(
			200
		);
		expect((await call(bearer('u1'))).status).toBe(200);
	});
});
