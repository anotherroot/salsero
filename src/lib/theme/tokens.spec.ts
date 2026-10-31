import { describe, expect, it } from 'vitest';
import { DANCE_SLUGS } from '$lib/dances/dances';
import { contrast, mix } from './contrast';
import { BAND_TRACK, MEDIA, THEMES, TOKEN_NAMES, type Scheme, type TokenName } from './tokens';

const SCHEMES: Scheme[] = ['light', 'dark'];

const pairs: [TokenName, TokenName][] = [
	['ink', 'ground'],
	['ink', 'surface'],
	['ink-2', 'surface'],
	['ink-2', 'accent-soft'],
	['warn', 'warn-soft'],
	['muted', 'surface'],
	['muted', 'ground'],
	['accent-text', 'surface'],
	['status', 'surface'],
	['on-accent', 'accent'],
	['on-cream', 'band-ink'],
	['danger', 'surface'],
	['on-danger', 'danger'],
	['done', 'surface'],
	['warn', 'surface'],
	['done', 'done-soft'],
	['muted', 'sheet'],
	['accent-text', 'accent-soft'],
	['band-small', 'band'],
	['inverse-ink', 'inverse-bg'],
	['inverse-accent', 'inverse-bg'],
	['chip-ink', 'chip']
];

describe('theme tokens', () => {
	it('defines every token in all four themes', () => {
		for (const d of DANCE_SLUGS)
			for (const s of SCHEMES)
				for (const n of TOKEN_NAMES)
					expect(THEMES[d][s][n], `${d} ${s} ${n}`).toMatch(/^#[0-9a-f]{6}$/i);
	});

	it('measures contrast like WCAG', () => {
		expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
		expect(contrast('#FFF3E4', '#D2401E')).toBeCloseTo(4.3, 1);
	});

	it('composites an #rrggbbaa foreground over the background', () => {
		expect(contrast('#00000000', '#ffffff')).toBeCloseTo(1, 5);
	});

	it('mixes opaquely', () => {
		expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
		expect(mix('#d2401e', '#ffffff', 1)).toBe('#d2401e');
	});

	it('mixes accent-soft from accent over surface', () => {
		expect(THEMES.salsa.light['accent-soft']).toBe(mix('#d2401e', '#ffffff', 0.12));
		expect(THEMES.salsa.dark['accent-soft']).toBe(mix('#ff6b47', '#1c1c1f', 0.18));
	});

	for (const d of DANCE_SLUGS)
		for (const s of SCHEMES)
			it.each(pairs)(`${d} ${s}: %s on %s is at least 4.5`, (fg, bg) => {
				const t = THEMES[d][s];
				expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
			});

	for (const d of DANCE_SLUGS)
		for (const s of SCHEMES)
			it(`${d} ${s}: band-ink on band is at least 3 (large only)`, () => {
				const t = THEMES[d][s];
				expect(contrast(t['band-ink'], t.band)).toBeGreaterThanOrEqual(3);
			});

	it('keeps the band colours of the app icons', () => {
		expect(THEMES.salsa.light.band).toBe('#D2401E');
		expect(THEMES.bachata.light.band).toBe('#6B1D4F');
	});
});

describe('media palette', () => {
	it('defines every token for both dances', () => {
		for (const d of DANCE_SLUGS)
			for (const n of TOKEN_NAMES)
				expect(MEDIA[d][n], `${d} media ${n}`).toMatch(/^#[0-9a-f]{6}$/i);
	});

	it('is the dark theme on a black ground', () => {
		expect(MEDIA.salsa.ground).toBe('#000000');
		expect(MEDIA.bachata.accent).toBe(THEMES.bachata.dark.accent);
	});

	for (const d of DANCE_SLUGS)
		it.each(pairs)(`${d} media: %s on %s is at least 4.5`, (fg, bg) => {
			const t = MEDIA[d];
			expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
		});
});

describe('on-band switch track', () => {
	it('keeps the unselected label readable on the track in every theme', () => {
		for (const d of DANCE_SLUGS)
			for (const s of SCHEMES) {
				const t = THEMES[d][s];
				// contrast() composites an #rrggbbaa background over white, so build the
				// opaque track by hand: black at the track's alpha over the band.
				const alpha = parseInt(BAND_TRACK.slice(7, 9), 16) / 255;
				const track = mix('#000000', t.band, alpha);
				expect(contrast(t['band-small'], track), `${d} ${s}`).toBeGreaterThanOrEqual(4.5);
			}
	});
});
