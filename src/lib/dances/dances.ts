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
	/** Which count patterns the player's picker offers. */
	countPatterns: readonly CountPattern[];
	defaultCountPattern: CountPattern;
	/** Whether the clave toggle exists. Salsa only. */
	clave: boolean;
	/** `--color-accent` in light mode, and the manifest's `theme_color`. */
	accent: string;
	/** `--color-accent` under `prefers-color-scheme: dark`. */
	accentDark: string;
}

export const DANCE_SLUGS = ['salsa', 'bachata'] as const;
export type DanceSlug = (typeof DANCE_SLUGS)[number];

export const DEFAULT_DANCE: DanceSlug = 'salsa';

export const DANCES: Record<DanceSlug, Dance> = {
	salsa: {
		slug: 'salsa',
		label: 'Salsa',
		styles: ['salsa', 'son', 'other'],
		styleLabel: { salsa: 'Salsa', son: 'Son', other: 'Other' },
		countPatterns: ['salsa', 'son', 'all', 'odd', 'ones', 'one', 'off'],
		defaultCountPattern: 'salsa',
		clave: true,
		accent: '#c2410c',
		accentDark: '#f06a2e'
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
		// No 'son': that pattern is a salsa-family count. Bachata's own
		// 1-2-3-tap / 5-6-7-tap is COUNT_POSITIONS.salsa exactly, so it reuses
		// the 'salsa' key — the user only ever sees COUNT_PATTERN_LABEL, which
		// reads '1 2 3 · 5 6 7' and names no dance.
		countPatterns: ['salsa', 'all', 'odd', 'ones', 'one', 'off'],
		defaultCountPattern: 'salsa',
		clave: false,
		accent: '#0f766e',
		accentDark: '#2dd4bf'
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

export function isStyleOf(slug: DanceSlug, style: string): boolean {
	return DANCES[slug].styles.includes(style);
}

/**
 * The cookie remembering which dance you were last in. Lives here rather than
 * in a route module because both `/` and the `[dance]` layout read it, and a
 * plain constant should not have to be imported across route files.
 */
export const DANCE_COOKIE = 'dance';
