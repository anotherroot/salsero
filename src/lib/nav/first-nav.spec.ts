/*
 * The first navigation of a client-only page (the offline shell, `ssr = false`)
 * has a `from` whose `url` is null (offline spike). A navigation hook that reads
 * `from.url.pathname` throws there, and the throw stops SvelteKit's router from
 * starting: every tap becomes a full page load, a black screen offline. Every
 * read of `from.url` goes on with `?.`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stripComments } from '$lib/server/server-sources';

/** `from.url.` or `from?.url.` (so `nav.from.url.` too): `from.url` read on without `?.`. */
const FROM_URL_READ = /\bfrom\??\.url\./;

function clientSources(): { path: string; code: string }[] {
	return readdirSync('src', { recursive: true, withFileTypes: true })
		.filter((d) => d.isFile())
		.map((d) => join(d.parentPath, d.name))
		.filter((p) => /\.(svelte|ts)$/.test(p) && !/\.spec\.ts$/.test(p))
		.sort()
		.map((path) => ({ path, code: stripComments(readFileSync(path, 'utf8')) }));
}

describe('the first, client-only navigation', () => {
	it('the pattern catches the reads that throw, and not the safe ones', () => {
		expect(FROM_URL_READ.test('from.url.pathname')).toBe(true);
		expect(FROM_URL_READ.test('nav.from?.url.pathname')).toBe(true);
		expect(FROM_URL_READ.test('nav.from.url.search')).toBe(true);
		expect(FROM_URL_READ.test('from.url?.pathname')).toBe(false);
		expect(FROM_URL_READ.test('nav.from?.url?.pathname')).toBe(false);
	});

	it('no code reads from.url without ?.', () => {
		const hits: string[] = [];
		for (const { path, code } of clientSources()) {
			code.split('\n').forEach((line, i) => {
				if (FROM_URL_READ.test(line)) hits.push(`${path}:${i + 1}`);
			});
		}
		expect(hits).toEqual([]);
	});
});
