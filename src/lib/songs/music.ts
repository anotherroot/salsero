/**
 * PURE, client-safe: a Music list's words and where "Practise to this" goes
 * (spec B). A routine's practice keeps the person's entry; a drill's opens
 * on the person's own exercise; a lesson's is the song alone.
 */

export const MUSIC = {
	heading: 'Music',
	add: 'Add a song',
	noteLabel: 'Note',
	notePlaceholder: 'What to practise to it',
	noteHelp: 'Members see it under the song.',
	addButton: 'Add to Music',
	save: 'Save',
	practise: 'Practise to this',
	edit: 'Edit note',
	remove: 'Remove',
	notShared: 'Not shared',
	pick: 'Pick a song'
} as const;

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
