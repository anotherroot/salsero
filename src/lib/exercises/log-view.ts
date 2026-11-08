/**
 * The "Last time" line's parts. PURE, client-safe.
 */
import { lastDoneLabel } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import type { LastSet } from '$lib/types';

/** The "Last time" line's parts; null means "First time.". */
export function lastTimeParts(
	last: LastSet | null
): { when: string; rating: number | null; note: string | null } | null {
	if (!last) return null;
	return {
		when: t().exercise.log.lastTime(lastDoneLabel(last.daysAgo)),
		rating: last.rating,
		note: last.note
	};
}
