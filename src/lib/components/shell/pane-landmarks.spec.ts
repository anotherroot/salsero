import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * The pane's Back gate and the page's landmarks (desktop plan 3, Task 5). Neither
 * is in vitest's reach as markup, so these read the sources for what decides them;
 * the screenshot rig checks what they draw.
 */
const read = (f: string) => readFileSync(f, 'utf8');
const back = read('src/lib/components/shell/BackButton.svelte');
const screen = read('src/lib/components/ui/Screen.svelte');
const band = read('src/lib/components/shell/BandHeader.svelte');
const pane = read('src/lib/components/shell/Pane.svelte');
const listPane = read('src/lib/components/shell/ListPane.svelte');
/** The script and markup, comments left out. */
const code = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the pane’s Back gate', () => {
	it('is BackButton’s: paneBack by the list opener, hidden on the desk only', () => {
		expect(back).toContain('paneBack(');
		expect(back).toContain('listOpener(');
		expect(back).toContain('listOf(page.route.id)');
		// CSS only: inPane() is true at every width, so the phone keeps its ‹.
		expect(back).toMatch(/hidden \? 'contents desk:hidden' : 'contents'/);
	});

	it('is no longer Screen’s or BandHeader’s, so a × in `left` shows', () => {
		for (const s of [code(screen), code(band)]) {
			expect(s).not.toContain('paneBack');
			expect(s).not.toMatch(/\{back\}|\bback\s*[?]?:|\bback\s*=|\$\{back/);
		}
	});
});

describe('landmarks', () => {
	it('makes Screen’s sheet the main only outside a pane and an item’s list', () => {
		expect(screen).toContain("const main = $derived(!pane && split !== 'item');");
		expect(screen).toMatch(/<svelte:element\s+this=\{main \? 'main' : 'div'\}/);
	});

	it('makes the pane the main on an item route, so its header is no second banner', () => {
		expect(listPane).toMatch(/<Pane[\s\S]*?main=\{!isList\}/);
		expect(pane).toMatch(/<svelte:element\s+this=\{main \? 'main' : 'div'\}/);
	});

	it('has one h1: a list’s band row beside an open item is not one', () => {
		expect(band).toContain("this={deskOnly ? 'p' : 'h1'}");
		expect(code(band)).not.toContain('<h1');
	});

	it('gives the pane’s `below` row to the pane only, never the phone', () => {
		expect(band).toMatch(
			/\{#if below && variant === 'pane'\}\s*<div class="hidden desk:block desk:basis-full"/
		);
		expect(screen).toMatch(/\{below\}/);
	});
});
