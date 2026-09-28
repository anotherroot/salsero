/**
 * What the practice panel remembers per exercise, and how it is read back.
 * PURE and client-safe: the panel parses with it, the endpoint validates with
 * it.
 *
 * `parsePracticeConfig` is TOTAL — the guitar app's rule for per-type JSON.
 * Whatever is in `exercises.practice_json` (nothing, an older shape, a
 * hand-edited value, a salsa clave on a bachata row), a popup always gets a
 * config it can play. A throw here would be a popup that cannot open.
 */
import {
	CLAVE_PATTERNS,
	COUNT_PATTERN_LABEL,
	SPEEDS,
	type ClavePattern,
	type CountPattern,
	type Speed
} from '$lib/labels';
import type { Dance } from '$lib/dances/dances';

/** How often "call on cue" names the figure, in 8-counts. */
export const CUE_EVERY = [2, 4] as const;
export type CueEvery = (typeof CUE_EVERY)[number];

export interface PracticeConfig {
	count: CountPattern;
	clave: ClavePattern | null;
	speed: Speed;
	callEvery: CueEvery | null;
}

export interface PracticeInput {
	mode: 'count' | 'song';
	songId: number | null;
	countBpm: number | null;
	config: PracticeConfig;
}

/** The count-only tempo when an exercise has never been practised: the player's own default. */
export const DEFAULT_PRACTICE_BPM = 180;

export function defaultPracticeConfig(dance: Dance): PracticeConfig {
	return { count: dance.defaultCountPattern, clave: null, speed: 1, callEvery: null };
}

function oneOf<T>(value: unknown, allowed: readonly T[], fallback: T): T {
	return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

function configFrom(value: unknown, dance: Dance): PracticeConfig {
	const d = defaultPracticeConfig(dance);
	if (!value || typeof value !== 'object' || Array.isArray(value)) return d;
	const v = value as Record<string, unknown>;
	return {
		count: oneOf(v.count, dance.countPatterns, d.count),
		// A dance without clave never gets one back, whatever was stored.
		clave: dance.clave ? oneOf(v.clave, [...CLAVE_PATTERNS, null], null) : null,
		speed: oneOf(v.speed, SPEEDS, d.speed),
		callEvery: oneOf(v.callEvery, [...CUE_EVERY, null], null)
	};
}

export function parsePracticeConfig(raw: string | null, dance: Dance): PracticeConfig {
	if (!raw) return defaultPracticeConfig(dance);
	try {
		return configFrom(JSON.parse(raw), dance);
	} catch {
		return defaultPracticeConfig(dance);
	}
}

const isInt = (v: unknown, min: number, max: number): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/**
 * The panel's POST body, or null. Unlike the config, the mode and its pairing
 * are NOT made total: a body that names song mode without a song is a bug to
 * refuse, not a value to guess at. The unused half of the pair is cleared, the
 * rule `updateExercise` used to enforce for the settings form.
 */
export function parsePracticeInput(body: unknown, dance: Dance): PracticeInput | null {
	if (!body || typeof body !== 'object') return null;
	const b = body as Record<string, unknown>;
	const config = configFrom(b.config, dance);
	if (b.mode === 'count' && isInt(b.countBpm, 60, 300)) {
		return { mode: 'count', songId: null, countBpm: b.countBpm, config };
	}
	if (b.mode === 'song' && isInt(b.songId, 1, Number.MAX_SAFE_INTEGER)) {
		return { mode: 'song', songId: b.songId, countBpm: null, config };
	}
	return null;
}

/** The panel's one collapsed line: "Count 180 · 2 3 4 · 6 7 8 · clave 2-3". */
export function practiceSummary(
	p: { mode: 'count' | 'song'; bpm: number; songTitle: string | null; config: PracticeConfig },
	dance: Dance
): string {
	const parts = [
		p.mode === 'song' && p.songTitle !== null
			? `${p.songTitle}${p.config.speed === 1 ? '' : ` ${p.config.speed}×`}`
			: `Count ${p.bpm}`,
		COUNT_PATTERN_LABEL[p.config.count]
	];
	if (dance.clave && p.config.clave) parts.push(`clave ${p.config.clave}`);
	if (p.config.callEvery) parts.push(`call every ${p.config.callEvery}`);
	return parts.join(' · ');
}

/**
 * 8-counts in an hour at `bpm`. The player page's 400 bars is about eighteen
 * minutes at 180, and a count-only practice that stops by itself mid-session
 * reads as a bug.
 */
export const hourOfBars = (bpm: number) => Math.ceil((bpm * 60) / 8);

/** Seconds as the whole minutes the form shows — never 0, since you did practise. */
export const minutesFrom = (seconds: number) => Math.max(1, Math.round(seconds / 60));
