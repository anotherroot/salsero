import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { landedRow, shouldReplay } from './landing';

describe('the Done landing', () => {
	it('plays what changed while Today was hidden only after a save or Not today', () => {
		expect(shouldReplay({ savedId: 4, layoutToast: false })).toBe(true);
		expect(shouldReplay({ savedId: null, layoutToast: true })).toBe(true);
		expect(shouldReplay({ savedId: null, layoutToast: false })).toBe(false);
	});

	it('lifts the saved row only once it is done', () => {
		expect(landedRow(4, [{ id: 4, done: true }])).toBe(4);
		expect(landedRow(4, [{ id: 4, done: false }])).toBeNull();
		expect(landedRow(4, [{ id: 5, done: true }])).toBeNull();
		expect(landedRow(null, [{ id: 4, done: true }])).toBeNull();
	});

	it('the exercise page says which exercise it saved', () => {
		const page = readFileSync('src/routes/[dance]/(today)/exercises/[id]/+page.svelte', 'utf8');
		const call = page.slice(
			page.indexOf('announceSaved({'),
			page.indexOf('});', page.indexOf('announceSaved({'))
		);
		expect(call).toContain('exerciseId: data.exercise.id');
	});

	it('Today knows when it is in sight, and the bar too', () => {
		const layout = readFileSync('src/routes/[dance]/(today)/+layout.svelte', 'utf8');
		expect(layout).toMatch(/<TodayBar[^>]*shown=\{listShown\}/);
		expect(layout).toMatch(/\{landing\}|landing=\{/);
		expect(layout).toMatch(/\{landedId\}|landedId=\{/);
	});
});
