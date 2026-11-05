/**
 * A list layout puts the list route's page in the pane (`empty={children}`), so
 * the page mounts and its `<svelte:head><title>` is the document's. The phone
 * never sees the pane, but the trail takes its Back labels ("Back to Music")
 * from `document.title`: a layout that drew some other `empty` would leave the
 * list pages without a title and the label would read "Back to ". Browser
 * check: scripts/shots scene run at 390 and 1440 (see the desktop-2 report).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

const LISTS = [
	['Music', './songs/+layout.svelte', './songs/+page.svelte'],
	['Figures', './(moves)/+layout.svelte', './(moves)/figures/+page.svelte'],
	['Routines', './(moves)/+layout.svelte', './(moves)/routines/+page.svelte'],
	['Positions', './(moves)/+layout.svelte', './(moves)/positions/+page.svelte']
] as const;

describe('list routes keep their document title', () => {
	for (const [name, layout, page] of LISTS) {
		it(`${name}: the layout mounts the list page and the page sets the title`, () => {
			expect(read(layout)).toMatch(/<ListPane[^>]*\bempty=\{children\}/s);
			expect(read(page)).toMatch(
				new RegExp(`<svelte:head><title>${name} · \\{data\\.dance\\.label\\}</title></svelte:head>`)
			);
		});
	}
});
