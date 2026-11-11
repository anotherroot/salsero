/**
 * What a hearing round listens for. PURE and client-safe.
 *
 * A target is a set of positions in the eight, the same idea as the voice's
 * `COUNT_POSITIONS`: 1 is the 1, 2.5 the "and" of 2. A new target (2 · 6 for
 * On2, a conga's open tones) is one entry here. Spec:
 * docs/superpowers/specs/2026-11-10-hearing-drills-design.md, "Targets".
 */
import type { ClavePattern } from '$lib/labels';
import type { Dance } from '$lib/dances/dances';
import { CLAVE_POSITIONS } from '$lib/scheduler/scheduler';

export const TARGET_IDS = ['one', 'every', 'ones', 'odd', 'fourEight', 'clave', 'own'] as const;
export type TargetId = (typeof TARGET_IDS)[number];

const FIXED: Record<Exclude<TargetId, 'clave' | 'own'>, number[]> = {
	every: [1, 2, 3, 4, 5, 6, 7, 8],
	one: [1],
	ones: [1, 5],
	odd: [1, 3, 5, 7],
	fourEight: [4, 8]
};

/** `own`: the person's own counts, for the `own` target (`ownCounts` cleans them). */
export function targetPositions(
	id: TargetId,
	clave: ClavePattern | null,
	own: readonly number[] = []
): number[] {
	if (id === 'clave') return [...CLAVE_POSITIONS[clave ?? '2-3']];
	if (id === 'own') return ownCounts(own);
	return [...FIXED[id]];
}

/** The targets a dance offers, in the order the setup shows them: the clave only where the dance has one. */
export function targetsFor(dance: Pick<Dance, 'clave'>): TargetId[] {
	return TARGET_IDS.filter((id) => id !== 'clave' || dance.clave);
}

export function isTargetId(v: unknown): v is TargetId {
	return typeof v === 'string' && (TARGET_IDS as readonly string[]).includes(v);
}

/**
 * Targets named by their counts: the same in every language, so outside the
 * catalogs, like the voice's `COUNT_PATTERN_LABEL`.
 */
export const TARGET_DIGITS: Readonly<Partial<Record<TargetId, string>>> = {
	ones: '1 · 5',
	odd: '1 3 5 7',
	fourEight: '4 · 8'
};

/** Counts a person picks for their own target: whole counts 1–8, each once, in order. */
export function ownCounts(counts: readonly unknown[]): number[] {
	const ok = counts.filter(
		(c): c is number => Number.isInteger(c) && (c as number) >= 1 && (c as number) <= 8
	);
	return [...new Set(ok)].sort((a, b) => a - b);
}

/** The own target before anything is picked: the 3, a count nobody hears first. */
const OWN_DEFAULT = [3];
const OWN_KEY = 'hearing.ownCounts';

/** Stored own counts ("3,6,7"), or the 3 when there are none to read. */
export function parseOwnCounts(raw: string | null): number[] {
	const counts = ownCounts((raw ?? '').split(',').map((s) => (s.trim() === '' ? NaN : Number(s))));
	return counts.length ? counts : [...OWN_DEFAULT];
}

/** The own counts this browser last used; every storage access wrapped (private mode throws). */
export function loadOwnCounts(): number[] {
	try {
		return parseOwnCounts(localStorage.getItem(OWN_KEY));
	} catch {
		return [...OWN_DEFAULT];
	}
}

export function saveOwnCounts(counts: readonly number[]): void {
	try {
		localStorage.setItem(OWN_KEY, ownCounts(counts).join(','));
	} catch {
		// Private mode or storage full: the counts hold for this visit only.
	}
}
