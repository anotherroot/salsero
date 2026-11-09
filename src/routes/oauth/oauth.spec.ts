/**
 * The connector's sign-in routes, called through their handlers on an
 * in-memory db (mocked as `src/routes/[dance]/dance-wall.spec.ts` does).
 */
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { approve } from '$lib/server/oauth/store';
import { resetOAuthLimits } from '$lib/server/oauth/limits';
import { GET as asMeta } from '../.well-known/oauth-authorization-server/+server';
import { GET as prMeta } from '../.well-known/oauth-protected-resource/+server';
import { GET as prMcpMeta } from '../.well-known/oauth-protected-resource/mcp/+server';
import { POST as register } from './register/+server';
import { POST as token } from './token/+server';

const ORIGIN = 'https://salsa.anotherroot.eu';
const VERIFIER = 'v'.repeat(50);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	resetOAuthLimits();
	db.insert(users)
		.values({ id: 'u1', email: 'u1@example.com', passwordHash: 'x', dance: 'salsa' })
		.run();
});

// The handlers read only these parts of the event.
const ev = (request: Request, ip = '1.2.3.4') =>
	({ request, url: new URL(request.url), getClientAddress: () => ip }) as never;

const form = (body: Record<string, string>) =>
	new Request(`${ORIGIN}/oauth/token`, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(body)
	});

const registerBody = {
	client_name: 'ChatGPT',
	redirect_uris: ['https://chatgpt.com/cb'],
	token_endpoint_auth_method: 'none',
	grant_types: ['authorization_code', 'refresh_token']
};
const registerReq = (body: unknown = registerBody) =>
	new Request(`${ORIGIN}/oauth/register`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});

describe('discovery', () => {
	it('names this host as the issuer and offers registration', async () => {
		const res = await asMeta(ev(new Request(`${ORIGIN}/.well-known/oauth-authorization-server`)));
		const m = await res.json();
		expect(m.issuer).toBe(ORIGIN);
		expect(m.registration_endpoint).toBe(`${ORIGIN}/oauth/register`);
		expect(res.headers.get('cache-control')).toBe('no-store');
	});
	it('serves the resource document at both paths', async () => {
		for (const get of [prMeta, prMcpMeta]) {
			const res = await get(ev(new Request(`${ORIGIN}/.well-known/oauth-protected-resource`)));
			expect((await res.json()).resource).toBe(`${ORIGIN}/mcp`);
		}
	});
});

describe('registration', () => {
	it('registers a public client: 201 and a client id', async () => {
		const res = await register(ev(registerReq()));
		expect(res.status).toBe(201);
		expect((await res.json()).client_id).toMatch(/^sa_client_/);
	});
	it('refuses a bad body with the RFC error', async () => {
		const res = await register(
			ev(registerReq({ ...registerBody, redirect_uris: ['http://x.eu/'] }))
		);
		expect(res.status).toBe(400);
		expect((await res.json()).error).toBe('invalid_redirect_uri');
	});
	it('limits one address to 20 registrations an hour', async () => {
		for (let i = 0; i < 20; i++) expect((await register(ev(registerReq()))).status).toBe(201);
		expect((await register(ev(registerReq()))).status).toBe(429);
		expect((await register(ev(registerReq(), '5.6.7.8'))).status).toBe(201);
	});
});

describe('token', () => {
	const CLIENT = 'https://claude.ai/oauth/meta';
	const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
	const code = () =>
		approve(
			db,
			{
				userId: 'u1',
				clientId: CLIENT,
				clientName: 'Claude',
				redirectUri: REDIRECT,
				codeChallenge: CHALLENGE
			},
			Date.UTC(2030, 0, 1)
		);
	const exchange = (c: string, verifier = VERIFIER) =>
		token(
			ev(
				form({
					grant_type: 'authorization_code',
					code: c,
					code_verifier: verifier,
					redirect_uri: REDIRECT,
					client_id: CLIENT
				})
			)
		);

	it('exchanges a code for a bearer pair, not cached', async () => {
		const res = await exchange(code());
		expect(res.status).toBe(200);
		expect((await res.json()).token_type).toBe('Bearer');
		expect(res.headers.get('cache-control')).toBe('no-store');
	});
	it('a wrong verifier is invalid_grant and burns the code', async () => {
		const c = code();
		const bad = await exchange(c, 'w'.repeat(50));
		expect(bad.status).toBe(400);
		expect((await bad.json()).error).toBe('invalid_grant');
		expect((await exchange(c)).status).toBe(400);
	});
	it('refuses a token for another resource', async () => {
		const res = await token(
			ev(
				form({
					grant_type: 'refresh_token',
					refresh_token: 'x',
					client_id: CLIENT,
					resource: 'https://evil.eu/mcp'
				})
			)
		);
		expect((await res.json()).error).toBe('invalid_target');
	});
	it('after 30 failures from one address answers 429, other addresses still work', async () => {
		for (let i = 0; i < 30; i++) expect((await exchange('sa_code_nope')).status).toBe(400);
		expect((await exchange('sa_code_nope')).status).toBe(429);
		const other = await token(
			ev(
				form({
					grant_type: 'authorization_code',
					code: code(),
					code_verifier: VERIFIER,
					redirect_uri: REDIRECT,
					client_id: CLIENT
				}),
				'9.9.9.9'
			)
		);
		expect(other.status).toBe(200);
	});
});
