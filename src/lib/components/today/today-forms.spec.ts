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

	it("the exercise page's popup and pane post to the exercise", () => {
		const src = readFileSync(EXERCISE, 'utf8');
		expect(src).toContain(
			'const logAction = $derived(`/${data.dance.slug}/exercises/${exercise.id}?/log`);'
		);
		expect(src.match(/<Log\b[^>]*>/g)?.length).toBe(2);
		expect(src.match(/action=\{logAction\}/g)?.length).toBe(2);
	});

	it('LogShell shows a refusal from the submit result', () => {
		const src = readFileSync(SHELL, 'utf8');
		expect(src).toMatch(/result\.type === 'failure'/);
		expect(src).toMatch(/refusal = typeof m === 'string'/);
		expect(src).toContain('title={shown}');
	});
});
