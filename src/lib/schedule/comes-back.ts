/**
 * "Comes back": how a drill returns to Today. By the faces (the default), on a
 * fixed rhythm, or every day until it has felt good a few times. PURE.
 */
import { t } from '$lib/i18n/catalog';
import type { Source } from '$lib/labels';

export type ComesBack =
	| { kind: 'faces' }
	| { kind: 'until'; good: 3 | 5; since: number } // since: epoch ms the switch went on
	| { kind: 'every'; days: 1 | 2 | 3 | 7 };

export const FACES: ComesBack = { kind: 'faces' };

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

/** Total: null, junk, an unknown kind or out-of-range numbers give null (= not set). */
export function parseComesBack(raw: string | null | undefined): ComesBack | null {
	if (!raw) return null;
	let v: unknown;
	try {
		v = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!isRecord(v)) return null;
	switch (v.kind) {
		case 'faces':
			return FACES;
		case 'every':
			return v.days === 1 || v.days === 2 || v.days === 3 || v.days === 7
				? { kind: 'every', days: v.days }
				: null;
		case 'until':
			return (v.good === 3 || v.good === 5) &&
				typeof v.since === 'number' &&
				Number.isFinite(v.since)
				? { kind: 'until', good: v.good, since: v.since }
				: null;
		default:
			return null;
	}
}

export const serializeComesBack = (c: ComesBack): string => JSON.stringify(c);

/** Only drills have it: other sources are FACES. Own wins, else the class drill's (entries), else FACES. */
export function effectiveComesBack(
	source: Source,
	own: ComesBack | null,
	drill: ComesBack | null
): ComesBack {
	if (source !== 'custom' && source !== 'added') return FACES;
	return own ?? drill ?? FACES;
}

/** "Every day", "Every 2 days", "Every 3 days", "Weekly" (`t().exercise.comesBack`). */
export function rhythmWords(days: 1 | 2 | 3 | 7): string {
	return t().exercise.comesBack.rhythm(days);
}

/** A learning drill's line on Today and in Coming up: "Learning · 2 of 3 good days". */
export function learningWords(learning: { good: number; of: 3 | 5 }): string {
	return t().exercise.comesBack.learning(learning.good, learning.of);
}

/**
 * A setting in words: "By how it went", "Weekly", "Every day until it feels good on 3
 * days". In the current language; History and a copy's fields, still English, ask in
 * English (`withLocale('en', …)`).
 */
export function comesBackWords(c: ComesBack): string {
	const w = t().exercise.comesBack;
	if (c.kind === 'faces') return w.byFaces;
	if (c.kind === 'every') return rhythmWords(c.days);
	return w.untilWords(c.good);
}
