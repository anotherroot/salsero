import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync('src/routes/[dance]/groups/+layout.svelte', 'utf8');
const list = readFileSync('src/lib/components/teams/GroupList.svelte', 'utf8');
const classes = readFileSync('src/lib/components/teams/ClassList.svelte', 'utf8');

// The list lives in a layout, so on a group's route a bare `?/create` would post to the group.
describe('the Groups layout', () => {
	it('posts New group to the list route by name', () => {
		expect(layout).toContain('groups?/create');
		expect(layout).not.toContain('action="?/');
	});

	it('has no form posting to a bare action, and never reads page.form', () => {
		for (const src of [layout, list, classes]) {
			expect(src).not.toMatch(/<form[^>]*action=["'{`]*\?\//);
			expect(src).not.toContain('page.form');
			expect(src).not.toContain('form?.');
		}
	});
});

// ListPane draws `empty` on the list route, never `children`: the list page (only its <title>)
// mounts inside the empty pane, or the tab has no title and Back reads "Back to ".
describe('the Groups list page', () => {
	it('renders inside the empty pane', () => {
		expect(layout).toMatch(
			/\{#snippet pick\(\)\}((?!\{\/snippet\})[\s\S])*\{@render children\(\)\}/
		);
	});
});
