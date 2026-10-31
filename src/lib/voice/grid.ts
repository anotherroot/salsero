/**
 * My count's tempo grid: which of the 3 patterns x 7 tempos are recorded.
 * PURE and client-safe. A tempo is done when both half-bar phrases exist.
 */
import { PHRASE_PATTERNS, TEMPO_LADDER, type CountPattern, type PhrasePattern } from '$lib/labels';

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
	return `${done} of ${PHRASE_PATTERNS.length * TEMPO_LADDER.length} tempos in your own voice`;
}
