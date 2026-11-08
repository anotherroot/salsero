/**
 * The fetch side of `POST /[dance]/exercises/[id]/practice`: remember what an
 * exercise was practised with, for next time. Used by the exercise page's panel and
 * the full player, both on Play. A convenience: a failure changes nothing, so
 * it is never awaited and never reported: a background write, not sent offline
 * and never "Needs a connection" (`backgroundWrite`).
 */
import { backgroundWrite } from '$lib/offline/background-write';
import { practiceToPost, type PracticeConfig, type PracticeInput } from './practice';

/**
 * Posts only what differs from `known` (what the page loaded, or last posted:
 * `practiceOf`), and answers what the page knows now: the posted value, or
 * `known` when nothing was sent. A stale page then never writes back a
 * practice that came in while it was open.
 */
export function rememberPractice(
	danceSlug: string,
	exerciseId: number,
	p: {
		source: 'count' | 'song';
		songId: number | null;
		bpm: number;
		config: PracticeConfig;
	},
	known: PracticeInput | null
): PracticeInput | null {
	const next = practiceToPost(known, p);
	if (next === null) return known;
	backgroundWrite(`/${danceSlug}/exercises/${exerciseId}/practice`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(next)
	});
	return next;
}
