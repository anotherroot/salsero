import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DANCE_SLUGS } from '$lib/dances/dances';
import { MEDIA, THEMES, TOKEN_NAMES } from './tokens';

const css = readFileSync('src/routes/layout.css', 'utf8').toLowerCase();
const block = (sel: RegExp) => css.match(sel)?.[1] ?? '';

describe('layout.css', () => {
	it('carries every token value of every theme', () => {
		for (const d of DANCE_SLUGS)
			for (const s of ['light', 'dark'] as const)
				for (const n of TOKEN_NAMES)
					expect(css, `${d} ${s} ${n}`).toContain(THEMES[d][s][n].toLowerCase());
	});
	it('names every token', () => {
		for (const n of TOKEN_NAMES) expect(css, n).toContain(`--color-${n}:`);
	});
	it('still defines the old names for screens not yet redrawn', () => {
		for (const old of [
			'plane',
			'surface',
			'raised',
			'line',
			'rule',
			'accent-ink',
			'done-bg',
			'overdue',
			'ink',
			'ink-2',
			'muted',
			'accent',
			'danger',
			'done'
		])
			expect(css).toContain(`--color-${old}:`);
	});
	it('scopes the media palette for the player’s layers', () => {
		const salsa = block(/\n\s*\.theme-media\s*\{([^}]*)\}/);
		for (const n of TOKEN_NAMES)
			expect(salsa, n).toContain(`--color-${n}: ${MEDIA.salsa[n].toLowerCase()};`);
		const bachata = block(/\[data-dance='bachata'\]\s+\.theme-media\s*\{([^}]*)\}/);
		for (const n of [
			'band',
			'accent',
			'accent-text',
			'accent-soft',
			'on-accent',
			'status'
		] as const)
			expect(bachata, n).toContain(`--color-${n}: ${MEDIA.bachata[n].toLowerCase()};`);
	});
});
