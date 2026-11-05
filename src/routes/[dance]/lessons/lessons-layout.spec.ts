import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync('src/routes/[dance]/lessons/+layout.svelte', 'utf8');
const list = readFileSync('src/lib/components/lessons/LessonList.svelte', 'utf8');

// The list lives in a layout, so on an item route a bare `?/create` would post to the item.
describe('the Lessons layout', () => {
	it('posts New lesson to the list route by name', () => {
		expect(layout).toContain('lessons?/create');
		expect(layout).not.toContain('action="?/');
	});

	it('has no form posting to a bare action, and never reads page.form', () => {
		for (const src of [layout, list]) {
			expect(src).not.toMatch(/<form[^>]*action=["'{`]*\?\//);
			expect(src).not.toContain('page.form');
			expect(src).not.toContain('form?.');
		}
	});
});
