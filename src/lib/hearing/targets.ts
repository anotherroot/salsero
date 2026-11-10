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

export const TARGET_IDS = ['one', 'every', 'ones', 'odd', 'fourEight', 'clave'] as const;
export type TargetId = (typeof TARGET_IDS)[number];

const FIXED: Record<Exclude<TargetId, 'clave'>, number[]> = {
	every: [1, 2, 3, 4, 5, 6, 7, 8],
	one: [1],
	ones: [1, 5],
	odd: [1, 3, 5, 7],
	fourEight: [4, 8]
};

export function targetPositions(id: TargetId, clave: ClavePattern | null): number[] {
	if (id === 'clave') return [...CLAVE_POSITIONS[clave ?? '2-3']];
	return [...FIXED[id]];
}

/** The targets a dance offers, in the order the setup shows them: the clave only where the dance has one. */
export function targetsFor(dance: Pick<Dance, 'clave'>): TargetId[] {
	return TARGET_IDS.filter((id) => id !== 'clave' || dance.clave);
}

export function isTargetId(v: unknown): v is TargetId {
	return typeof v === 'string' && (TARGET_IDS as readonly string[]).includes(v);
}
