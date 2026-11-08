/**
 * A session walks Today's exercises page by page, not popup by popup: the
 * warm-ups not done today in their list order, then the practice to-do rows,
 * then the practice picked ones. PURE: no state lives on the server — the run
 * is a URL flag plus the page's own rows, so "next" is recomputed from them
 * after every refresh. The logged exercise is a done row by then, which is why
 * the first remaining row of the walk is the answer.
 */
export type Walkable = {
	exercise: { id: number };
	kind: 'done' | 'todo' | 'picked';
	list?: 'warmup' | 'practice';
};

/**
 * Warm-ups not done (todo, picked) in the given order, then practice todo, then
 * practice picked. No `list` = practice.
 */
export function sessionWalk<R extends Walkable>(rows: readonly R[]): R[] {
	const warm = rows.filter((r) => r.list === 'warmup' && r.kind !== 'done');
	const practice = rows.filter((r) => r.list !== 'warmup');
	return [
		...warm,
		...practice.filter((r) => r.kind === 'todo'),
		...practice.filter((r) => r.kind === 'picked')
	];
}

/** The first of the walk that is neither open nor skipped. */
export function nextInSession<R extends { exercise: { id: number } }>(
	walk: readonly R[],
	skipped: ReadonlySet<number>,
	current: number | null
): R | null {
	return walk.find((r) => r.exercise.id !== current && !skipped.has(r.exercise.id)) ?? null;
}
