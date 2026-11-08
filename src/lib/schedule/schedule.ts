/**
 * The Anki-style schedule: an exercise's gap, replayed from its sets, never
 * stored. PURE: the zone and `today` are arguments.
 */
import { daysBetween, localDay, shiftDay } from '$lib/day/day';
import type { ComesBack } from './comes-back';
import { FEELS, feelOf, RATING_OF, type Feel } from './feel';

/** The numbers, in one place. */
export const STEPS = {
	getting: { floor: 2, used: 1.3, earlyShare: 0.5 },
	gotit: { floor: 3, used: 1.5 },
	easy: { floor: 7, used: 2, gap: 1.2 },
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
 * Walk the sets in time order, one review per local day: all sets of a day are
 * ONE review, felt as the day's last rated set (none if no set that day is
 * rated), `e` counted from the previous day that had sets. So logging twice, or
 * again after an Undo, never shrinks or inflates the gap. `beforeDay` ignores
 * sets on or after that local day (the day's rows come from the start of the day).
 */
export function replay(
	startGap: number,
	createdAt: number,
	sets: ScheduleSet[],
	timeZone: string,
	beforeDay?: string
): ScheduleState {
	const byDay = new Map<string, Feel | null>();
	const ordered = [...sets].sort((a, b) => a.doneAt - b.doneAt);
	for (const s of ordered) {
		const day = localDay(s.doneAt, timeZone);
		if (beforeDay !== undefined && day >= beforeDay) continue;
		const feel = feelOf(s.rating);
		byDay.set(day, feel ?? byDay.get(day) ?? null);
	}
	let gap = startGap;
	let lastDay: string | null = null;
	for (const day of [...byDay.keys()].sort()) {
		const e = lastDay === null ? 0 : daysBetween(lastDay, day);
		gap = nextGap(gap, e, byDay.get(day)!);
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

/**
 * What each face would set if it were logged today. `state` must be the
 * start-of-day state: callers pass `replay(..., today)` (`beforeDay: today`),
 * so today's own sets are not counted twice.
 */
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

/** The days with a set, and each day's last rating; `beforeDay` leaves out that day on. */
function ratedDays(sets: ScheduleSet[], timeZone: string, beforeDay?: string) {
	const days = new Set<string>();
	const lastRated = new Map<string, { doneAt: number; rating: number }>();
	for (const s of sets) {
		const day = localDay(s.doneAt, timeZone);
		if (beforeDay !== undefined && day >= beforeDay) continue;
		days.add(day);
		const prev = lastRated.get(day);
		if (s.rating !== null && (!prev || s.doneAt >= prev.doneAt))
			lastRated.set(day, { doneAt: s.doneAt, rating: s.rating });
	}
	return { days, lastRated };
}

function goodDays(
	lastRated: Map<string, { doneAt: number; rating: number }>,
	since: number,
	timeZone: string
): number {
	const from = localDay(since, timeZone);
	let good = 0;
	for (const [day, r] of lastRated) if (day >= from && r.rating >= RATING_OF.gotit) good++;
	return good;
}

/** Local days since `since` whose last set ended on I've got it or Easy: "2 of 3 so far". */
export function goodDaysSince(sets: ScheduleSet[], since: number, timeZone: string): number {
	return goodDays(ratedDays(sets, timeZone).lastRated, since, timeZone);
}

export interface DueState extends ScheduleState {
	every: 1 | 2 | 3 | 7 | null;
	/** Set only while still learning. */
	learning: { good: number; of: 3 | 5 } | null;
}

/**
 * The due day under a "Comes back" setting. Faces: `replay`. A fixed rhythm:
 * N days after the last day with a set, whatever the faces said. Until it
 * feels good: daily until `good` local days since the switch ended on I've got
 * it or Easy, then the faces take over. `beforeDay` leaves out that day on.
 */
export function scheduleOf(
	startGap: number,
	createdAt: number,
	sets: ScheduleSet[],
	comesBack: ComesBack,
	timeZone: string,
	beforeDay?: string
): DueState {
	const faces = replay(startGap, createdAt, sets, timeZone, beforeDay);
	if (comesBack.kind === 'faces') return { ...faces, every: null, learning: null };

	const { days, lastRated } = ratedDays(sets, timeZone, beforeDay);
	const lastDay = [...days].sort().at(-1) ?? null;
	const created = localDay(createdAt, timeZone);

	if (comesBack.kind === 'every') {
		return {
			gap: comesBack.days,
			lastDay,
			dueDay: lastDay === null ? created : shiftDay(lastDay, comesBack.days),
			every: comesBack.days,
			learning: null
		};
	}

	const good = goodDays(lastRated, comesBack.since, timeZone);
	if (good >= comesBack.good) return { ...faces, every: null, learning: null };
	return {
		gap: 1,
		lastDay,
		dueDay: lastDay === null ? created : shiftDay(lastDay, 1),
		every: null,
		learning: { good, of: comesBack.good }
	};
}
