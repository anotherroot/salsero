/**
 * The round's score, 0–100 (agreed with the user 2026-11-11; it may change).
 * Per drop: timing (on time 1, close 0.7), times what the count keeps (spec
 * 1c.3: 4 off 50 %, 2 off 25 %, 1 off 10 %), less 15 % for each start-over,
 * less 5 % for each eight of listening beyond two; the round is the average.
 * PURE. Spec: docs/superpowers/specs/2026-11-10-hearing-drills-design.md, "Phase 1b", 5.
 */
import { countKeep } from './drops';

export const CLOSE_WEIGHT = 0.7;
export const RESTART_KEEP = 0.85;
export const LISTEN_KEEP = 0.95;
export const FREE_LISTEN_EIGHTS = 2;

/** All in points; `score = timing − countLoss − restartsLoss − listenLoss`. */
export interface DropScore {
	score: number;
	timing: number;
	restartsLoss: number;
	listenLoss: number;
	countLoss: number;
}

const NOTHING: DropScore = { score: 0, timing: 0, restartsLoss: 0, listenLoss: 0, countLoss: 0 };

export function scoreDrop(d: {
	spot: number;
	close: number;
	of: number;
	restarts: number;
	listenEights: number;
	skipped: boolean;
	/** How many counts the person's count was off. */
	shift: number;
}): DropScore {
	if (d.skipped || d.of <= 0) return { ...NOTHING };
	const timing = ((d.spot + CLOSE_WEIGHT * d.close) / d.of) * 100;
	const ck = countKeep(d.shift);
	const rk = Math.pow(RESTART_KEEP, d.restarts);
	const lk = Math.pow(LISTEN_KEEP, Math.max(0, d.listenEights - FREE_LISTEN_EIGHTS));
	return {
		score: timing * ck * rk * lk,
		timing,
		countLoss: timing * (1 - ck),
		restartsLoss: timing * ck * (1 - rk),
		listenLoss: timing * ck * rk * (1 - lk)
	};
}

/** The drops' average, each part rounded. */
export function roundScore(drops: DropScore[]): DropScore {
	if (drops.length === 0) return { ...NOTHING };
	const avg = (k: keyof DropScore) =>
		Math.round(drops.reduce((s, d) => s + d[k], 0) / drops.length);
	return {
		score: avg('score'),
		timing: avg('timing'),
		restartsLoss: avg('restartsLoss'),
		listenLoss: avg('listenLoss'),
		countLoss: avg('countLoss')
	};
}

/** The shift seen in most drops (not 0), for the result's verdict; null when every drop was on the count. */
export function commonShift(shifts: number[]): { shift: number; drops: number } | null {
	const tally = new Map<number, number>();
	for (const s of shifts) if (s !== 0) tally.set(s, (tally.get(s) ?? 0) + 1);
	let best: { shift: number; drops: number } | null = null;
	for (const [shift, drops] of tally) if (!best || drops > best.drops) best = { shift, drops };
	return best;
}
