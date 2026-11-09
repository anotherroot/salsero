import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
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
