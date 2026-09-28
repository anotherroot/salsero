/**
 * A session walks Today's to-do list popup by popup. PURE: no state lives on
 * the server — the session is a URL flag plus the page's own bands, so "next"
 * is recomputed from them after every refresh. The logged exercise has moved
 * to Done today by then, which is why the first remaining row is the answer.
 */
export function nextInSession<R extends { exercise: { id: number } }>(
	due: R[],
	upcoming: R[],
	skipped: ReadonlySet<number>,
	current: number | null
): R | null {
	return (
		[...due, ...upcoming].find((r) => r.exercise.id !== current && !skipped.has(r.exercise.id)) ??
		null
	);
}

export function sessionSummary(count: number, seconds: number): string {
	if (count === 0) return 'Session done';
	const minutes = Math.round(seconds / 60);
	return `Session done — ${count} ${count === 1 ? 'exercise' : 'exercises'}${minutes > 0 ? `, ${minutes} min` : ''}`;
}
