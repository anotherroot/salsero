/**
 * My count's tempo grid: which of the 3 patterns x 7 tempos are recorded.
 * PURE and client-safe. A tempo is done when both half-bar phrases exist.
 */
import {
	COUNT_PATTERN_LABEL,
	PHRASE_PATTERNS,
	TEMPO_LADDER,
	type CountPattern,
	type PhrasePattern
} from '$lib/labels';
import { phraseCounts } from '$lib/scheduler/scheduler';
import { t } from '$lib/i18n/catalog';

export interface TakeKey {
	id: number;
	pattern: CountPattern;
	bpm: number;
	phrase: 'a' | 'b';
}

export type TempoState = { state: 'done' } | { state: 'half'; half: 'a' | 'b' } | { state: 'none' };

export function tempoState(
	takes: readonly TakeKey[],
	pattern: PhrasePattern,
	bpm: number
): TempoState {
	const has = (phrase: 'a' | 'b') =>
		takes.some((t) => t.pattern === pattern && t.bpm === bpm && t.phrase === phrase);
	const a = has('a');
	const b = has('b');
	if (a && b) return { state: 'done' };
	if (a) return { state: 'half', half: 'a' };
	if (b) return { state: 'half', half: 'b' };
	return { state: 'none' };
}

/** `2 of 21 tempos in your own voice`; a half does not count. */
export function ownVoiceSummary(takes: readonly TakeKey[]): string {
	let done = 0;
	for (const p of PHRASE_PATTERNS)
		for (const bpm of TEMPO_LADDER) if (tempoState(takes, p, bpm).state === 'done') done++;
	return t().settings.voice.ownVoice(done, PHRASE_PATTERNS.length * TEMPO_LADDER.length);
}

const counts = (pattern: PhrasePattern, half: 'a' | 'b') => phraseCounts(pattern, half).join(' ');

/** A tempo row's second line and how it is coloured. */
export function tempoMeta(
	s: TempoState,
	pattern: PhrasePattern
): { text: string; tone: 'done' | 'status' | 'muted' } {
	const w = t().settings.voice;
	if (s.state === 'done') return { text: w.recorded, tone: 'done' };
	if (s.state === 'half') return { text: w.halfRecorded(counts(pattern, s.half)), tone: 'status' };
	return { text: w.notRecorded, tone: 'muted' };
}

/** `Tempos · 3 of 7 recorded`; a half does not count. */
export function recordedLabel(takes: readonly TakeKey[], pattern: PhrasePattern): string {
	const done = TEMPO_LADDER.filter((bpm) => tempoState(takes, pattern, bpm).state === 'done');
	return t().settings.voice.temposRecorded(done.length, TEMPO_LADDER.length);
}

/** The pattern's takes, bpm then phrase order, as the "Recorded takes" rows. */
export function takeRows(
	takes: readonly TakeKey[],
	pattern: PhrasePattern
): { id: number; title: string; meta: string; deleteLabel: string; deleted: string }[] {
	const w = t().settings.voice;
	return takes
		.filter((t) => t.pattern === pattern)
		.sort((x, y) => x.bpm - y.bpm || x.phrase.localeCompare(y.phrase))
		.map((t) => {
			const title = w.takeTitle(t.bpm, counts(pattern, t.phrase));
			const letter = t.phrase.toUpperCase();
			return {
				id: t.id,
				title,
				meta: w.takeMeta(COUNT_PATTERN_LABEL[pattern], letter),
				deleteLabel: w.deleteLabel(t.bpm, letter),
				deleted: w.deleted(title)
			};
		});
}

/** The toast after Keep: which halves landed. */
export function keptMessage(
	bpm: number,
	halves: readonly ('a' | 'b')[],
	pattern: PhrasePattern
): string {
	const w = t().settings.voice;
	if (halves.length >= 2) return w.keptBoth(bpm);
	return w.kept(counts(pattern, halves[0] ?? 'a'), bpm);
}
