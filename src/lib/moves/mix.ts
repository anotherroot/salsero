/**
 * A Moves list with the groups' rows mixed in among the person's own, as the
 * Lessons list mixes a group's lessons into the months: one list in the list's
 * own order, each group row carrying its group (`team`), the row's mark.
 * PURE, client-safe.
 */
import type { TeamRef } from '$lib/types';

/** A row with the group it is from: null for the person's own. */
export type Marked<R> = R & { team: TeamRef | null };

/**
 * The person's rows and each group's in one list, sorted by `order`. The sort
 * is stable, so rows `order` calls equal keep the person's first, then the
 * groups' in their order.
 */
export function mixGroups<R extends object>(
	mine: R[],
	groups: { team: TeamRef; rows: R[] }[],
	order: (a: R, b: R) => number
): Marked<R>[] {
	return [
		...mine.map((r) => ({ ...r, team: null })),
		...groups.flatMap((g) => g.rows.map((r) => ({ ...r, team: g.team })))
	].sort(order);
}

/** Newest first, as the Routines list reads (the load's order). */
export const newestFirst = (
	a: { createdAt: number; id: number },
	b: { createdAt: number; id: number }
): number => b.createdAt - a.createdAt || b.id - a.id;
