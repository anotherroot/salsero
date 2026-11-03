import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ release: null as unknown, dir: '' }));

vi.mock('$lib/server/releases', async () => {
	const actual =
		await vi.importActual<typeof import('$lib/server/releases')>('$lib/server/releases');
	return { ...actual, currentRelease: () => h.release };
});
vi.mock('$lib/server/files', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/files')>('$lib/server/files');
	return { ...actual, releasesDir: () => h.dir };
});

import { isPublicPath } from '$lib/server/public-paths';
import { GET as check } from './[dance]/+server';
import { GET as apk } from '../../releases/[dance]/[file]/+server';

const R = {
	versionCode: 2,
	versionName: '1.1',
	minVersionCode: 1,
	sha256: 'ab',
	size: 3,
	commit: 'c'
};

async function status(p: () => Promise<Response> | Response) {
	try {
		return await p();
	} catch (e) {
		return new Response(null, { status: (e as { status: number }).status });
	}
}

h.dir = mkdtempSync(join(tmpdir(), 'app-update-'));
mkdirSync(join(h.dir, 'salsa'));
writeFileSync(join(h.dir, 'salsa', '2.apk'), 'apk');
afterAll(() => rmSync(h.dir, { recursive: true, force: true }));
beforeEach(() => (h.release = null));

const callCheck = (dance: string) =>
	status(() => (check as (e: unknown) => Response)({ params: { dance } }));
const callApk = (dance: string, file: string) =>
	status(() =>
		(apk as (e: unknown) => Promise<Response>)({
			params: { dance, file },
			request: new Request('http://x/')
		})
	);

describe('GET /api/app-update/[dance]', () => {
	it('answers with the release and its url', async () => {
		h.release = R;
		const res = await callCheck('salsa');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ...R, url: '/releases/salsa/2.apk' });
	});
	it('is 404 without a release', async () => expect((await callCheck('salsa')).status).toBe(404));
	it('is 404 for an unknown dance', async () => {
		h.release = R;
		expect((await callCheck('tango')).status).toBe(404);
	});
});

describe('GET /releases/[dance]/[file]', () => {
	it('serves the apk, cached for a year', async () => {
		const res = await callApk('salsa', '2.apk');
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('application/vnd.android.package-archive');
		expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
		await res.body?.cancel();
	});
	it('is 404 when the apk is not on disk', async () =>
		expect((await callApk('salsa', '3.apk')).status).toBe(404));
	it('is 404 for a traversal name', async () =>
		expect((await callApk('salsa', '../x.apk')).status).toBe(404));
	it('is 404 for an unknown dance', async () =>
		expect((await callApk('tango', '2.apk')).status).toBe(404));
});

describe('isPublicPath', () => {
	it.each(['/api/app-update/salsa', '/releases/bachata/12.apk', '/login', '/join'])(
		'%s is public',
		(p) => expect(isPublicPath(p)).toBe(true)
	);
	it.each([
		'/api/app-update/salsa/x',
		'/api/app-update/tango',
		'/releases/salsa/12.apk.part',
		'/releases/salsa/current.json',
		'/salsa'
	])('%s is private', (p) => expect(isPublicPath(p)).toBe(false));
});
