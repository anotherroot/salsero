/**
 * The fetch side of `POST /[dance]/exercises/[id]/practice`: remember what an
 * exercise was practised with, for next time. Used by the popup's panel and
 * the full player, both on Play. A convenience: a failure changes nothing, so
 * it is never awaited and never reported.
 */
import type { PracticeConfig } from './practice';

export function rememberPractice(
	danceSlug: string,
	exerciseId: number,
	p: {
		source: 'count' | 'song';
		songId: number | null;
		bpm: number;
		config: PracticeConfig;
	}
): void {
	void fetch(`/${danceSlug}/exercises/${exerciseId}/practice`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			mode: p.source,
			songId: p.source === 'song' ? p.songId : null,
			countBpm: p.source === 'count' ? p.bpm : null,
			config: p.config
		})
	}).catch(() => {});
}
