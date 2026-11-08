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
 * Today draws no log popup. The exercise page and a past day save through the Done sheet.
 * Each names the route whose action it means; a refusal from another route than
 * the page's reaches the form through the submit result.
 */
const EXERCISE = 'src/routes/[dance]/(today)/exercises/[id]/+page.svelte';
const LAYOUT = 'src/routes/[dance]/(today)/+layout.svelte';
const PAST = 'src/routes/[dance]/(today)/+page.svelte';

describe('The log form', () => {
	it("a past day's Done sheet posts to Today's done, no time and no faces' times", () => {
		const src = readFileSync(PAST, 'utf8');
		expect(src).not.toMatch(/<Log\b/);
		const sheets = src.match(/<DoneSheet\b[\s\S]*?\/>/g) ?? [];
		expect(sheets.length).toBe(1);
		expect(sheets[0]).toContain('action="/{data.dance.slug}?/done"');
		expect(sheets[0]).toMatch(/\bfaces=\{null\}/);
		expect(sheets[0]).toMatch(/\bseconds=\{null\}/);
		expect(sheets[0]).toMatch(/\bday=\{past\.day\}/);
		// It starts from that exercise's entry on the day, and a save closes it and says "Added to …".
		expect(sheets[0]).toMatch(/\bcurrent=\{entry\}/);
		expect(src).toMatch(/const entry = \$derived\.by\([\s\S]*?mergeDay\(rows\)/);
		expect(sheets[0]).toMatch(/\bonsaved=\{\(r\) => saved\(r, past\.day\)\}/);
		const fn = src.match(/function saved\(r: DoneResult, day: string\) \{([\s\S]*?)\n\t\}/)?.[1];
		expect(fn).toMatch(/doneOpen = false;[\s\S]*announceSaved\(\{[\s\S]*addedMessage\(day\)/);
	});

	it("Today's layout draws no log popup", () => {
		const src = readFileSync(LAYOUT, 'utf8');
		expect(src).not.toMatch(/<Log\b/);
		expect(src).not.toMatch(/\blogFor\b/);
		expect(src).not.toContain('?/log');
		expect(src).not.toMatch(/\bpagePopup\b/);
	});

	it("the exercise page's Done sheet posts to the page's own done, never an exercise URL", () => {
		// A group drill's page shows the person's entry: its id is not the URL's, so an
		// absolute exercise URL would post across routes (no page.form, no focus reset).
		const src = readFileSync(EXERCISE, 'utf8');
		expect(src).not.toMatch(/<Log\b/);
		const sheets = src.match(/<DoneSheet\b[\s\S]*?\/>/g) ?? [];
		expect(sheets.length).toBe(1);
		expect(sheets[0]).toMatch(/\baction="\?\/done"/);
		expect(src).not.toMatch(/exercises\/\$\{[^}]*\}\?\//);
		// The fixed rhythm's Done, without the sheet: the page's own action too.
		expect(src).toMatch(/act\('done', \{/);
	});

	it('after a save the exercise page goes on through the session, else back', () => {
		const src = readFileSync(EXERCISE, 'utf8');
		const fn = src.match(/function saved\(r: DoneResult\): void \{([\s\S]*?)\n\t\}/)?.[1] ?? '';
		expect(fn).toMatch(
			/announceSaved\([\s\S]*if \(today\?\.session\) today\.session\.onnext\(\);\s*else void backWhenSettled\(todayBack\(data\.dance\.slug\), \{ replace: true \}\)/
		);
		expect(fn).toMatch(/clock\.restart\(\)/);
		// The session's end too: on the desktop a pane page has no opener, so back
		// must replace the saved page, not push Today on top of it.
		const layout = readFileSync(LAYOUT, 'utf8');
		expect(layout).toMatch(/else void backWhenSettled\(todayBack\(dance\), \{ replace: true \}\)/);
		// One Today fallback, never written out again.
		for (const src2 of [src, layout])
			expect(src2).not.toContain('t().shell.backTo(t().shell.tabs.today)');
		expect(src).not.toMatch(/today\??\.(line|logged|follow|key|undoable)\b/);
	});
});

/* Today's rows open the exercise's page: no + of their own, a muted chevron at every width. */
describe("Today's rows", () => {
	it('ExerciseRow has no log button', () => {
		const src = readFileSync('src/lib/components/today/ExerciseRow.svelte', 'utf8');
		expect(src).not.toMatch(/logSet/);
		expect(src).not.toMatch(/\bonlog\b/);
		expect(src).toMatch(/class="[^"]*\btext-chevron\b[^"]*"><Icon name="chevron-right"/);
	});

	it('TodayList passes no onlog', () => {
		expect(readFileSync('src/lib/components/today/TodayList.svelte', 'utf8')).not.toMatch(
			/\bonlog\b/
		);
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

	// What the save does with its answer (refusal, refresh first, the time at the tap)
	// is `done-submit.ts`, run in `done-submit.spec.ts`; here, that the sheet uses it.
	it('saves through doneSubmit and shows its refusal, never the page form', () => {
		const src = readFileSync(DONE, 'utf8');
		expect(src).toMatch(/const submit = doneSubmit\(\{/);
		expect(src).toMatch(/submit\s*\}\}/);
		expect(src).not.toMatch(/\bpage\.form\b/);
		expect(src).toMatch(/<Banner kind="error" title=\{refusal\}/);
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

	it('the player saves nothing, so it announces no save (one-player design)', () => {
		const src = readFileSync('src/routes/[dance]/player/+page.svelte', 'utf8');
		expect(src).not.toMatch(/announceSaved|SaveSetSheet|function saved\(/);
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
			/whenSettled\(\(\) =>[\s\S]*goBack\(fallback, opts\)/
		);
	});
});
