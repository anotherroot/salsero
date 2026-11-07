// PURE: the colour tokens, one theme per dance and scheme. This file is the
// source since the warm palette (2026-11-07, option D); the design board's
// kit.py holds the redesign's first, brighter colours. layout.css repeats
// them as `--color-<name>`. Client-safe.
import { DANCE_SLUGS, type DanceSlug } from '$lib/dances/dances';
import { mix } from './contrast';

export type Scheme = 'light' | 'dark';

export const TOKEN_NAMES = [
	'ground',
	'surface',
	'raised',
	'sheet',
	'field',
	'hairline',
	'field-line',
	'track',
	'ink',
	'ink-2',
	'muted',
	'chevron',
	'chip',
	'chip-ink',
	'step',
	'tab-bg',
	'tab-line',
	'done',
	'on-done',
	'done-soft',
	'danger',
	'on-danger',
	'danger-soft',
	'warn',
	'warn-soft',
	'easy',
	'easy-soft',
	'disabled-bg',
	'disabled-ink',
	'skeleton',
	'inverse-bg',
	'inverse-ink',
	'inverse-done',
	'band',
	'band-ink',
	'on-cream',
	'band-small',
	'accent',
	'accent-text',
	'accent-soft',
	'on-accent',
	'status',
	'inverse-accent'
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];
export type Theme = Record<TokenName, string>;

const BAND_INK = '#FFF6EC';

/** The on-band switch track: black at 15 % over the band (ruling R7). Tailwind's `bg-band-track` uses it. */
export const BAND_TRACK = '#00000026';

/** Black at 45 % behind a sheet, dialog or the player's layer: Tailwind's `bg-scrim`, and written out in `dialog::backdrop`. */
export const SCRIM = '#00000073';

type Shared = Omit<Theme, DanceTokens>;
type DanceTokens =
	| 'band'
	| 'band-ink'
	| 'on-cream'
	| 'band-small'
	| 'accent'
	| 'accent-text'
	| 'accent-soft'
	| 'on-accent'
	| 'status'
	| 'inverse-accent';

const LIGHT: Shared = {
	ground: '#f5f1eb',
	surface: '#fffdfa',
	raised: '#fffdfa',
	sheet: '#f5f1eb',
	field: '#f3eee7',
	hairline: '#e7e0d6',
	// A field's edge: 3:1 on a card. Progress tracks and grabbers are `track`.
	'field-line': '#8f867c',
	track: '#e2dacf',
	ink: '#1e1a16',
	'ink-2': '#45403a',
	muted: '#665e55',
	chevron: '#8e8479',
	chip: '#ece5dc',
	'chip-ink': '#1e1a16',
	step: '#eee8e0',
	'tab-bg': '#fbf8f3',
	'tab-line': '#e2dacf',
	done: '#2f7650',
	'on-done': '#ffffff',
	'done-soft': '#e4f0e7',
	danger: '#b3343f',
	'on-danger': '#ffffff',
	'danger-soft': '#f8e6e6',
	warn: '#975210',
	'warn-soft': '#f8ecdc',
	easy: '#3a6293',
	'easy-soft': '#e7edf5',
	'disabled-bg': '#eae4dc',
	'disabled-ink': '#776f65',
	skeleton: '#eae4dc',
	'inverse-bg': '#2a2520',
	'inverse-ink': '#f5f1eb',
	'inverse-done': '#5cc98f'
};

const DARK: Shared = {
	ground: '#12100e',
	surface: '#1f1b18',
	raised: '#27221e',
	sheet: '#181512',
	field: '#12100e',
	hairline: '#322c27',
	'field-line': '#756b61',
	track: '#3a332d',
	ink: '#f3eee8',
	'ink-2': '#cfc6bc',
	muted: '#a39a8f',
	chevron: '#80766b',
	chip: '#322c27',
	'chip-ink': '#f3eee8',
	step: '#322c27',
	'tab-bg': '#171411',
	'tab-line': '#322c27',
	done: '#79c29a',
	'on-done': '#0b0b0d',
	'done-soft': '#1b2e22',
	danger: '#f0707f',
	'on-danger': '#1a0509',
	'danger-soft': '#3a1a1e',
	warn: '#e7a25a',
	'warn-soft': '#33261a',
	easy: '#97b6e6',
	'easy-soft': '#18243a',
	'disabled-bg': '#26211d',
	'disabled-ink': '#887f75',
	skeleton: '#332d28',
	'inverse-bg': '#ece5dc',
	'inverse-ink': '#1e1a16',
	'inverse-done': '#1e7a4f'
};

type DanceInput = Pick<
	Theme,
	| 'band'
	| 'band-small'
	| 'on-cream'
	| 'accent'
	| 'accent-text'
	| 'on-accent'
	| 'status'
	| 'inverse-accent'
>;

function theme(base: Shared, scheme: Scheme, d: DanceInput): Theme {
	return {
		...base,
		...d,
		'band-ink': BAND_INK,
		'accent-soft': mix(d.accent, base.surface, scheme === 'light' ? 0.13 : 0.2)
	};
}

// The warm palette (2026-11-07, option D of the palette board): clay for salsa,
// wine for bachata, a step deeper in dark so the band does not glare at night.
export const THEMES: Record<DanceSlug, Record<Scheme, Theme>> = {
	salsa: {
		light: theme(LIGHT, 'light', {
			band: '#A8492F',
			'on-cream': '#96402a',
			'band-small': BAND_INK,
			accent: '#a8492f',
			'accent-text': '#933f28',
			'on-accent': '#ffffff',
			status: '#933f28',
			'inverse-accent': '#f2a083'
		}),
		dark: theme(DARK, 'dark', {
			band: '#7E3826',
			'on-cream': '#7e3826',
			'band-small': '#f2d9cc',
			accent: '#b0523a',
			'accent-text': '#f0957a',
			'on-accent': '#ffffff',
			status: '#f0957a',
			'inverse-accent': '#933f28'
		})
	},
	bachata: {
		light: theme(LIGHT, 'light', {
			band: '#64304F',
			'on-cream': '#64304f',
			'band-small': '#f4e1ea',
			accent: '#7c3b61',
			'accent-text': '#7c3b61',
			'on-accent': '#ffffff',
			status: '#7c3b61',
			'inverse-accent': '#e7a0c1'
		}),
		dark: theme(DARK, 'dark', {
			band: '#4D2640',
			'on-cream': '#4d2640',
			'band-small': '#ebd3df',
			accent: '#e29abc',
			'accent-text': '#e29abc',
			'on-accent': '#2a0f1d',
			status: '#e29abc',
			'inverse-accent': '#7c3b61'
		})
	}
};

const GROUP_INK = '#EAF0FF';

/**
 * Group mode's palette: navy instead of the dance's colour. It carries exactly the
 * dance tokens the bachata block overrides, and layout.css's `[data-dance][data-group]`
 * outranks `[data-dance='bachata']`. The band is the same in both schemes.
 */
export const GROUP: Record<Scheme, Pick<Theme, DanceTokens>> = {
	light: {
		band: '#26345E',
		'band-ink': GROUP_INK,
		'band-small': GROUP_INK,
		'on-cream': '#26345E',
		accent: '#3a55a8',
		'accent-text': '#3a55a8',
		'accent-soft': mix('#3a55a8', LIGHT.surface, 0.13),
		'on-accent': '#ffffff',
		status: '#3a55a8',
		'inverse-accent': '#9db4ff'
	},
	dark: {
		band: '#26345E',
		'band-ink': GROUP_INK,
		'band-small': GROUP_INK,
		'on-cream': '#26345E',
		accent: '#8fa8ff',
		'accent-text': '#8fa8ff',
		'accent-soft': mix('#8fa8ff', DARK.surface, 0.2),
		'on-accent': '#0b0b0d',
		status: '#8fa8ff',
		'inverse-accent': '#3a55a8'
	}
};

const MEDIA_SURFACE = '#1c1c1f';

/**
 * The full-screen player's palette, always dark: kit `_media` — the dark theme
 * on a black ground. The kit's rgba inks and hairline are composited over the
 * surface here so every token stays `#rrggbb`. layout.css scopes it as
 * `.theme-media`.
 */
function media(dark: Theme): Theme {
	return {
		...dark,
		ground: '#000000',
		raised: MEDIA_SURFACE,
		ink: '#ffffff',
		'ink-2': mix('#ffffff', MEDIA_SURFACE, 0.82),
		muted: mix('#ffffff', MEDIA_SURFACE, 0.64),
		hairline: mix('#ffffff', MEDIA_SURFACE, 0.16)
	};
}

export const MEDIA: Record<DanceSlug, Theme> = {
	salsa: media(THEMES.salsa.dark),
	bachata: media(THEMES.bachata.dark)
};
export { DANCE_SLUGS };
