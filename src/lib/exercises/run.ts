/**
 * The run: Start on Today walks the day's exercises one page after another.
 * Nothing about it is stored — it is `?run=1&skip=<ids>` on an exercise page
 * plus Today's rows, so a reload keeps it. PURE, client-safe.
 */
import { nextInSession, sessionWalk, type Walkable } from './session';

export interface RunState {
	skip: number[];
}
export interface RunPlace {
	at: number;
	of: number;
}

const MAX_SKIPS = 50;

/** `?run=1` → { skip: parseSkip(skip) }; anything else → null. */
export function runOf(search: URLSearchParams): RunState | null {
	return search.get('run') === '1' ? { skip: parseSkip(search.get('skip')) } : null;
}

/** Total: "12,15" → [12, 15]; non-integers, ≤ 0 and repeats dropped; the first 50 kept; null → []. */
export function parseSkip(raw: string | null): number[] {
	if (!raw) return [];
	const ids: number[] = [];
	for (const part of raw.split(',')) {
		if (!/^\d+$/.test(part)) continue;
		const id = Number(part);
		if (!Number.isSafeInteger(id) || id <= 0 || ids.includes(id)) continue;
		ids.push(id);
		if (ids.length === MAX_SKIPS) break;
	}
	return ids;
}

function skipQuery(skip: readonly number[]): string {
	return skip.length > 0 ? `&skip=${skip.join(',')}` : '';
}

/** "/salsa/exercises/12?run=1&skip=3,5" (no skip when empty). */
export function runHref(dance: string, exerciseId: number, run: RunState): string {
	return `/${dance}/exercises/${exerciseId}?run=1${skipQuery(run.skip)}`;
}

/** "/salsa/done". */
export function doneHref(dance: string): string {
	return `/${dance}/done`;
}

/** A player link's `from` from a page: "from=run&skip=3,5" in a run (no skip when empty), else "from=exercise". */
export function playerFrom(run: RunState | null): string {
	return run ? `from=run${skipQuery(run.skip)}` : 'from=exercise';
}

/** `of` = day.total; `at` = done rows + walk rows in `skip` + 1, for a current in the walk and not skipped; else null. */
export function runPlace(
	day: { rows: readonly Walkable[]; total: number },
	skip: readonly number[],
	current: number
): RunPlace | null {
	const walk = sessionWalk(day.rows);
	if (!walk.some((r) => r.exercise.id === current) || skip.includes(current)) return null;
	const done = day.rows.filter((r) => r.kind === 'done').length;
	const skipped = walk.filter((r) => skip.includes(r.exercise.id)).length;
	return { at: done + skipped + 1, of: day.total };
}

export interface RunStep {
	place: RunPlace | null;
	next: { id: number; name: string } | null;
	skipHref: string;
	afterHref: string;
}

export function runStep(
	dance: string,
	day: { rows: readonly (Walkable & { exercise: { id: number; name: string } })[]; total: number },
	run: RunState,
	current: number
): RunStep {
	const walk = sessionWalk(day.rows);
	const found = nextInSession(walk, new Set(run.skip), current);
	const next = found ? { id: found.exercise.id, name: found.exercise.name } : null;
	return {
		place: runPlace(day, run.skip, current),
		next,
		skipHref: next
			? runHref(dance, next.id, {
					skip: run.skip.includes(current) ? run.skip : [...run.skip, current]
				})
			: doneHref(dance),
		afterHref: next ? runHref(dance, next.id, run) : doneHref(dance)
	};
}
