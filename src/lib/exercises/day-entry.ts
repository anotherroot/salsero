/** A day's rows of one exercise read as one entry. PURE, client-safe. */
export interface DayEntry {
	durationS: number | null;
	reps: number | null;
	rating: number | null;
	note: string | null;
}

/**
 * A day's rows as one: minutes and reps added (null when none has any), the last
 * rated face, notes joined " · " in time order. Rows in any order.
 */
export function mergeDay(
	rows: {
		doneAt: number;
		durationS: number | null;
		reps: number | null;
		rating: number | null;
		note: string | null;
	}[]
): DayEntry {
	const inOrder = [...rows].sort((a, b) => a.doneAt - b.doneAt);
	const sum = (pick: (r: (typeof rows)[number]) => number | null): number | null => {
		const parts = inOrder.map(pick).filter((n): n is number => n !== null);
		return parts.length === 0 ? null : parts.reduce((a, n) => a + n, 0);
	};
	const rated = inOrder.filter((r) => r.rating !== null);
	const notes = inOrder.map((r) => r.note).filter((n): n is string => n !== null && n !== '');
	return {
		durationS: sum((r) => r.durationS),
		reps: sum((r) => r.reps),
		rating: rated.length === 0 ? null : rated[rated.length - 1].rating,
		note: notes.length === 0 ? null : notes.join(' · ')
	};
}
