// PURE: the redesign's colour tokens, one theme per dance and scheme. The values
// are docs/superpowers/design-kit/kit.py (_LIGHT, _DARK, THEMES) copied exactly;
// layout.css repeats them as `--color-<name>`. Client-safe.
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

const BAND_INK = '#FFF3E4';

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
	ground: '#f2f2f5',
	surface: '#ffffff',
	raised: '#ffffff',
	sheet: '#f2f2f5',
	field: '#f2f2f5',
	hairline: '#e3e3e8',
	'field-line': '#cfcfd6',
	ink: '#111114',
	'ink-2': '#3d3d44',
	muted: '#6e6e76',
	chevron: '#a8a8b0',
	chip: '#e6e3e6',
	'chip-ink': '#111114',
	step: '#ececf0',
	'tab-bg': '#f9f9fb',
	'tab-line': '#dcdce2',
	done: '#1e7a4f',
	'on-done': '#ffffff',
	'done-soft': '#e3f3ea',
	danger: '#c4183c',
	'on-danger': '#ffffff',
	'danger-soft': '#fde8ec',
	warn: '#a34a06',
	'warn-soft': '#fdf0e1',
	easy: '#1f5fbf',
	'easy-soft': '#e6effc',
	'disabled-bg': '#e6e6ea',
	'disabled-ink': '#8a8a92',
	skeleton: '#e6e6ea',
	'inverse-bg': '#26262b',
	'inverse-ink': '#f4f4f6',
	'inverse-done': '#5cc98f'
};

const DARK: Shared = {
	ground: '#0b0b0d',
	surface: '#1c1c1f',
	raised: '#242428',
	sheet: '#141416',
	field: '#0b0b0d',
	hairline: '#2c2c31',
	'field-line': '#3a3a40',
	ink: '#f4f4f6',
	'ink-2': '#c8c8ce',
	muted: '#98989f',
	chevron: '#6e6e76',
	chip: '#2c2c31',
	'chip-ink': '#f4f4f6',
	step: '#2c2c31',
	'tab-bg': '#121214',
	'tab-line': '#2c2c31',
	done: '#5cc98f',
	'on-done': '#0b0b0d',
	'done-soft': '#173226',
	danger: '#ff5c7a',
	'on-danger': '#1a0509',
	'danger-soft': '#3a1520',
	warn: '#f0a04b',
	'warn-soft': '#33240f',
	easy: '#8fb4ff',
	'easy-soft': '#16243d',
	'disabled-bg': '#232327',
	'disabled-ink': '#6a6a72',
	skeleton: '#2e2e34',
	'inverse-bg': '#ececf0',
	'inverse-ink': '#111114',
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
		'accent-soft': mix(d.accent, base.surface, scheme === 'light' ? 0.12 : 0.18)
	};
}

// The band is the same in light and dark (since 2026-11-01): the darkened bands
// read as dull, and the light ones hold their contrast on the dark ground.
export const THEMES: Record<DanceSlug, Record<Scheme, Theme>> = {
	salsa: {
		light: theme(LIGHT, 'light', {
			band: '#D2401E',
			'on-cream': '#b3340f',
			'band-small': '#ffffff',
			accent: '#d2401e',
			'accent-text': '#b3340f',
			'on-accent': '#ffffff',
			status: '#b8330f',
			'inverse-accent': '#ff8a6b'
		}),
		dark: theme(DARK, 'dark', {
			band: '#D2401E',
			'on-cream': '#b3340f',
			'band-small': '#ffffff',
			// One red for fills, as in light (white on it); the lighter red stays for small text.
			accent: '#d2401e',
			'accent-text': '#ff7a59',
			'on-accent': '#ffffff',
			status: '#ff8a6b',
			'inverse-accent': '#b3340f'
		})
	},
	bachata: {
		light: theme(LIGHT, 'light', {
			band: '#6B1D4F',
			'on-cream': '#6B1D4F',
			'band-small': BAND_INK,
			accent: '#8e2a66',
			'accent-text': '#8e2a66',
			'on-accent': '#ffffff',
			status: '#8e2a66',
			'inverse-accent': '#f07aae'
		}),
		dark: theme(DARK, 'dark', {
			band: '#6B1D4F',
			'on-cream': '#6B1D4F',
			'band-small': BAND_INK,
			accent: '#f07aae',
			'accent-text': '#f07aae',
			'on-accent': '#2a0716',
			status: '#f07aae',
			'inverse-accent': '#8e2a66'
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
		'accent-soft': mix('#3a55a8', LIGHT.surface, 0.12),
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
		'accent-soft': mix('#8fa8ff', DARK.surface, 0.18),
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
