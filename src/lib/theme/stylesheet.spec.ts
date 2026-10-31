import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DANCE_SLUGS } from '$lib/dances/dances';
import { THEMES, TOKEN_NAMES } from './tokens';

const css = readFileSync('src/routes/layout.css', 'utf8').toLowerCase();

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
});
