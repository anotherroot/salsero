/**
 * The round's score, 0–100 (agreed with the user 2026-11-11; it may change).
 * Per drop: timing (on time 1, close 0.7), less 15 % for each start-over,
 * less 5 % for each eight of listening beyond two; the round is the average.
 * PURE. Spec: docs/superpowers/specs/2026-11-10-hearing-drills-design.md, "Phase 1b", 5.
 */

export const CLOSE_WEIGHT = 0.7;
export const RESTART_KEEP = 0.85;
export const LISTEN_KEEP = 0.95;
export const FREE_LISTEN_EIGHTS = 2;

/** All in points; `score = timing − restartsLoss − listenLoss`. */
export interface DropScore {
	score: number;
	timing: number;
	restartsLoss: number;
	listenLoss: number;
}

const NOTHING: DropScore = { score: 0, timing: 0, restartsLoss: 0, listenLoss: 0 };

export function scoreDrop(d: {
	spot: number;
	close: number;
	of: number;
	restarts: number;
	listenEights: number;
	skipped: boolean;
}): DropScore {
	if (d.skipped || d.of <= 0) return { ...NOTHING };
	const timing = ((d.spot + CLOSE_WEIGHT * d.close) / d.of) * 100;
	const rk = Math.pow(RESTART_KEEP, d.restarts);
	const lk = Math.pow(LISTEN_KEEP, Math.max(0, d.listenEights - FREE_LISTEN_EIGHTS));
	return {
		score: timing * rk * lk,
		timing,
		restartsLoss: timing * (1 - rk),
		listenLoss: timing * rk * (1 - lk)
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
		listenLoss: avg('listenLoss')
	};
}
