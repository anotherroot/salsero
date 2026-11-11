/**
 * The 426 for an app below its dance's minimum, at the hook: it is for the
 * native API (`x-app-version`), never for a page's own `/api/` calls inside the
 * WebView (its user agent) — those are the page epoch's job — and never for
 * the update check or the APK an old app needs to get out of it.
 *
 * The release is mocked (no `$DATA_DIR`), and so is `getDb()`: each test gets
 * its own `openDb(':memory:')`, as `src/routes/[dance]/dance-wall.spec.ts` does.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { Release } from '$lib/app-update/agent';

const handleDb = vi.hoisted(() => ({ db: undefined as unknown }));
const handleEnv = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => handleEnv);

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handleDb.db };
});
vi.mock('$lib/server/db/bootstrap', () => ({ bootstrap: async () => {} }));
vi.mock('$lib/server/releases', () => ({
	currentRelease: (): Release => ({
		versionCode: 3,
		versionName: '1.2',
		minVersionCode: 3,
		sha256: 'a'.repeat(64),
		size: 1000,
		commit: 'abc'
	})
}));

import { createHash } from 'node:crypto';
import { SESSION_COOKIE, createSession } from '$lib/server/auth';
import { openDb } from '$lib/server/db';
import { appInstalls, invites, users } from '$lib/server/db/schema';
import { locale } from '$lib/i18n/current';
import { LOCALE_COOKIE } from '$lib/i18n/locale';
import { handle } from './hooks.server';

const OLD_HEADER = '2; salsa; direct';
const OLD_WEBVIEW_UA =
	'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 SalsaApp/2 (salsa; direct)';

/** The status the hook answers with; a redirect thrown for a page counts as its status. */
async function status(path: string, headers: Record<string, string>): Promise<number> {
	const url = new URL(`https://salsa.example${path}`);
	const event = {
		url,
		request: new Request(url, { headers }),
		cookies: { get: () => undefined, set: () => {} },
		locals: {}
	} as unknown as RequestEvent;
	const resolve = vi.fn(async () => new Response('ok'));
	try {
		const res = await handle({ event, resolve });
		return res.status;
	} catch (e) {
		const thrown = e as { status?: number };
		if (typeof thrown.status === 'number') return thrown.status;
		throw e;
	}
}

describe('the first-run gate', () => {
	/** A signed-in person with this level: the hook's status, and where a redirect points. */
	async function asLevel(
		level: string | null,
		path: string
	): Promise<{ status: number; location?: string }> {
		const db = openDb(':memory:');
		handleDb.db = db;
		db.insert(users)
			.values({
				id: 'u1',
				email: 'a@example.com',
				passwordHash: 'x',
				dance: 'salsa',
				firstName: 'Ana',
				lastName: 'K',
				level
			})
			.run();
		const session = createSession('u1');
		const url = new URL(`https://salsa.example${path}`);
		const event = {
			url,
			request: new Request(url),
			cookies: { get: () => session.id, set: () => {} },
			locals: {}
		} as unknown as RequestEvent;
		try {
			const res = await handle({ event, resolve: vi.fn(async () => new Response('ok')) });
			return { status: res.status };
		} catch (e) {
			const thrown = e as { status?: number; location?: string };
			if (typeof thrown.status === 'number')
				return { status: thrown.status, location: thrown.location };
			throw e;
		}
	}

	it('sends a person with no level to the first run, remembering the page', async () => {
		expect(await asLevel(null, '/salsa/songs?x=1')).toEqual({
			status: 303,
			location: '/welcome/start?next=%2Fsalsa%2Fsongs%3Fx%3D1'
		});
		expect(await asLevel(null, '/g/ABCD')).toMatchObject({
			status: 303,
			location: '/welcome/start?next=%2Fg%2FABCD'
		});
	});

	it('lets the API, the media, logout, health and the first run itself pass', async () => {
		for (const p of ['/api/x', '/audio/a', '/logout', '/health', '/welcome/start', '/welcome']) {
			expect((await asLevel(null, p)).status, p).toBe(200);
		}
	});

	it('lets a person who has chosen any level pass', async () => {
		for (const l of ['follow', 'own', 'all']) {
			expect((await asLevel(l, '/salsa')).status, l).toBe(200);
		}
	});
});

describe('the old-app gate', () => {
	beforeEach(() => {
		handleDb.db = openDb(':memory:');
	});

	it('refuses an old app on its native API', async () => {
		expect(await status('/api/device/today', { 'x-app-version': OLD_HEADER })).toBe(426);
	});

	it('lets an old app ask for the update and fetch it', async () => {
		expect(await status('/api/app-update/salsa', { 'x-app-version': OLD_HEADER })).not.toBe(426);
		expect(await status('/releases/salsa/2.apk', { 'x-app-version': OLD_HEADER })).not.toBe(426);
	});

	it("never refuses the page's own API calls inside an old app's WebView", async () => {
		expect(await status('/api/count-takes', { 'user-agent': OLD_WEBVIEW_UA })).not.toBe(426);
	});
});

describe('the two hosts', () => {
	const BACHATA_UA =
		'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 SalsaApp/7 (bachata; direct)';

	/** A salsa account's session on the bachata host: the status, where it goes, whether it went on. */
	async function onBachataHost(method: string, path: string) {
		handleEnv.env.DANCE_HOSTS = 'salsa.example=salsa,bachata.example=bachata';
		const db = openDb(':memory:');
		handleDb.db = db;
		db.insert(users)
			.values({
				id: 'u1',
				email: 'a@example.com',
				passwordHash: 'x',
				dance: 'salsa',
				firstName: 'Ana',
				lastName: 'K',
				level: 'all'
			})
			.run();
		const session = createSession('u1');
		const url = new URL(`https://bachata.example${path}`);
		const event = {
			url,
			request: new Request(url, { method, headers: { 'user-agent': BACHATA_UA } }),
			cookies: { get: () => session.id, set: () => {} },
			locals: {}
		} as unknown as RequestEvent;
		const resolve = vi.fn(async () => new Response('ok'));
		try {
			const res = await handle({ event, resolve });
			return { status: res.status, resolved: resolve.mock.calls.length, db };
		} catch (e) {
			const thrown = e as { status: number; location?: string };
			return { status: thrown.status, location: thrown.location, resolved: 0, db };
		} finally {
			delete handleEnv.env.DANCE_HOSTS;
		}
	}

	// Catches: a request sent away from this host still noting the app as seen
	// for an account of the other dance (a bachata app on a salsa account).
	it('notes no app for a request it sends to the other host', async () => {
		const got = await onBachataHost('GET', '/bachata/moves');
		expect(got).toMatchObject({ status: 303, location: 'https://salsa.example/' });
		expect(got.db.select().from(appInstalls).all()).toEqual([]);
	});

	// Catches: a stale session of the other dance that cannot sign out on this host.
	it("lets the other dance's session sign out here", async () => {
		expect(await onBachataHost('POST', '/logout')).toMatchObject({ status: 200, resolved: 1 });
	});
});

describe('the language', () => {
	/**
	 * The page the hook draws: `<html lang>` filled by `transformPageChunk`, and
	 * the language `locale()` reads while the page renders (inside `resolve`).
	 */
	async function draw(
		path: string,
		opts: {
			cookie?: string;
			userLocale?: string | null;
			invite?: string | null;
			acceptLanguage?: string;
		} = {}
	) {
		const db = openDb(':memory:');
		handleDb.db = db;
		let session: string | undefined;
		if (opts.userLocale !== undefined) {
			db.insert(users)
				.values({
					id: 'u1',
					email: 'a@example.com',
					passwordHash: 'x',
					dance: 'salsa',
					firstName: 'Ana',
					lastName: 'K',
					level: 'all',
					locale: opts.userLocale
				})
				.run();
			session = createSession('u1').id;
		}
		if (opts.invite !== undefined) {
			db.insert(invites)
				.values({
					id: 'i1',
					codeHash: createHash('sha256').update('the-code').digest('hex'),
					createdBy: 'admin',
					expiresAt: Date.now() + 60_000,
					dance: 'salsa',
					locale: opts.invite
				})
				.run();
		}
		const url = new URL(`https://salsa.example${path}`);
		const locals = {} as App.Locals;
		const event = {
			url,
			request: new Request(url, {
				headers: opts.acceptLanguage ? { 'accept-language': opts.acceptLanguage } : {}
			}),
			cookies: {
				get: (name: string) =>
					name === SESSION_COOKIE ? session : name === LOCALE_COOKIE ? opts.cookie : undefined,
				set: () => {}
			},
			locals
		} as unknown as RequestEvent;
		const resolve = vi.fn(
			async (
				_e: RequestEvent,
				o?: { transformPageChunk?: (i: { html: string; done: boolean }) => unknown }
			) => {
				const html = await (o?.transformPageChunk?.({
					html: '<html lang="%salsa.lang%">',
					done: true
				}) ?? '<html lang="%salsa.lang%">');
				return new Response(`${html}|${locale()}`);
			}
		);
		const res = await handle({ event, resolve: resolve as never });
		const [html, during] = (await res.text()).split('|');
		return { html, during, locals: locals.locale };
	}

	// Catches: an invite's language not reaching the Join page drawn before any account.
	it("draws Join in its invite's language, with no cookie", async () => {
		expect(await draw('/join?code=the-code', { invite: 'sl' })).toEqual({
			html: '<html lang="sl">',
			during: 'sl',
			locals: 'sl'
		});
	});

	// Catches: English pages changing (`lang="en"` exactly as before).
	it('draws English by default', async () => {
		expect(await draw('/login')).toEqual({ html: '<html lang="en">', during: 'en', locals: 'en' });
		expect(await draw('/join?code=the-code', { invite: null })).toMatchObject({
			html: '<html lang="en">'
		});
	});

	// Catches: the cookie not read before sign-in.
	it("draws a signed-out page in the cookie's language", async () => {
		expect(await draw('/login', { cookie: 'sl' })).toMatchObject({ html: '<html lang="sl">' });
		expect(await draw('/login', { cookie: 'xx' })).toMatchObject({ html: '<html lang="en">' });
	});

	// Catches: the Android app's first login (no cookie in its own jar) drawn in English
	// on a Slovenian phone, and the header beating the cookie or a person's own language.
	it("falls back to the browser's Accept-Language, after the cookie", async () => {
		const sl = 'sl-SI,sl;q=0.9,en;q=0.8';
		expect(await draw('/login', { acceptLanguage: sl })).toEqual({
			html: '<html lang="sl">',
			during: 'sl',
			locals: 'sl'
		});
		expect(await draw('/login', { acceptLanguage: sl, cookie: 'en' })).toMatchObject({
			html: '<html lang="en">'
		});
		expect(await draw('/salsa', { acceptLanguage: sl, userLocale: null })).toMatchObject({
			html: '<html lang="en">'
		});
	});

	// Catches: an invite's code read on a page that is not Join.
	it('counts an invite only on Join', async () => {
		expect(await draw('/login?code=the-code', { invite: 'sl' })).toEqual({
			html: '<html lang="en">',
			during: 'en',
			locals: 'en'
		});
	});

	// Catches: the cookie overriding a signed-in person's own language.
	it("draws a signed-in person's pages in their own language, never the cookie's", async () => {
		expect(await draw('/salsa', { userLocale: 'sl', cookie: 'en' })).toEqual({
			html: '<html lang="sl">',
			during: 'sl',
			locals: 'sl'
		});
		expect(await draw('/salsa', { userLocale: null, cookie: 'sl' })).toEqual({
			html: '<html lang="en">',
			during: 'en',
			locals: 'en'
		});
	});

	// Catches: the worker's requests left without a language on locals.
	it("keeps the worker's requests in English", async () => {
		handleEnv.env.SALSA_WORKER_TOKEN = 't';
		try {
			const db = openDb(':memory:');
			handleDb.db = db;
			const url = new URL('https://salsa.example/api/worker/songs');
			const locals = {} as App.Locals;
			const event = {
				url,
				request: new Request(url, { headers: { authorization: 'Bearer t' } }),
				cookies: { get: (n: string) => (n === LOCALE_COOKIE ? 'sl' : undefined), set: () => {} },
				locals
			} as unknown as RequestEvent;
			await handle({ event, resolve: vi.fn(async () => new Response('ok')) });
			expect(locals.locale).toBe('en');
		} finally {
			delete handleEnv.env.SALSA_WORKER_TOKEN;
		}
	});
});

describe('the write gate at the hook (offline phase 3)', () => {
	it("lets a replay's own write through while the replay holds the gate alone", async () => {
		const { writeGate } = await import('$lib/server/sync/gate');
		const { runReplaying } = await import('$lib/server/replay-context');
		handleDb.db = openDb(':memory:');
		const url = new URL('https://salsa.example/login');
		const event = {
			url,
			request: new Request(url, { method: 'POST' }),
			cookies: { get: () => undefined, set: () => {} },
			locals: {}
		} as unknown as RequestEvent;
		const resolve = vi.fn(async () => new Response('ok'));
		const inner = await writeGate.exclusive(
			() =>
				runReplaying(
					{ entryId: 'e1', madeAt: 1, minted: new Map(), flows: [], deferFlows: true },
					() =>
						Promise.race([
							Promise.resolve(handle({ event, resolve })).then((r) => r.status),
							new Promise<string>((r) => setTimeout(() => r('waited on the gate'), 1000))
						])
				),
			100
		);
		expect(inner).toEqual({ ran: true, value: 200 });
	});
});

describe('the AI connector at the hook', () => {
	async function run(path: string, init: RequestInit, cookie?: string) {
		const db = openDb(':memory:');
		handleDb.db = db;
		db.insert(users)
			.values({
				id: 'u1',
				email: 'a@example.com',
				passwordHash: 'x',
				dance: 'salsa',
				firstName: 'Ana',
				level: 'all'
			})
			.run();
		const session = cookie ?? createSession('u1', db).id;
		const url = new URL(`https://salsa.example${path}`);
		const event = {
			url,
			request: new Request(url, init),
			cookies: { get: (n: string) => (n === SESSION_COOKIE ? session : undefined), set: () => {} },
			locals: {} as App.Locals
		} as unknown as RequestEvent;
		const resolve = vi.fn(async () => new Response('ok'));
		try {
			const res = await handle({ event, resolve });
			return {
				status: res.status,
				user: (event.locals as App.Locals).user,
				resolved: resolve.mock.calls.length
			};
		} catch (e) {
			return { status: (e as { status: number }).status, user: undefined, resolved: 0 };
		}
	}

	it('gives /mcp no session user, even under an encoded path with a session cookie', async () => {
		for (const path of ['/mcp', '/m%63p']) {
			const r = await run(path, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{}'
			});
			expect(r.resolved, path).toBe(1);
			expect(r.user, path).toBeNull();
		}
	});
	it('lets the token request through with no Origin, and only it', async () => {
		const form = { 'content-type': 'application/x-www-form-urlencoded' };
		expect(
			(await run('/oauth/token', { method: 'POST', headers: form, body: 'a=b' })).resolved
		).toBe(1);
		expect(
			(await run('/oauth/%74oken', { method: 'POST', headers: form, body: 'a=b' })).resolved
		).toBe(1);
		expect(
			(await run('/oauth/authorize', { method: 'POST', headers: form, body: 'a=b' })).status
		).toBe(403);
	});
	it('refuses a form posted from another site, as kit did', async () => {
		const r = await run('/salsa/figures', {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				origin: 'https://evil.example'
			},
			body: 'a=b'
		});
		expect(r.status).toBe(403);
		const same = await run('/salsa/figures', {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				origin: 'https://salsa.example'
			},
			body: 'a=b'
		});
		expect(same.resolved).toBe(1);
	});
});

describe('encoded paths at the hook', () => {
	it('an encoded /api/worker/ path still needs the worker token', async () => {
		const db = openDb(':memory:');
		handleDb.db = db;
		db.insert(users)
			.values({
				id: 'u1',
				email: 'a@example.com',
				passwordHash: 'x',
				dance: 'salsa',
				firstName: 'Ana',
				level: 'all'
			})
			.run();
		const session = createSession('u1', db).id;
		const url = new URL('https://salsa.example/api/%77orker/claim');
		const event = {
			url,
			request: new Request(url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{}'
			}),
			cookies: { get: (n: string) => (n === SESSION_COOKIE ? session : undefined), set: () => {} },
			locals: {} as App.Locals
		} as unknown as RequestEvent;
		const resolve = vi.fn(async () => new Response('ok'));
		const res = await handle({ event, resolve });
		expect(res.status).toBe(401);
		expect(resolve).not.toHaveBeenCalled();
	});
});

/*
 * The Android app's service worker has no user agent of its own to set
 * (ServiceWorkerWebSettings has none), so a request it sends on for the page
 * reaches the server as a plain WebView. The page says which app it is in
 * `x-salsa-app` (app.html's fetch wrapper), and the hook reads that too.
 */
describe('the app behind the service worker', () => {
	const PLAIN_WEBVIEW =
		'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';

	async function agentOf(headers: Record<string, string>) {
		handleDb.db = openDb(':memory:');
		const url = new URL('https://salsa.example/health');
		const event = {
			url,
			request: new Request(url, { headers }),
			cookies: { get: () => undefined, set: () => {} },
			locals: {}
		} as unknown as RequestEvent;
		await handle({ event, resolve: vi.fn(async () => new Response('ok')) });
		return (event.locals as App.Locals).appAgent;
	}

	it('knows the app from the page’s header when the user agent lacks it', async () => {
		expect(
			await agentOf({ 'user-agent': PLAIN_WEBVIEW, 'x-salsa-app': 'SalsaApp/11 (salsa; direct)' })
		).toEqual({ versionCode: 11, dance: 'salsa', channel: 'direct' });
	});

	it('takes the user agent first, and no app without either', async () => {
		expect(
			await agentOf({ 'user-agent': OLD_WEBVIEW_UA, 'x-salsa-app': 'SalsaApp/11 (salsa; direct)' })
		).toMatchObject({ versionCode: 2 });
		expect(await agentOf({ 'user-agent': PLAIN_WEBVIEW })).toBeNull();
		expect(await agentOf({ 'user-agent': PLAIN_WEBVIEW, 'x-salsa-app': 'junk' })).toBeNull();
	});

	it('never refuses on the page’s header: the 426 is the native API’s', async () => {
		expect(
			await status('/api/device/today', { 'x-salsa-app': 'SalsaApp/2 (salsa; direct)' })
		).not.toBe(426);
	});
});
