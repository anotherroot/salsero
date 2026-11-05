import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every route id the library names is one SvelteKit has. A route id carries its
 * route groups (`/[dance]/(moves)/figures`) though the URL does not, so a move
 * into a group leaves every `'/[dance]/figures'` comparing against nothing,
 * silently: no type checks a string in a Set or a Record key.
 */
const IDS = new Set(
	globSync('src/routes/**/+{page.svelte,server.ts}').map(
		(file) =>
			'/' +
			file
				.replace(/^src\/routes\//, '')
				.replace(/\/?\+(page\.svelte|server\.ts)$/, '')
				.replace(/\/$/, '')
	)
);

const LITERAL = /(['"])(\/\[dance\][^'"]*)\1/g;

describe('route ids', () => {
	it('finds the routes', () => {
		expect(IDS).toContain('/[dance]');
		expect(IDS).toContain('/[dance]/songs/[id]');
	});

	it('names only route ids that exist (or a prefix of one, ending in /)', () => {
		const ids = [...IDS];
		let seen = 0;
		for (const file of globSync('src/lib/**/*.ts')) {
			if (file.endsWith('.spec.ts')) continue;
			for (const [, , id] of readFileSync(file, 'utf8').matchAll(LITERAL)) {
				seen++;
				const ok = id.endsWith('/') ? ids.some((r) => r.startsWith(id)) : IDS.has(id);
				expect(ok, `${file}: '${id}'`).toBe(true);
			}
		}
		expect(seen).toBeGreaterThan(20);
	});
});
