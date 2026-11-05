import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The lesson in its pane (desktop spec, "Two columns"): what the browser shows is
 * checked by screenshots; this pins the page's structure the layout rests on.
 */
const page = readFileSync('src/routes/[dance]/lessons/[id]/+page.svelte', 'utf8');
const snippet = (name: string) => {
	const start = page.indexOf(`{#snippet ${name}()}`);
	expect(start).toBeGreaterThan(-1);
	return page.slice(start, page.indexOf('{/snippet}', start));
};

describe('the lesson page in its pane', () => {
	it('is two columns, or one 640 column while editing, with Save as wide', () => {
		expect(page).toContain("width={editing ? 'song' : 'two'}");
		expect(page).toMatch(/<BottomBar mode width="song">/);
	});

	it('keeps SourceTabs (its toast is fixed) above PaneColumns, never inside it', () => {
		const tabs = page.indexOf('<SourceTabs');
		expect(tabs).toBeGreaterThan(-1);
		expect(tabs).toBeLessThan(page.indexOf('<PaneColumns'));
		for (const name of ['colsTop', 'about', 'watched', 'linked'])
			expect(snippet(name)).not.toContain('<SourceTabs');
	});

	it('puts everything in the top row while editing', () => {
		expect(snippet('colsTop')).toContain('id="edit-form"');
		for (const name of ['about', 'watched'])
			expect(snippet(name)).toMatch(/^[^<]*\{#if !editing\}/);
		expect(page).toContain('leftEnd={editing ? undefined : linked}');
	});

	it('opens the lesson menu as the small dialog, and no other sheet', () => {
		expect(page).toMatch(/<Sheet title=\{lesson\.title\} size="small"/);
		expect(page.match(/size="small"/g)).toHaveLength(1);
	});

	it("draws the strips' action with STRIP_ACTION", () => {
		for (const name of ['draftBand', 'addBand']) {
			expect(snippet(name)).toContain('class={STRIP_ACTION}');
			expect(snippet(name)).not.toContain("button('secondary'");
		}
	});
});
