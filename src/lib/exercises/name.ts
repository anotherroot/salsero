/**
 * An exercise's name as drawn. A lesson's own exercise is stored as
 * `Review: <title>` (`reviewName`, `src/lib/server/lessons.ts`, kept in step
 * with the lesson's title) and drawn in the reader's language; every other name
 * is a person's own words, never translated. PURE, client-safe.
 */
import { t } from '$lib/i18n/catalog';

/** The stored prefix of a lesson's own exercise: always English, whoever's it is. */
export const REVIEW_PREFIX = 'Review: ';

export function shownExercise<E extends { name: string; source: string }>(e: E): E {
	if (e.source !== 'lesson' || !e.name.startsWith(REVIEW_PREFIX)) return e;
	return { ...e, name: t().today.reviewOf(e.name.slice(REVIEW_PREFIX.length)) };
}
