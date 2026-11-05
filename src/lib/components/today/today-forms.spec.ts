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
