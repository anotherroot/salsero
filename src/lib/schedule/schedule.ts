/**
 * The Anki-style schedule: an exercise's gap, replayed from its sets, never
 * stored. PURE: the zone and `today` are arguments.
 */
import { daysBetween, localDay, shiftDay } from '$lib/day/day';
import { FEELS, feelOf, type Feel } from './feel';

/** The numbers, in one place. */
export const STEPS = {
	getting: { floor: 3, used: 1.2, earlyShare: 0.5 },
	gotit: { floor: 7, used: 2.5 },
	easy: { floor: 21, used: 4, gap: 1.3 },
	hardGap: 1,
	minGap: 1,
	maxGap: 365
} as const;

export interface ScheduleSet {
	doneAt: number;
	rating: number | null;
}

export interface ScheduleState {
	gap: number;
	lastDay: string | null;
	dueDay: string;
}

const clamp = (n: number) => Math.min(STEPS.maxGap, Math.max(STEPS.minGap, Math.round(n)));

/** The gap after a set done `e` calendar days after the previous one. */
export function nextGap(gap: number, e: number, feel: Feel | null): number {
	const used = Math.min(e, gap);
	switch (feel) {
		case 'hard':
			return clamp(STEPS.hardGap);
		case 'getting': {
			const base = Math.max(STEPS.getting.floor, used * STEPS.getting.used);
			return clamp(e < gap ? Math.max(base, gap * STEPS.getting.earlyShare) : base);
		}
		case 'gotit':
			return clamp(Math.max(STEPS.gotit.floor, used * STEPS.gotit.used, gap));
		case 'easy':
			return clamp(Math.max(STEPS.easy.floor, used * STEPS.easy.used, gap * STEPS.easy.gap));
		default:
			return clamp(gap);
	}
}

/**
 * Walk the sets in time order. `beforeDay` ignores sets on or after that local
 * day (the day's rows come from the start of the day).
 */
export function replay(
	startGap: number,
	createdAt: number,
	sets: ScheduleSet[],
	timeZone: string,
	beforeDay?: string
): ScheduleState {
	let gap = startGap;
	let lastDay: string | null = null;
	const ordered = [...sets].sort((a, b) => a.doneAt - b.doneAt);
	for (const s of ordered) {
		const day = localDay(s.doneAt, timeZone);
		if (beforeDay !== undefined && day >= beforeDay) continue;
		const e = lastDay === null ? 0 : daysBetween(lastDay, day);
		gap = nextGap(gap, e, feelOf(s.rating));
		lastDay = day;
	}
	return {
		gap,
		lastDay,
		dueDay: lastDay === null ? localDay(createdAt, timeZone) : shiftDay(lastDay, gap)
	};
}

export interface FacePreview {
	feel: Feel;
	gap: number;
}

/** What each face would set if it were logged today. */
export function preview(
	state: ScheduleState,
	today: string
): { faces: FacePreview[]; early: { lastDay: string; dueDay: string } | null } {
	const e = state.lastDay === null ? 0 : daysBetween(state.lastDay, today);
	return {
		faces: FEELS.map((feel) => ({ feel, gap: nextGap(state.gap, e, feel) })),
		early:
			state.lastDay !== null && e < state.gap
				? { lastDay: state.lastDay, dueDay: state.dueDay }
				: null
	};
}
