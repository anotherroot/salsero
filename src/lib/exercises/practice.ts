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
import { t } from '$lib/i18n/catalog';

export interface PracticeConfig {
	count: CountPattern;
	clave: ClavePattern | null;
	speed: Speed;
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
	return { count: dance.defaultCountPattern, clave: null, speed: 1 };
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
		speed: oneOf(v.speed, SPEEDS, d.speed)
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

/**
 * What an exercise remembers, as the endpoint stores it (`parsePracticeInput`'s
 * shape: the unused half of the pair cleared, the config made total). Null
 * when nothing is remembered (`none`).
 */
export function practiceOf(
	row: {
		practiceMode: string;
		songId: number | null;
		countBpm: number | null;
		practiceJson: string | null;
	},
	dance: Dance
): PracticeInput | null {
	const config = parsePracticeConfig(row.practiceJson, dance);
	if (row.practiceMode === 'count') {
		return { mode: 'count', songId: null, countBpm: row.countBpm, config };
	}
	if (row.practiceMode === 'song')
		return { mode: 'song', songId: row.songId, countBpm: null, config };
	return null;
}

const sameConfig = (a: PracticeConfig, b: PracticeConfig) =>
	a.count === b.count && a.clave === b.clave && a.speed === b.speed;

/**
 * What Play should remember, or null when it is what the page already knew
 * (`known`: what it loaded, or what it last posted). Posting only a change
 * keeps a stale page from writing back a practice that came in while it was
 * open (Keep in step flows a drill's practice).
 */
export function practiceToPost(
	known: PracticeInput | null,
	p: { source: 'count' | 'song'; songId: number | null; bpm: number; config: PracticeConfig }
): PracticeInput | null {
	const next: PracticeInput = {
		mode: p.source,
		songId: p.source === 'song' ? p.songId : null,
		countBpm: p.source === 'count' ? p.bpm : null,
		config: { ...p.config }
	};
	const same =
		known !== null &&
		known.mode === next.mode &&
		known.songId === next.songId &&
		known.countBpm === next.countBpm &&
		sameConfig(known.config, next.config);
	return same ? null : next;
}

export interface PracticeStart {
	source: 'count' | 'song';
	/** The picker's song: the one to play, or the first ready one for when "A song" is tapped. */
	songId: number | null;
	/** The remembered song can no longer be played, so this opens on the count instead. */
	songGone: boolean;
}

/**
 * Where a practice opens, for the panel and the full player alike: a song
 * someone asked for (the player's `?song=`), else the exercise's remembered
 * song while it is still ready, else the count. A remembered song can stop
 * being playable — archived, or re-analysed and failed — between one practice
 * and the next; then this opens on the count and says so, rather than failing
 * at Play.
 */
export function practiceStart(
	remembered: { practiceMode: string; songId: number | null } | null,
	readyIds: readonly number[],
	requested: number | null = null
): PracticeStart {
	const songGone =
		remembered?.practiceMode === 'song' &&
		(remembered.songId === null || !readyIds.includes(remembered.songId));
	const wanted =
		requested !== null && readyIds.includes(requested)
			? requested
			: remembered?.practiceMode === 'song' && !songGone
				? remembered.songId
				: null;
	return {
		source: wanted === null ? 'count' : 'song',
		songId: wanted ?? readyIds[0] ?? null,
		songGone: wanted === null && songGone
	};
}

/**
 * What this phone last practised with, from its browser store (`phone-practice.ts`).
 * Every field proves itself; null is "nothing usable here". `clave` keeps a
 * third state: `undefined` is nothing stored, `null` is clave off.
 */
export interface PhonePractice {
	bpm: number | null;
	count: CountPattern | null;
	clave: ClavePattern | null | undefined;
	speed: Speed | null;
	voiceVolume: number | null;
}

export function parsePhonePractice(stored: unknown, dance: Dance): PhonePractice {
	const v =
		stored && typeof stored === 'object' && !Array.isArray(stored)
			? (stored as Record<string, unknown>)
			: {};
	const num = (x: unknown, min: number, max: number) =>
		typeof x === 'number' && x >= min && x <= max ? x : null;
	// `true` and `false` are what a store written before count patterns held.
	const count = v.count === true ? 'salsa' : v.count === false ? 'off' : v.count;
	return {
		bpm: num(v.bpm, 60, 300),
		count: oneOf<CountPattern | null>(count, dance.countPatterns, null),
		// A dance without clave never gets one back: the store is per browser.
		clave: !dance.clave
			? null
			: 'clave' in v
				? oneOf<ClavePattern | null | undefined>(v.clave, [...CLAVE_PATTERNS, null], undefined)
				: undefined,
		speed: oneOf<Speed | null>(v.speed, SPEEDS, null),
		voiceVolume: num(v.voiceVolume, 0, 1)
	};
}

export interface PracticeSeed {
	bpm: number;
	count: CountPattern;
	clave: ClavePattern | null;
	speed: Speed;
}

/**
 * Where a practice's settings start: the exercise's own memory when it has one
 * (`practiceOf`), else what this phone last used, else the defaults. The full
 * player and the panel both start here, so the two never disagree.
 */
export function practiceSeed(
	remembered: PracticeInput | null,
	phone: PhonePractice,
	dance: Dance,
	defaultBpm: number
): PracticeSeed {
	const d = defaultPracticeConfig(dance);
	const c = remembered?.config ?? null;
	return {
		bpm: remembered?.countBpm ?? phone.bpm ?? defaultBpm,
		count: c?.count ?? phone.count ?? d.count,
		clave: !dance.clave ? null : c ? c.clave : (phone.clave ?? null),
		speed: c?.speed ?? phone.speed ?? d.speed
	};
}

/**
 * The panel's one collapsed line: "Count 180 · 2 3 4 · 6 7 8 · clave 2-3". A
 * routine's view (Follow or Still) comes after the song: "BAILE · Follow · Off".
 */
export function practiceSummary(
	p: {
		mode: 'count' | 'song';
		bpm: number;
		songTitle: string | null;
		config: PracticeConfig;
		view?: string | null;
	},
	dance: Dance
): string {
	const w = t().exercise.panel;
	const parts = [
		p.mode === 'song' && p.songTitle !== null
			? `${p.songTitle}${p.config.speed === 1 ? '' : ` ${w.speed(p.config.speed)}`}`
			: w.summaryCount(p.bpm),
		...(p.view ? [p.view] : []),
		p.config.count === 'off' ? w.summaryNoCount : COUNT_PATTERN_LABEL[p.config.count]
	];
	if (dance.clave && p.config.clave) parts.push(w.summaryClave(p.config.clave));
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

/**
 * The exercise page's Practise with line: what the player will open with for
 * this exercise — its own memory, else this phone's, else the defaults (as
 * Setup seeds it), and a remembered song only while it is still there.
 */
export function practiseWithLine(
	row: {
		practiceMode: string;
		songId: number | null;
		countBpm: number | null;
		practiceJson: string | null;
	},
	songs: readonly { id: number; title: string }[],
	phone: PhonePractice,
	dance: Dance,
	view: string | null = null
): string {
	const start = practiceStart(
		row,
		songs.map((s) => s.id)
	);
	const seed = practiceSeed(practiceOf(row, dance), phone, dance, DEFAULT_PRACTICE_BPM);
	return practiceSummary(
		{
			mode: start.source,
			bpm: seed.bpm,
			songTitle: songs.find((s) => s.id === start.songId)?.title ?? null,
			config: { count: seed.count, clave: seed.clave, speed: seed.speed },
			view
		},
		dance
	);
}
