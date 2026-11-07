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

import { createSession } from '$lib/server/auth';
import { openDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
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
