import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * The Moves lists live in the (moves) layout, so they are on the page beside an
 * open figure, routine or position too. A bare `?/create` would post to that
 * page's own actions; every form in a list names its list route's action. And a
 * refusal is read from the submit's result: beside an item SvelteKit applies no
 * `form` to the list. Read as text, as class-rules.spec.ts reads components.
 */
const LISTS = ['FiguresList', 'RoutinesList', 'PositionsList'].map(
	(n) => `src/lib/components/moves/${n}.svelte`
);
const TEMPLATES = 'src/lib/components/positions/TemplatesSheet.svelte';

describe('Moves list forms', () => {
	for (const file of LISTS) {
		const src = readFileSync(file, 'utf8');
		it(`${file}: posts to its list route, by name`, () => {
			const actions = [...src.matchAll(/\baction=("[^"]*"|\{[^}]*\})/g)].map((m) => m[1]);
			expect(actions.length, file).toBeGreaterThanOrEqual(1);
			for (const a of actions) expect(a, a).toMatch(/^\{`\/\$\{/);
			expect(src).not.toMatch(/action="\?\//);
		});
		it(`${file}: reads no form prop`, () => {
			expect(src).not.toMatch(/\bform\?\./);
			expect(src).not.toMatch(/\bpage\.form\b/);
		});
	}

	it('names each list route and action', () => {
		const [figures, routines, positions] = LISTS.map((f) => readFileSync(f, 'utf8'));
		expect(figures).toContain('action={`/${dance.slug}/figures?/create`}');
		expect(routines).toContain('action={`/${dance.slug}/routines?/create`}');
		expect(positions).toContain('action={`/${dance}/positions?/create`}');
		expect(positions).toContain('action={`/${dance}/positions?/templates`}');
	});

	it('TemplatesSheet posts where it is told, ?/templates by default', () => {
		const src = readFileSync(TEMPLATES, 'utf8');
		expect(src).not.toMatch(/action="\?\//);
		expect(src).toMatch(/action = '\?\/templates'/);
		expect(src).toMatch(/\{action\}/);
	});
});
