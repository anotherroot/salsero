/**
 * The dances the app knows, as pure client-safe data.
 *
 * A dance is the wall through the content: a figure, song, exercise or lesson
 * belongs to exactly one, and you never see the other one's rows. It also
 * carries the behaviour that differs — which styles a figure may be tagged
 * with, which count patterns the player offers, whether clave exists at all.
 *
 * There is deliberately no `dances` table. The differences above are
 * code-shaped (count positions, clave positions, which pickers render), so a
 * row in a database could not carry them: a new row would only ever get
 * generic defaults until the code caught up. Adding a dance is an entry here
 * and a deploy.
 */
import type { CountPattern } from '$lib/labels';

export interface Dance {
	/** The URL segment, and the value stored in the `dance` column. */
	slug: DanceSlug;
	label: string;
	/** Style tags a figure of this dance may carry. Validated in `figures.ts`. */
	styles: readonly string[];
	styleLabel: Record<string, string>;
	/**
	 * The style a new figure starts on when the user has not picked their own
	 * in Settings (`default_styles`). One of `styles`.
	 */
	defaultStyle: string;
	/** Which count patterns the player's picker offers. */
	countPatterns: readonly CountPattern[];
	defaultCountPattern: CountPattern;
	/** Whether the clave toggle exists. Salsa only. */
	clave: boolean;
	/**
	 * `--color-accent` in light mode, and the manifest's `theme_color`. Kept
	 * IN SYNC BY HAND with the `[data-dance='…']` rules in
	 * `src/routes/layout.css` — this registry is what the manifest route and
	 * `scripts/make-icons.sh` read, but the stylesheet cannot import TypeScript,
	 * so the same hex is written twice and nothing but that file's comments
	 * (and this one) keeps them honest.
	 */
	accent: string;
	/**
	 * `--color-accent` in dark mode. Same rule: keep in
	 * sync with layout.css by hand.
	 *
	 * `--color-on-accent` (the text/icon colour drawn on top of the accent) has
	 * no counterpart here — it lives in layout.css and `theme/tokens.ts` only,
	 * because it depends on the accent AND the theme together (both dark accents
	 * are pale enough to need a dark ink; light ones use white). Nobody should go
	 * looking for `accentInk` in this registry.
	 */
	accentDark: string;
	/** `--color-band`, light and dark alike: the colour of the page band. Same sync rule. */
	band: string;
}

export const DANCE_SLUGS = ['salsa', 'bachata'] as const;
export type DanceSlug = (typeof DANCE_SLUGS)[number];

export const DEFAULT_DANCE: DanceSlug = 'salsa';

export const DANCES: Record<DanceSlug, Dance> = {
	salsa: {
		slug: 'salsa',
		label: 'Salsa',
		styles: ['salsa', 'son', 'timba', 'other'],
		styleLabel: { salsa: 'Salsa', son: 'Son', timba: 'Timba', other: 'Other' },
		defaultStyle: 'salsa',
		countPatterns: ['salsa', 'son', 'all', 'odd', 'ones', 'one', 'off'],
		defaultCountPattern: 'salsa',
		clave: true,
		accent: '#d2401e',
		accentDark: '#d2401e',
		band: '#D2401E'
	},
	bachata: {
		slug: 'bachata',
		label: 'Bachata',
		styles: ['dominican', 'sensual', 'traditional'],
		styleLabel: {
			dominican: 'Dominican',
			sensual: 'Sensual',
			traditional: 'Traditional'
		},
		// Sensual is what gets danced; the list order stays as it was.
		defaultStyle: 'sensual',
		// No 'son': that pattern is a salsa-family count. Bachata's own
		// 1-2-3-tap / 5-6-7-tap is COUNT_POSITIONS.salsa exactly, so it reuses
		// the 'salsa' key — the user only ever sees COUNT_PATTERN_LABEL, which
		// reads '1 2 3 · 5 6 7' and names no dance.
		countPatterns: ['salsa', 'all', 'odd', 'ones', 'one', 'off'],
		defaultCountPattern: 'salsa',
		clave: false,
		accent: '#8e2a66',
		accentDark: '#f07aae',
		band: '#6B1D4F'
	}
};

export function isDanceSlug(v: string): v is DanceSlug {
	return (DANCE_SLUGS as readonly string[]).includes(v);
}

/** The dance for a slug. Throws on an unknown one — callers validate first. */
export function getDance(slug: string): Dance {
	if (!isDanceSlug(slug)) throw new Error(`Unknown dance: ${slug}`);
	return DANCES[slug];
}

/**
 * `slug` is a plain `string`, not `DanceSlug`: callers often have it fresh out
 * of a database row (`figures.dance` etc.), which TypeScript can only type as
 * `string` since Drizzle's `text()` carries no enum. Guarding with
 * `isDanceSlug` here — rather than pushing every caller to cast first — means
 * a hand-edited or pre-migration row with a bogus `dance` value returns
 * `false` instead of throwing `DANCES[undefined].styles`.
 */
export function isStyleOf(slug: string, style: string): boolean {
	return isDanceSlug(slug) && DANCES[slug].styles.includes(style);
}

/**
 * The dance a path belongs to: its first segment, when that is a dance. A query
 * or hash is not part of it: login's `next` is `/bachata?app=android` when the
 * bachata app opens signed out.
 */
export function danceInPath(path: string): DanceSlug | null {
	const slug = path.split(/[?#]/)[0].split('/')[1] ?? '';
	return isDanceSlug(slug) ? slug : null;
}
