import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * The merge sheet's tiles are radios inside labels: a screen reader names each
 * from the label's text (the column and the value). An aria-label on the radio
 * would replace that text, so the value chosen would never be heard.
 */
const source = readFileSync(new URL('./CompareSheet.svelte', import.meta.url), 'utf8');

describe('CompareSheet tiles', () => {
	it('names a radio from its label’s text, never an aria-label', () => {
		const radios = source.match(/<input\s[^>]*type="radio"[^>]*>/g) ?? [];
		expect(radios.length).toBeGreaterThan(0);
		for (const r of radios) expect(r).not.toMatch(/aria-label=/);
	});

	it('says which column a tile is in, for screen readers', () => {
		expect(source).toMatch(/<span class="sr-only">\{o\.name\}: <\/span>/);
	});
});
