/** Enumerations shared by the server schema and the UI. Client-safe. */

export const STYLES = ['salsa', 'son', 'other'] as const;
export type Style = (typeof STYLES)[number];

export const PARTNER = ['partner', 'solo'] as const;
export type Partner = (typeof PARTNER)[number];

export const SOURCES = ['figure', 'choreography', 'custom'] as const;
export type Source = (typeof SOURCES)[number];

/** Phase 1 treats every mode as "log a set"; the player arrives in phase 2. */
export const PRACTICE_MODES = ['song', 'count', 'none'] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number];

export const STYLE_LABEL: Record<Style, string> = { salsa: 'Salsa', son: 'Son', other: 'Other' };
export const PARTNER_LABEL: Record<Partner, string> = { partner: 'With partner', solo: 'Solo' };

/** How the detected beats map to the dance count. See `src/lib/beatgrid/`. */
export const TEMPO_FACTORS = [0.5, 1, 2] as const;
export type TempoFactor = (typeof TEMPO_FACTORS)[number];
export const TEMPO_LABEL: Record<TempoFactor, string> = { 0.5: '×½', 1: '×1', 2: '×2' };

export const SONG_STATUSES = ['waiting_download', 'waiting_analysis', 'ready', 'failed'] as const;
export type SongStatus = (typeof SONG_STATUSES)[number];

/** The clips shipped in `static/clips/`. See `scripts/make-clips.sh`. */
export const CLIPS = [
	'uno',
	'dos',
	'tres',
	'cuatro',
	'cinco',
	'seis',
	'siete',
	'ocho',
	'clave'
] as const;
export type Clip = (typeof CLIPS)[number];

/**
 * Which counts the voice speaks. Salsa's silent 4 and 8 are the DANCE's pause,
 * not a property of the music, so this is a choice rather than a hole in the
 * clip table — son rests on 1 and 5 instead, and sometimes every count is what
 * you want.
 *
 * The sparse patterns are also the only thing that carries a fast song. A word
 * needs ~0.30 s to be said at all and a beat at 250 BPM is 0.24 s, so counting
 * 1-3-5-7 there gives a word the same 0.48 s that all eight counts give it at
 * 125. Positions live in `src/lib/scheduler/`.
 */
export const COUNT_PATTERNS = ['salsa', 'son', 'all', 'odd', 'ones', 'one', 'off'] as const;
export type CountPattern = (typeof COUNT_PATTERNS)[number];

export const COUNT_PATTERN_LABEL: Record<CountPattern, string> = {
	salsa: '1 2 3 · 5 6 7',
	son: '2 3 4 · 6 7 8',
	all: '1–8',
	odd: '1 3 5 7',
	ones: '1 · 5',
	one: '1',
	off: 'Off'
};

/** Which clave the player ticks. Positions live in `src/lib/scheduler/`. */
export const CLAVE_PATTERNS = ['3-2', '2-3'] as const;
export type ClavePattern = (typeof CLAVE_PATTERNS)[number];

/** How many 8-counts between figure calls. */
export const CALL_EVERY = [1, 2, 4] as const;
export type CallEvery = (typeof CALL_EVERY)[number];

export const PRACTICE_LABEL: Record<PracticeMode, string> = {
	song: 'With a song',
	count: 'Count only',
	none: 'Just log it'
};

/** Playback speeds the player offers. 1 first: the default is full speed. */
export const SPEEDS = [1, 0.9, 0.8, 0.7] as const;
export type Speed = (typeof SPEEDS)[number];
