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
	/**
	 * The handhold vocabulary this dance starts with, seeded into `positions` at
	 * boot when the dance has none. A starting point to edit, not a fixed list —
	 * which is why the rows are the truth afterwards and this is only the seed.
	 *
	 * The FIRST entry is the neutral one: the position an untagged figure is
	 * assumed to start and end at. It differs per dance on purpose — salsa
	 * resolves to open, bachata to closed.
	 */
	seedPositions: readonly { slug: string; name: string }[];
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
	 * `--color-accent` under `prefers-color-scheme: dark`. Same rule: keep in
	 * sync with layout.css by hand.
	 *
	 * `--color-accent-ink` (the text/icon colour drawn on top of the accent) has
	 * no counterpart here — it lives in layout.css only, because it depends on
	 * the accent AND the theme together (bachata's dark accent is pale enough
	 * to need a dark ink; every other accent/theme pairing uses white). Nobody
	 * should go looking for `accentInk` in this registry.
	 */
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
		// Casino (Cuban) terms: this is the dance being practised — the figures are
		// dile que no, enchufla, setenta. The first seed used LA/linear names
		// (hammerlock, cuddle, shadow) for the same physical holds, which is a
		// different tradition's vocabulary.
		//
		// The SLUGS deliberately keep their original spelling. A slug is the seed's
		// stable identity and is never shown, so a rename must not move it — that
		// is the whole reason the name and the slug are separate columns.
		//
		// Positions are NOT split by style. Casino and linear share these physical
		// holds under different names, so one node per shape is what lets a figure
		// of one style follow a figure of another; two style-scoped lists would sever
		// exactly that edge while the dancer's hands sat in the identical place.
		seedPositions: [
			{ slug: 'open-two', name: 'Abierta (dos manos)' },
			{ slug: 'open-one', name: 'Abierta (una mano)' },
			{ slug: 'closed', name: 'Cerrada' },
			{ slug: 'cross-hand', name: 'Manos cruzadas' },
			{ slug: 'caida', name: 'Caída' },
			{ slug: 'hammerlock-r', name: 'Setenta, derecha' },
			{ slug: 'hammerlock-l', name: 'Setenta, izquierda' },
			{ slug: 'cuddle', name: 'Sombrero' },
			{ slug: 'shadow', name: 'Sombra' },
			{ slug: 'back-to-back', name: 'Espalda con espalda' }
		],
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
		seedPositions: [
			{ slug: 'closed', name: 'Closed' },
			{ slug: 'open-two', name: 'Open, two hands' },
			{ slug: 'open-one', name: 'Open, one hand' },
			{ slug: 'cross-hand', name: 'Cross-hand' },
			{ slug: 'hammerlock', name: 'Hammerlock' },
			{ slug: 'shadow', name: 'Shadow' },
			{ slug: 'side-by-side', name: 'Side by side' }
		],
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
 * The cookie remembering which dance you were last in. Lives here rather than
 * in a route module because both `/` and the `[dance]` layout read it, and a
 * plain constant should not have to be imported across route files.
 */
export const DANCE_COOKIE = 'dance';
