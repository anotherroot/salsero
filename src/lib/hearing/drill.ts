/**
 * A hearing drill's settings and the rounds a person played on it (spec
 * 2026-11-10, phase 2). PURE and client-safe.
 *
 * The settings live under their own key of the drill's `practice_json`
 * (`{ hearing: {...} }`), beside the practice panel's `{count, clave, speed}`,
 * which must survive every write here. A round is saved with the day's set,
 * appended to `player_json.hearing.rounds`, so a second Done the same day keeps
 * the first round.
 */
import { CLAVE_PATTERNS, type ClavePattern } from '$lib/labels';
import type { Feel } from '$lib/schedule/feel';
import type { FinishedDrop, RoundKind } from './round';
import { roundScore, scoreDrop } from './score';
import { isTargetId, ownCounts, type TargetId } from './targets';

export const HEARING_LENGTHS = [5, 10, 20] as const;
export type HearingLength = (typeof HEARING_LENGTHS)[number];

export interface HearingSettings {
	kind: RoundKind;
	target: TargetId;
	/** Only for the clave target. */
	clave?: ClavePattern;
	/** Only for the own target: the person's counts. */
	positions?: number[];
	/** Spots in a Dropped in round. */
	drops: HearingLength;
}

export const HEARING_DEFAULT: HearingSettings = { kind: 'dropped', target: 'one', drops: 10 };

/** One round as the set keeps it: what it ran with, and its score with the parts it lost. */
export interface HearingRound {
	kind: RoundKind;
	target: TargetId;
	clave?: ClavePattern;
	positions?: number[];
	/** How many drops the round had (a tap-along round: its eights). */
	drops: number;
	songIds: number[];
	score: number;
	timing: number;
	/** The parts lost (as `DropScore`'s losses): the count, restarts, listening. */
	count: number;
	restarts: number;
	listening: number;
	/** Played on settings changed for this round only (a class member's Spremeni). */
	changed: boolean;
}

const isKind = (v: unknown): v is RoundKind => v === 'dropped' || v === 'tapAlong';
const isClave = (v: unknown): v is ClavePattern =>
	(CLAVE_PATTERNS as readonly unknown[]).includes(v);
const isLength = (v: unknown): v is HearingLength =>
	(HEARING_LENGTHS as readonly unknown[]).includes(v);

function parseJson(raw: string | null): Record<string, unknown> {
	if (!raw) return {};
	try {
		const v: unknown = JSON.parse(raw);
		return v !== null && typeof v === 'object' && !Array.isArray(v)
			? (v as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

/** Settings from anything: a bad field takes its default; the extras only with their target. */
function settingsOf(v: unknown): HearingSettings {
	const o = v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
	const s: HearingSettings = {
		kind: isKind(o.kind) ? o.kind : HEARING_DEFAULT.kind,
		target: isTargetId(o.target) ? o.target : HEARING_DEFAULT.target,
		drops: isLength(o.drops) ? o.drops : HEARING_DEFAULT.drops
	};
	if (s.target === 'clave') s.clave = isClave(o.clave) ? o.clave : '2-3';
	if (s.target === 'own') {
		const own = Array.isArray(o.positions) ? ownCounts(o.positions) : [];
		s.positions = own.length ? own : [3];
	}
	return s;
}

/** The drill's settings from its `practice_json` (none, or junk: the default). */
export function hearingOf(practiceJson: string | null): HearingSettings {
	const o = parseJson(practiceJson);
	return o.hearing === undefined ? { ...HEARING_DEFAULT } : settingsOf(o.hearing);
}

/** `practice_json` with these settings under `hearing`, every other key kept. */
export function withHearing(practiceJson: string | null, s: HearingSettings): string {
	return JSON.stringify({ ...parseJson(practiceJson), hearing: settingsOf(s) });
}

const isScore = (v: unknown): v is number =>
	typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;

/** A posted or stored round, or null when it is not one. */
export function parseRound(raw: unknown): HearingRound | null {
	if (raw === null || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	if (!isKind(o.kind) || !isTargetId(o.target)) return null;
	if (!Number.isInteger(o.drops) || (o.drops as number) < 0) return null;
	if (!Array.isArray(o.songIds) || !o.songIds.every((id) => Number.isInteger(id))) return null;
	for (const k of ['score', 'timing', 'count', 'restarts', 'listening'] as const)
		if (!isScore(o[k])) return null;
	if (typeof o.changed !== 'boolean') return null;
	const r: HearingRound = {
		kind: o.kind,
		target: o.target,
		drops: o.drops as number,
		songIds: o.songIds as number[],
		score: o.score as number,
		timing: o.timing as number,
		count: o.count as number,
		restarts: o.restarts as number,
		listening: o.listening as number,
		changed: o.changed
	};
	if (o.target === 'clave' && isClave(o.clave)) r.clave = o.clave;
	if (o.target === 'own' && Array.isArray(o.positions)) r.positions = ownCounts(o.positions);
	return r;
}

/** The set's rounds, oldest first (none, or junk: none). */
export function roundsOf(playerJson: string | null): HearingRound[] {
	const h = parseJson(playerJson).hearing as { rounds?: unknown } | undefined;
	if (!h || !Array.isArray(h.rounds)) return [];
	return h.rounds.map(parseRound).filter((r): r is HearingRound => r !== null);
}

/** The set's `player_json` with one more round; what else it held stays. */
export function appendRound(playerJson: string | null, round: HearingRound): string {
	const o = parseJson(playerJson);
	return JSON.stringify({ ...o, hearing: { rounds: [...roundsOf(playerJson), round] } });
}

/**
 * "Vaši krogi": the rounds on the drill's own settings (a round changed for once
 * is left out), oldest first; `before` is the round before the last.
 */
export function roundsLine(rounds: readonly HearingRound[]): {
	count: number;
	last: number | null;
	before: number | null;
	scores: number[];
} {
	const scores = rounds.filter((r) => !r.changed).map((r) => r.score);
	return {
		count: scores.length,
		last: scores.at(-1) ?? null,
		before: scores.length > 1 ? scores[scores.length - 2] : null,
		scores
	};
}

/** The face a score suggests (spec 8): only a suggestion, the person taps the face. */
export function suggestFeel(score: number): Feel {
	if (score < 50) return 'hard';
	if (score < 75) return 'getting';
	if (score < 90) return 'gotit';
	return 'easy';
}

/** The settings as a link's query (the drill's round with Spremeni's changes). */
export function settingsQuery(s: HearingSettings): string {
	const q = new URLSearchParams({ kind: s.kind, target: s.target, drops: String(s.drops) });
	if (s.clave) q.set('clave', s.clave);
	if (s.positions) q.set('positions', s.positions.join(','));
	return q.toString();
}

/** A round's settings: the drill's, with what the link changes; `changed` when they differ. */
export function settingsFrom(
	params: URLSearchParams,
	base: HearingSettings
): { settings: HearingSettings; changed: boolean } {
	const pick = <T>(k: string, ok: (v: unknown) => v is T, fallback: T | undefined) => {
		const v = params.get(k);
		const n = v !== null && /^\d+$/.test(v) ? Number(v) : v;
		return ok(n) ? n : fallback;
	};
	const positions = params.get('positions');
	const settings = settingsOf({
		kind: pick('kind', isKind, base.kind),
		target: pick('target', isTargetId, base.target),
		drops: pick('drops', isLength, base.drops),
		clave: pick('clave', isClave, base.clave),
		positions: positions === null ? base.positions : positions.split(',').map(Number)
	});
	return { settings, changed: JSON.stringify(settings) !== JSON.stringify(settingsOf(base)) };
}

/** The practice panel's new `practice_json` with the old one's hearing settings kept, if it had any. */
export function keepHearing(old: string | null, next: string): string {
	const before = parseJson(old);
	return before.hearing === undefined ? next : withHearing(next, settingsOf(before.hearing));
}

/**
 * What Done saves of a finished round: its score and the parts it lost
 * (`scoreDrop`, `roundScore`, as result B shows them), what it ran with, and
 * the songs its drops were in (`songIds` by the drops' `song` index).
 */
export function hearingRound(
	drops: readonly FinishedDrop[],
	s: Pick<HearingSettings, 'kind' | 'target' | 'clave' | 'positions'> & { drops?: number },
	songIds: readonly number[],
	changed: boolean
): HearingRound {
	const total = roundScore(
		drops.map((d) =>
			scoreDrop({
				spot: d.answer.spot,
				close: d.answer.close,
				of: d.answer.of,
				restarts: d.restarts,
				listenEights: d.listenEights,
				skipped: d.skipped,
				shift: d.skipped ? 0 : d.answer.shift
			})
		)
	);
	const round: HearingRound = {
		kind: s.kind,
		target: s.target,
		drops: drops.length,
		songIds: [...new Set(drops.map((d) => songIds[d.song ?? 0]).filter((id) => id !== undefined))],
		score: total.score,
		timing: total.timing,
		count: total.countLoss,
		restarts: total.restartsLoss,
		listening: total.listenLoss,
		changed
	};
	if (s.target === 'clave' && s.clave) round.clave = s.clave;
	if (s.target === 'own' && s.positions) round.positions = [...s.positions];
	return round;
}
