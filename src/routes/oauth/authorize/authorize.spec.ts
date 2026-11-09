/**
 * The consent page through its load and actions, on an in-memory db (mocked as
 * `src/routes/[dance]/dance-wall.spec.ts` does). The client is a registered one,
 * so nothing is fetched.
 */
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
const handleEnv = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => handleEnv);
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { oauthCodes, users } from '$lib/server/db/schema';
import { registerClient } from '$lib/server/oauth/register';
import { actions, load } from './+page.server';

const ORIGIN = 'https://salsa.anotherroot.eu';
const REDIRECT = 'https://chatgpt.com/cb';
const CHALLENGE = createHash('sha256').update('v'.repeat(50)).digest('base64url');

let db: Db;
let clientId = '';
const user = (id: string, dance: 'salsa' | 'bachata') => ({
	id,
	email: `${id}@example.com`,
	firstName: 'Ana',
	lastName: null,
	timezone: 'Europe/Ljubljana',
	isAdmin: false,
	level: 'all' as const,
	dance,
	locale: 'en' as const
});

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	handleEnv.env = {};
	for (const [id, dance] of [
		['u1', 'salsa'],
		['u2', 'salsa'],
		['b1', 'bachata']
	] as const)
		db.insert(users)
			.values({ id, email: `${id}@example.com`, passwordHash: 'x', dance })
			.run();
	const r = registerClient(
		db,
		{ client_name: 'ChatGPT', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' },
		0
	);
	if (!r.ok) throw new Error('registration refused');
	clientId = String(r.response.client_id);
});

const params = (over: Record<string, string> = {}) =>
	new URLSearchParams({
		response_type: 'code',
		client_id: clientId,
		redirect_uri: REDIRECT,
		code_challenge: CHALLENGE,
		code_challenge_method: 'S256',
		state: 's1',
		...over
	});

function loadEvent(p: URLSearchParams, who = user('u1', 'salsa')) {
	const headers: Record<string, string> = {};
	const event = {
		url: new URL(`${ORIGIN}/oauth/authorize?${p}`),
		locals: { user: who, locale: 'en' },
		setHeaders: (h: Record<string, string>) => Object.assign(headers, h)
	};
	return { event: event as never, headers };
}

function actionEvent(p: URLSearchParams, as: string, who = user('u1', 'salsa')) {
	const headers: Record<string, string> = {};
	const body = new URLSearchParams(p);
	body.set('as', as);
	const event = {
		url: new URL(`${ORIGIN}/oauth/authorize?/approve`),
		request: new Request(`${ORIGIN}/oauth/authorize?/approve`, { method: 'POST', body }),
		locals: { user: who, locale: 'en' },
		setHeaders: (h: Record<string, string>) => Object.assign(headers, h)
	};
	return { event: event as never, headers };
}

/** A thrown redirect's location, or the thrown error's status. */
async function outcome(run: () => unknown): Promise<{ status: number; location?: string }> {
	try {
		const r = await run();
		return { status: (r as { status?: number })?.status ?? 200 };
	} catch (e) {
		const x = e as { status: number; location?: string };
		return { status: x.status, location: x.location };
	}
}

describe('the consent page', () => {
	it('loads the client: its host first, its own name second, and refuses framing', async () => {
		const { event, headers } = loadEvent(params());
		const data = (await load(event)) as Record<string, unknown>;
		expect(data).toMatchObject({ kind: 'ask', host: 'chatgpt.com', name: 'ChatGPT', as: 'u1' });
		expect(headers['x-frame-options']).toBe('DENY');
		expect(headers['content-security-policy']).toBe("frame-ancestors 'none'");
	});

	it('shows its own error, never a redirect, when the redirect URI is not the client`s', async () => {
		const { event } = loadEvent(params({ redirect_uri: 'https://evil.example/cb' }));
		expect(((await load(event)) as { kind: string }).kind).toBe('bad');
	});

	it('approve: a 303 to the registered redirect with a code, the same state and the issuer', async () => {
		const { event, headers } = actionEvent(params(), 'u1');
		const r = await outcome(() => actions.approve(event));
		expect(r.status).toBe(303);
		const u = new URL(r.location!);
		expect(u.origin + u.pathname).toBe(REDIRECT);
		expect(u.searchParams.get('code')).toMatch(/^sa_code_/);
		expect(u.searchParams.get('state')).toBe('s1');
		expect(u.searchParams.get('iss')).toBe(ORIGIN);
		expect(headers['x-frame-options']).toBe('DENY');
		expect(db.select().from(oauthCodes).all()).toHaveLength(1);
	});

	it('cancel: back to the client with access_denied, and no code', async () => {
		const { event } = actionEvent(params(), 'u1');
		const r = await outcome(() => actions.cancel(event));
		expect(new URL(r.location!).searchParams.get('error')).toBe('access_denied');
		expect(db.select().from(oauthCodes).all()).toHaveLength(0);
	});

	it('refuses a post signed for someone else', async () => {
		const { event } = actionEvent(params(), 'u2');
		expect((await outcome(() => actions.approve(event))).status).toBe(403);
		expect(db.select().from(oauthCodes).all()).toHaveLength(0);
	});

	it('re-checks the parameters on the post', async () => {
		const { event } = actionEvent(params({ redirect_uri: 'https://evil.example/cb' }), 'u1');
		expect((await outcome(() => actions.approve(event))).status).toBe(400);
		expect(db.select().from(oauthCodes).all()).toHaveLength(0);
	});

	it("on a dance's host, the other dance's account gets no form", async () => {
		handleEnv.env = {
			DANCE_HOSTS: 'salsa.anotherroot.eu=salsa,bachata.anotherroot.eu=bachata'
		};
		const { event } = loadEvent(params(), user('b1', 'bachata'));
		expect(((await load(event)) as { kind: string }).kind).toBe('otherDance');
		const post = actionEvent(params(), 'b1', user('b1', 'bachata'));
		expect((await outcome(() => actions.approve(post.event))).status).toBe(403);
	});
});
