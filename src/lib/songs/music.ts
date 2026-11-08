/**
 * PURE, client-safe: a Music list's words and where "Practise to this" goes
 * (spec B). A routine's practice keeps the person's entry; a drill's opens
 * on the person's own exercise; a lesson's is the song alone.
 */
import { t } from '$lib/i18n/catalog';

/** The Music list's words, in the current language. */
export function music() {
	return t().songs.music;
}

export type PractiseAt =
	{ routineId: number; entryId: number | null } | { drillEntryId: number } | { lesson: true };

/** The player opened with `songId`, from a routine, a drill or a lesson. */
export function practiseHref(dance: string, at: PractiseAt, songId: number): string {
	const q = new URLSearchParams();
	if ('routineId' in at) {
		q.set('routine', String(at.routineId));
		if (at.entryId !== null) q.set('exercise', String(at.entryId));
	} else if ('drillEntryId' in at) {
		q.set('exercise', String(at.drillEntryId));
	}
	q.set('song', String(songId));
	return `/${dance}/player?${q}`;
}
