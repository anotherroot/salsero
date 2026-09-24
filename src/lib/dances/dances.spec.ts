import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DANCES, DANCE_SLUGS, DEFAULT_DANCE, getDance, isDanceSlug, isStyleOf } from './dances';

describe('the dance registry', () => {
	it('knows its two slugs and no others', () => {
		expect(DANCE_SLUGS).toEqual(['salsa', 'bachata']);
		expect(isDanceSlug('salsa')).toBe(true);
		expect(isDanceSlug('bachata')).toBe(true);
		expect(isDanceSlug('kizomba')).toBe(false);
		expect(isDanceSlug('')).toBe(false);
	});

	it('defaults to salsa', () => {
		expect(DEFAULT_DANCE).toBe('salsa');
	});

	it('keeps salsa looking exactly as it does today', () => {
		const salsa = getDance('salsa');
		expect(salsa.accent).toBe('#c2410c');
		expect(salsa.accentDark).toBe('#f06a2e');
		expect(salsa.clave).toBe(true);
		expect(salsa.styles).toEqual(['salsa', 'son', 'other']);
	});

	it('gives bachata no clave and no son pattern', () => {
		const bachata = getDance('bachata');
		expect(bachata.clave).toBe(false);
		expect(bachata.countPatterns).not.toContain('son');
		expect(bachata.styles).toEqual(['dominican', 'sensual', 'traditional']);
	});

	it('offers the same count positions to both, under salsa key', () => {
		// Bachata's 1-2-3-tap / 5-6-7-tap IS salsa's [1,2,3,5,6,7]. Both dances
		// therefore use the 'salsa' CountPattern key; only the LABEL is shown.
		expect(getDance('bachata').defaultCountPattern).toBe('salsa');
		expect(getDance('salsa').defaultCountPattern).toBe('salsa');
	});

	it('labels every style it lists', () => {
		for (const slug of DANCE_SLUGS) {
			const dance = DANCES[slug];
			for (const style of dance.styles) {
				expect(dance.styleLabel[style]).toBeTruthy();
			}
		}
	});

	it('validates a style against its own dance only', () => {
		expect(isStyleOf('salsa', 'son')).toBe(true);
		expect(isStyleOf('salsa', 'sensual')).toBe(false);
		expect(isStyleOf('bachata', 'sensual')).toBe(true);
		expect(isStyleOf('bachata', 'son')).toBe(false);
	});

	it('returns false, not a throw, for an unknown slug', () => {
		// A hand-edited or pre-migration row can carry a `dance` string that
		// matches nothing in the registry; `DANCES[slug]` on that value would
		// throw rather than fail the style check cleanly.
		expect(isStyleOf('kizomba', 'salsa')).toBe(false);
		expect(isStyleOf('', 'salsa')).toBe(false);
	});

	it('throws on an unknown slug rather than returning a default', () => {
		expect(() => getDance('kizomba')).toThrow();
	});

	it('keys every entry under its own slug', () => {
		// Nothing in TypeScript enforces `DANCES.bachata.slug === 'bachata'` — a
		// copy-paste that left an old `slug` behind would type-check fine and
		// only misbehave once something looked a dance up by key and trusted the
		// row back, e.g. `getDance(slug).slug`.
		for (const key of DANCE_SLUGS) {
			expect(DANCES[key].slug).toBe(key);
		}
	});

	it('has every registry accent hex in layout.css', () => {
		// `--color-accent`/`--color-accent-ink` are hand-copied into
		// `src/routes/layout.css` because a stylesheet cannot import this
		// module (see the comments on `Dance.accent`/`accentDark`) — nothing
		// TYPE-CHECKS that copy, so this reads the stylesheet back off disk and
		// greps for it. `make-icons.sh` closes the third leg by reading the
		// registry directly instead of hard-coding its own copy, so this test
		// only has the stylesheet left to cover.
		const css = readFileSync('src/routes/layout.css', 'utf8');
		for (const key of DANCE_SLUGS) {
			const dance = DANCES[key];
			expect(css, `${key}.accent (${dance.accent}) missing from layout.css`).toContain(
				dance.accent
			);
			expect(css, `${key}.accentDark (${dance.accentDark}) missing from layout.css`).toContain(
				dance.accentDark
			);
		}
	});
});
