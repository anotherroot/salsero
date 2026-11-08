/**
 * A list layout puts the list route's page in the pane (`empty={children}`, or
 * an `empty` snippet that renders `children()` first, as Lessons and Groups do
 * beside their pick-one state), so the page mounts and its
 * `<svelte:head><title>` is the document's. The phone never sees the pane, but
 * the trail takes its Back labels ("Back to Music") from `document.title`: a
 * layout that drew some other `empty` would leave the list pages without a
 * title and the label would read "Back to ". Browser check: scripts/shots scene
 * run at 390 and 1440 (see the desktop-2 report).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

/** `empty={children}` itself. */
const DIRECT = /<ListPane[^>]*\bempty=\{children\}/s;
/** `empty={pick}`, a snippet whose first line renders the list page. */
const PICK =
	/\{#snippet pick\(\)\}\s*(?:<!--.*?-->\s*)?\{@render children\(\)\}.*<ListPane[^>]*\bempty=\{pick\}/s;

const LISTS = [
	['Music', './songs/+layout.svelte', './songs/+page.svelte', DIRECT],
	['Figures', './(moves)/+layout.svelte', './(moves)/figures/+page.svelte', DIRECT],
	['Routines', './(moves)/+layout.svelte', './(moves)/routines/+page.svelte', DIRECT],
	['Positions', './(moves)/+layout.svelte', './(moves)/positions/+page.svelte', DIRECT],
	['Lessons', './lessons/+layout.svelte', './lessons/+page.svelte', PICK],
	['Groups', './groups/+layout.svelte', './groups/+page.svelte', PICK]
] as const;

describe('list routes keep their document title', () => {
	for (const [name, layout, page, mounts] of LISTS) {
		it(`${name}: the layout mounts the list page and the page sets the title`, () => {
			expect(read(layout)).toMatch(mounts);
			expect(read(page)).toMatch(
				new RegExp(
					`<svelte:head><title>(?:${name}|\\{title\\}) · \\{data\\.dance\\.label\\}</title></svelte:head>`
				)
			);
		});
	}

	// At Follow my class the Groups tab is My class, and so is its title; above it
	// the phone's tab is You and the desktop's Groups, and so is the title.
	it('Groups: the title is My class at Follow my class, else You or Groups', () => {
		expect(read('./groups/+page.svelte')).toContain(
			"const title = $derived(data.myClass ? MY_CLASS.title : desk.current ? 'Groups' : 'You');"
		);
	});
});
