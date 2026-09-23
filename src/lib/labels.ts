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

/**
 * Patterns the user records half-bar phrases for. The sparse ones are left
 * out on purpose: at 1-3-5-7 the words are half a second apart, so there is no
 * flow between them for a phrase recording to preserve — they use single words
 * and cost no takes.
 */
export const PHRASE_PATTERNS = ['salsa', 'son', 'all'] as const;
export type PhrasePattern = (typeof PHRASE_PATTERNS)[number];

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

/**
 * Tempos the user records their own count at, roughly every 8 % so the nearest
 * one is never more than ~4 % away — well under half a semitone once
 * `playbackRate` stretches it, which is inaudible.
 *
 * It stops at 191 because that is where the words stop fitting: a count needs
 * ~0.30 s to be said and a beat at 200 BPM is 0.30 s exactly. Past there the
 * answer is a sparser pattern, not a faster take.
 *
 * It starts at 120 rather than lower because practice speed multiplies — a
 * 180 BPM song at 0.7× behaves as 126 and is covered from inside the ladder.
 */
export const TEMPO_LADDER = [120, 130, 140, 152, 164, 177, 191] as const;

/** Playback speeds the player offers. 1 first: the default is full speed. */
export const SPEEDS = [1, 0.9, 0.8, 0.7] as const;
export type Speed = (typeof SPEEDS)[number];
