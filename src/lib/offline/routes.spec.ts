import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => undefined };
});
import {
	ACTIONS,
	ENDPOINT_WRITES,
	writeClass,
	DEVICE_ENDPOINTS,
	NETWORK_ENDPOINTS,
	NETWORK_PAGES,
	deviceAnswers,
	routePattern
} from './routes';

// A directory walk, not import.meta.glob: the glob skips dot folders (.well-known).
function serverFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = `${dir}/${e.name}`;
		return e.isDirectory() ? serverFiles(p) : e.name === '+server.ts' ? [p] : [];
	});
}
const sources = Object.fromEntries(
	serverFiles('src/routes').map((f) => ['/' + f, readFileSync(f, 'utf8')])
);

const u = (p: string) => new URL(p, 'https://x.test');

describe('endpoint lists', () => {
	it('lists every GET endpoint as device or network, exactly once', () => {
		const ids = Object.entries(sources)
			.filter(([, src]) => /export (const|async function|function) GET\b/.test(src))
			.map(([file]) => file.replace(/^\/src\/routes/, '').replace(/\/\+server\.ts$/, ''))
			.sort();
		const listed = [...DEVICE_ENDPOINTS, ...NETWORK_ENDPOINTS];
		expect(new Set(listed).size).toBe(listed.length);
		expect([...listed].sort()).toEqual(ids);
	});

	it('names only routes that exist', () => {
		for (const id of NETWORK_PAGES) {
			const dir = 'src/routes' + id;
			const has = ['+page.svelte', '+page.server.ts', '+page.ts'].some((f) =>
				existsSync(`${dir}/${f}`)
			);
			expect(has, id).toBe(true);
		}
	});
});

describe('routePattern', () => {
	it('matches a route id with its groups and params', () => {
		const re = routePattern('/[dance]/(today)/exercises/[id]/practice');
		expect(re.test('/salsa/exercises/7/practice')).toBe(true);
		expect(re.test('/salsa/exercises/7/8/practice')).toBe(false);
		expect(re.test('/salsa/exercises/7/practice/x')).toBe(false);
	});
	it('escapes dots', () => {
		expect(routePattern('/.well-known/assetlinks.json').test('/.well-known/assetlinksxjson')).toBe(
			false
		);
	});
});

describe('deviceAnswers', () => {
	it('answers page data', () => {
		expect(deviceAnswers('GET', u('/salsa/figures/__data.json'))).toBe(true);
		expect(deviceAnswers('GET', u('/__data.json'))).toBe(true);
		expect(
			deviceAnswers('GET', u('/salsa/exercises/3/__data.json?x-sveltekit-invalidated=01'))
		).toBe(true);
	});
	it('does not answer a network page', () => {
		expect(deviceAnswers('GET', u('/salsa/groups/3/history/lesson/4/__data.json'))).toBe(false);
		expect(deviceAnswers('GET', u('/salsa/groups/3/people/__data.json'))).toBe(false);
		expect(deviceAnswers('GET', u('/admin/__data.json'))).toBe(false);
		expect(deviceAnswers('GET', u('/g/abc/__data.json'))).toBe(false);
	});
	it('does not answer a write', () => {
		expect(deviceAnswers('POST', u('/salsa/figures?/create'))).toBe(false);
		expect(deviceAnswers('POST', u('/salsa/figures/__data.json'))).toBe(false);
		expect(deviceAnswers('PUT', u('/api/video-spots'))).toBe(false);
	});
	it('answers a device endpoint and not a network one', () => {
		expect(deviceAnswers('GET', u('/api/video-spots?x=1'))).toBe(true);
		expect(deviceAnswers('GET', u('/api/video-spots/5/links'))).toBe(true);
		expect(deviceAnswers('GET', u('/api/lessons/5/comments'))).toBe(true);
		expect(deviceAnswers('GET', u('/salsa/songs/5/grid'))).toBe(true);
		expect(deviceAnswers('GET', u('/recordings/x.mp4'))).toBe(false);
		expect(deviceAnswers('GET', u('/api/device/today'))).toBe(false);
		expect(deviceAnswers('GET', u('/health'))).toBe(false);
		expect(deviceAnswers('GET', u('/salsa/figures'))).toBe(false);
	});
});

const pageModules = import.meta.glob('/src/routes/**/+page.server.ts');
const routeIdOf = (file: string) =>
	file.replace(/^\/src\/routes/, '').replace(/\/\+(page\.server|server)\.ts$/, '') || '/';

describe('every write classified', () => {
	it('classifies every action of every page, exactly once', async () => {
		const found: Record<string, string[]> = {};
		for (const [file, load] of Object.entries(pageModules)) {
			const mod = (await load()) as { actions?: Record<string, unknown> };
			if (mod.actions) found[routeIdOf(file)] = Object.keys(mod.actions).sort();
		}
		const listed = Object.fromEntries(
			Object.entries(ACTIONS).map(([id, acts]) => [id, Object.keys(acts).sort()])
		);
		expect(listed).toEqual(found);
	});

	it('classifies every write method of every endpoint', () => {
		const found: Record<string, string[]> = {};
		for (const [file, src] of Object.entries(sources)) {
			const methods = [
				...src.matchAll(/export (?:const|async function|function) (POST|PUT|PATCH|DELETE)\b/g)
			].map((m) => m[1]);
			if (methods.length) found[routeIdOf(file)] = methods.sort();
		}
		const listed = Object.fromEntries(
			Object.entries(ENDPOINT_WRITES).map(([id, m]) => [id, Object.keys(m).sort()])
		);
		expect(listed).toEqual(found);
	});

	it('blocks offline what the spec names', () => {
		for (const path of [
			'/salsa/groups?/joinCode',
			'/g/abc?/join',
			'/welcome/start?/join',
			'/salsa/lessons/1?/copyTo',
			'/salsa/lessons/1?/makeMine',
			'/salsa/lessons/1?/sync',
			'/salsa/figures/1?/drop',
			'/salsa/figures/1?/detach',
			'/salsa/lessons/1?/moveTo',
			'/salsa/figures/1?/takeRecording',
			'/admin?/invite',
			'/device/pair',
			'/salsa/groups/1?/leave',
			'/salsa/groups/1?/delete',
			'/salsa/groups/1?/remakeCode',
			'/settings?/ask',
			'/settings?/theme'
		]) {
			expect(writeClass('POST', u(path)), path).toBe('network');
		}
	});

	it('queues what the spec names', () => {
		for (const path of [
			'/salsa/songs?/addUrl',
			'/salsa/lessons/1?/saveVideo',
			'/salsa/lessons/1?/publish'
		]) {
			expect(writeClass('POST', u(path)), path).toBe('queued');
		}
		expect(writeClass('POST', u('/api/lessons/1/comments'))).toBe('queued');
		expect(writeClass('POST', u('/api/comments/1/heart'))).toBe('queued');
		expect(writeClass('DELETE', u('/api/comments/1'))).toBe('queued');
	});

	it('reads a path to the most specific route', () => {
		expect(writeClass('POST', u('/salsa?/done'))).toBe('device');
		expect(writeClass('POST', u('/settings?/name'))).toBe('device');
		expect(writeClass('POST', u('/voice?/delete'))).toBe('network');
		expect(writeClass('POST', u('/salsa/exercises/7?/done'))).toBe('device');
		expect(writeClass('GET', u('/salsa'))).toBeNull();
		expect(writeClass('POST', u('/nowhere/at/all'))).toBeNull();
	});

	it('passes the sync endpoints and the uploads', () => {
		expect(writeClass('POST', u('/api/sync/pull'))).toBe('pass');
		expect(writeClass('POST', u('/api/sync/push'))).toBe('pass');
		expect(writeClass('POST', u('/api/figures/3/recordings'))).toBe('pass');
		expect(writeClass('POST', u('/api/songs'))).toBe('pass');
		expect(writeClass('PUT', u('/api/lessons/3/videos/abc'))).toBe('pass');
	});
});
