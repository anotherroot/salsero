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

	it('shows in the top row only what hasTop counts', () => {
		const start = page.indexOf('{#snippet colsTop()}');
		const block = page.slice(start, page.indexOf('{#snippet about()}', start));
		const conditions = [...block.matchAll(/\{#if ([^}]+)\}/g)].map((m) => m[1]);
		// The edit form's own banners show only while editing (hasTop is true then); the
		// notice's Make it mine sits inside the notice.
		const inside = ['editing', 'archiveError', 'refusal && !refusal.field', 'data.makeMine'];
		const rest = conditions.filter((c) => !inside.includes(c));
		expect(rest).toEqual(['top.publish', 'top.notice', 'top.edited', 'top.offer']);
		expect(page).toContain('const hasTop = $derived(editing || Object.values(top).some(Boolean));');
	});

	it('opens the lesson menu as the small dialog, and no other sheet', () => {
		expect(page).toMatch(/<Sheet title=\{lesson\.title\} size="small"/);
		expect(page.match(/size="small"/g)).toHaveLength(1);
	});

	it("draws the strips' action with its builder: Add's STRIP_ACTION, Publish's PUBLISH_ACTION", () => {
		expect(snippet('addBand')).toContain('class={STRIP_ACTION}');
		expect(snippet('draftBand')).toContain('class={PUBLISH_ACTION}');
		for (const name of ['draftBand', 'addBand'])
			expect(snippet(name)).not.toContain("button('secondary'");
	});
});
