import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Catches: the offline screen's focus found by the English "Try again", which
// matches nothing in Slovenian ("Poskusi znova"), so focus fell elsewhere.
describe('the offline screen', () => {
	it('focuses Try again by its mark, not its word', () => {
		const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
		const screen = readFileSync('src/lib/components/system/ErrorScreen.svelte', 'utf8');
		expect(layout).toContain("querySelector<HTMLButtonElement>('button[data-retry]')?.focus()");
		expect(layout).not.toContain("includes('Try again')");
		expect(screen).toMatch(/onclick=\{onretry\} data-retry>/);
	});
});
