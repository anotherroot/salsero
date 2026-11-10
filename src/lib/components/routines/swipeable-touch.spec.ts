import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('./Swipeable.svelte', import.meta.url), 'utf8');

describe('Swipeable on a phone', () => {
	// Without it the phone flings the sideways move, and the first tap on the
	// revealed button (Not today, Delete) only stops the fling.
	it('owns its touch moves once it is a swipe', () => {
		expect(src).toContain("addEventListener('touchmove', own, { passive: false })");
		expect(src).toContain('if (tracking !== null && ev.cancelable) ev.preventDefault();');
		expect(src).toContain('bind:this={card}');
	});
});
