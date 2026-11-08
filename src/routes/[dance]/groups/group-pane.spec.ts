import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * A group in its pane (desktop spec, "Two columns"; "Popups are dialogs"): what the
 * browser shows is checked by screenshots; this pins the structure it rests on.
 */
const read = (path: string) => readFileSync(path, 'utf8');
const page = read('src/routes/[dance]/groups/[id]/+page.svelte');
const columns = read('src/lib/components/ui/PaneColumns.svelte');
const snippet = (name: string) => {
	const start = page.indexOf(`{#snippet ${name}()}`);
	expect(start).toBeGreaterThan(-1);
	return page.slice(start, page.indexOf('{/snippet}\n\n', start));
};

describe('the group page in its pane', () => {
	it('is two columns, 7 : 5: the space heading the right column over Class songs', () => {
		expect(page).toMatch(/<Screen[^>]*\bwidth="two"/);
		expect(page).toMatch(
			/<PaneColumns\s+ratio="7:5"\s+class="gap-2"\s+lead=\{data\.storage \|\| data\.autoAdd \? space : undefined\}\s+left=\{lessons\}\s+right=\{songs\}\s*\/>/
		);
		expect(snippet('space')).toContain('/[dance]/groups/[id]/storage');
		// The member's own auto-add switch sits in the group's space too.
		expect(snippet('space')).toContain('label={w.autoAdd}');
		expect(snippet('lessons')).toContain('aria-label={w.lessons}');
		expect(snippet('songs')).toContain('aria-label={t().entry.classes.songs}');
	});

	it('keeps a deleted group one column', () => {
		const start = page.indexOf('{#if deleted}\n\t\t<form');
		expect(start).toBeGreaterThan(-1);
		const branch = page.slice(start, page.indexOf('{:else}', start));
		expect(branch).toContain('action="?/restore"');
		expect(branch).not.toContain('<PaneColumns');
	});

	it('opens the group menu and Rename as small dialogs, and New lesson, Add, Leave and Delete as before', () => {
		expect(page).toMatch(/<Sheet title=\{data\.team\.name\} open=\{menu\}[^\n]*size="small">/);
		expect(page).toMatch(/<Sheet title=\{w\.renameGroup\}[^\n]*size="small">/);
		expect(page.match(/size="small"/g)).toHaveLength(2);
		for (const tag of ['<NewLessonSheet', '<AddSheet', '<LeaveSheet', '<Dialog']) {
			const start = page.indexOf(tag);
			expect(start).toBeGreaterThan(-1);
			// The tag runs to its `/>` or its closing `>` on a line of its own (`=>` is inside it).
			const end = page.slice(start).search(/\/>|\n>/);
			expect(end).toBeGreaterThan(0);
			expect(page.slice(start, start + end)).not.toContain('size=');
		}
	});

	it("opens a person's actions, Ask for more and the code as small dialogs", () => {
		expect(read('src/routes/[dance]/groups/[id]/people/+page.svelte')).toMatch(
			/<Sheet\s+title=\{acting\?\.name \?\? ''\}\s+open=\{acting !== null\}\s+onclose=\{\(\) => \(acting = null\)\}\s+size="small"\s*>/
		);
		expect(read('src/routes/[dance]/groups/[id]/storage/+page.svelte')).toMatch(
			/<Sheet title="Ask for more"[^\n]*size="small">/
		);
		const code = read('src/lib/components/teams/CodeSheet.svelte');
		expect(code).toMatch(/<Sheet title="Group code"[^\n]*size="small">/);
		expect(code).toContain('codeAction(desk.current, canShare, copied)');
	});
});

describe('leaving the open group', () => {
	it('reloads the Groups list (the layout’s), so the group leaves the column at once', () => {
		const leave = read('src/lib/components/teams/LeaveSheet.svelte');
		expect(leave).toContain('await gotoWhenSettled(to, { invalidateAll: true });');
		expect(leave).not.toMatch(/gotoWhenSettled\(to\)/);
	});
});

describe('PaneColumns with a lead', () => {
	it('renders it after top and before left', () => {
		const at = (s: string) => columns.indexOf(s);
		expect(at('{@render top()}')).toBeLessThan(at('{@render lead()}'));
		expect(at('{@render lead()}')).toBeLessThan(at('{@render left()}'));
		expect(at('{@render left()}')).toBeLessThan(at('{@render right()}'));
	});

	it('heads column 2 with it, right under it, left spanning both', () => {
		expect(columns).toContain("'7:5': 'two:grid-cols-[7fr_5fr]'");
		expect(columns).toContain('<div class="{CELL} two:col-start-2 {ROWS.lead}">');
		const noTop = columns.slice(columns.indexOf(': {', columns.indexOf('if (lead)')));
		expect(noTop).toMatch(
			/lead: 'two:row-start-1',\s+left: 'two:row-span-2 two:row-start-1',\s+right: 'two:row-start-2'/
		);
		expect(columns).toMatch(
			/lead: 'two:row-start-2',\s+left: 'two:row-span-2 two:row-start-2',\s+right: 'two:row-start-3'/
		);
	});
});

// Catches: a class member at Follow my class sent to the song page (an editor's
// tools, part 2's words) instead of Practice, or the song staying "New" after it.
describe("My class's songs", () => {
	it('open Practice with the song, and count as opened', () => {
		const my = read('src/lib/components/teams/MyClass.svelte');
		expect(my).toContain('href={practiseHref(dance, { lesson: true }, s.id)}');
		expect(my).toContain("onopen={() => reportOpen('song', s.id)}");
		expect(my).not.toContain("'/[dance]/songs/[id]'");
	});
});
