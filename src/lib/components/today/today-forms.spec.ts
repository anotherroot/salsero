import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Today's list lives in the (today) layout, so it is on the page beside an open
 * exercise too. A bare `?/createExercise` would post to that exercise's own
 * actions; every form the layout renders names Today's route. Read as text, as
 * class-rules.spec.ts reads components.
 */
const SHEET = 'src/lib/components/today/NewExerciseSheet.svelte';
const FILES = [
	SHEET,
	'src/lib/components/today/TodayList.svelte',
	'src/routes/[dance]/(today)/+layout.svelte'
];

describe("Today's list forms", () => {
	it('New exercise posts to Today, by name', () => {
		expect(readFileSync(SHEET, 'utf8')).toContain('action="/{dance}?/createExercise"');
	});

	for (const file of FILES)
		it(`${file}: no bare action`, () => {
			expect(readFileSync(file, 'utf8')).not.toMatch(/action="\?\//);
		});

	it('New exercise reads its refusal from the submit result, not the page form', () => {
		const src = readFileSync(SHEET, 'utf8');
		expect(src).toMatch(/result\.type === 'failure'/);
		expect(src).not.toMatch(/\bpage\.form\b/);
	});
});

/*
 * The log form is drawn by Today's layout (the phone's popup, on the list route or
 * beside an open exercise), by a past day and by the exercise page (its popup and,
 * on the desktop, its pane). Each names the route whose `log` it means; a refusal
 * from another route than the page's reaches the form through the submit result.
 */
const SHELL = 'src/lib/components/exercises/LogShell.svelte';
const EXERCISE = 'src/routes/[dance]/(today)/exercises/[id]/+page.svelte';

describe('The log form', () => {
	it('LogShell posts where it is told, never to a bare action', () => {
		const src = readFileSync(SHELL, 'utf8');
		expect(src).toMatch(/<form\s+id=\{formId\}\s+method="POST"\s+\{action\}/);
		expect(src).not.toMatch(/action="\?\//);
	});

	it("Today's popup posts to Today", () => {
		expect(readFileSync('src/routes/[dance]/(today)/+layout.svelte', 'utf8')).toContain(
			'action="/{dance}?/log"'
		);
	});

	it("a past day's popup posts to Today", () => {
		expect(readFileSync('src/routes/[dance]/(today)/+page.svelte', 'utf8')).toContain(
			'action="/{data.dance.slug}?/log"'
		);
	});

	it("the exercise page's popup and pane post to the page's own route", () => {
		// A group drill's page shows the person's entry: its id is not the URL's, so an
		// absolute exercise URL would post across routes (no page.form, no focus reset).
		const src = readFileSync(EXERCISE, 'utf8');
		const logs = src.match(/<Log\b[\s\S]*?\/>/g) ?? [];
		expect(logs.length).toBe(2);
		for (const log of logs) expect(log).not.toMatch(/\baction=/);
		expect(src).not.toMatch(/exercises\/\$\{[^}]*\}\?\/log/);
	});

	it('LogShell shows a refusal from the submit result', () => {
		const src = readFileSync(SHELL, 'utf8');
		expect(src).toMatch(/result\.type === 'failure'/);
		expect(src).toMatch(/refusal = typeof m === 'string'/);
		expect(src).toContain('title={shown}');
	});
});

/*
 * Never two log forms (Review Focus 5): on the desktop the pane's form is the
 * open exercise's, so Today's popup is the phone's alone, whatever opened it
 * (Start session, Resume, a window that widened with it open).
 */
describe("Today's popup", () => {
	it('is never drawn on the desktop', () => {
		const src = readFileSync('src/routes/[dance]/(today)/+layout.svelte', 'utf8');
		const popup = src.match(/\{#if ([^}]*)\}\s*\{#key `\$\{open\.id\}/);
		expect(popup?.[1]).toMatch(/!desk\.current\b/);
	});
});

/*
 * The Done sheet is drawn by the exercise page (`?/done`) and by a past day (Today's
 * `/{dance}?/done`, from the (today) layout's list or page): it posts where it is
 * told, and a refusal from another route reaches it through the submit result. A
 * face tap saves, so the page and the layout's day count the save before the
 * caller leaves.
 */
const DONE = 'src/lib/components/exercises/DoneSheet.svelte';
const SAVED_TOAST = 'src/lib/components/exercises/SavedToast.svelte';

describe('The Done sheet', () => {
	it('posts to its action prop, never to a bare action', () => {
		const src = readFileSync(DONE, 'utf8');
		expect(src).toMatch(/<form\b[^>]*\smethod="POST"[^>]*\s\{action\}/);
		expect(src).not.toMatch(/action="\?\//);
	});

	it('is a guarded form, dirty by its note alone', () => {
		const src = readFileSync(DONE, 'utf8');
		expect(src).toMatch(/use:guarded=\{\{/);
		expect(src).not.toMatch(/use:enhance/);
		expect(src).toMatch(/dirty: \(\) => note !== noteAtOpen/);
	});

	it('reads its refusal from the submit result, not the page form', () => {
		const src = readFileSync(DONE, 'utf8');
		expect(src).toMatch(/result\.type === 'failure'/);
		expect(src).not.toMatch(/\bpage\.form\b/);
		expect(src).toMatch(/<Banner kind="error" title=\{refusal\}/);
	});

	it('counts the save on the page before it hands the result on', () => {
		const src = readFileSync(DONE, 'utf8');
		expect(src).toMatch(/await update\(\{ reset: false \}\);[\s\S]*?onsaved\(/);
	});

	it('a refresh that throws still hands the save on (the save landed; the unsaved dialog settles)', () => {
		const src = readFileSync(DONE, 'utf8');
		expect(src).toMatch(
			/try \{\s*(?:\/\/[^\n]*\s*)*await update\(\{ reset: false \}\);\s*\} catch \{[\s\S]*?\}\s*try \{\s*onsaved\(/
		);
	});

	it('reads the time at the tap, and posts none without one', () => {
		const src = readFileSync(DONE, 'utf8');
		expect(src).toMatch(/if \(seconds !== null\) formData\.set\('durationS'/);
		expect(src).not.toMatch(/name="durationS"/);
	});
});

describe('The saved toast', () => {
	it("Undo posts Today's undoDone through actAt", () => {
		const src = readFileSync(SAVED_TOAST, 'utf8');
		expect(src).toMatch(/actAt\(`\/\$\{s\.dance\}`, 'undoDone', \{/);
		expect(src).toContain('refusalMessage(result, t().today.refused.undo)');
	});

	it('a new save takes the place of an Undo refusal still showing', () => {
		const src = readFileSync(SAVED_TOAST, 'utf8');
		expect(src).toMatch(/\$effect\(\(\) => \{\s*if \(saved\.current\) failed = null;\s*\}\);/);
	});

	it('is mounted once, by the dance layout', () => {
		const src = readFileSync('src/routes/[dance]/+layout.svelte', 'utf8');
		expect(src.match(/<SavedToast\b/g)?.length).toBe(1);
	});

	it('the player announces the save before it leaves', () => {
		const src = readFileSync('src/routes/[dance]/player/+page.svelte', 'utf8');
		const fn = src.match(/async function saved\([^)]*\)[^{]*\{([\s\S]*?)\n\t\}/)?.[1] ?? '';
		expect(fn).toMatch(
			/announceSaved\(\{[\s\S]*savedMessage\(r\.backDays \?\? 1\)[\s\S]*\}\);[\s\S]*leaveRun\(\)/
		);
	});
});

describe('Close, then go', () => {
	it('gotoWhenSettled and backWhenSettled share whenSettled', () => {
		const history = readFileSync('src/lib/sheets/history.svelte.ts', 'utf8');
		const trail = readFileSync('src/lib/nav/trail.svelte.ts', 'utf8');
		expect(history).toMatch(/export function whenSettled\(fn: \(\) => void\): void/);
		expect(history.match(/export function gotoWhenSettled[\s\S]*?\n\}/)?.[0]).toMatch(
			/whenSettled\(\(\) =>/
		);
		expect(trail.match(/export function backWhenSettled[\s\S]*?\n\}/)?.[0]).toMatch(
			/whenSettled\(\(\) =>[\s\S]*goBack\(fallback\)/
		);
	});
});
