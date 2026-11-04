/** PURE, client-safe: the leave sheet's words, and the Lessons tab's mark on a kept copy. */
import { byteSize, plural } from '$lib/format';
import type { KeepPreview } from '$lib/types';

/** `1 GB`, not `1.0 GB`: the board says a whole gigabyte plainly. */
const size = (bytes: number) => byteSize(bytes).replace('.0 GB', ' GB');

export const leaveTitle = (team: string) => `Leave ${team}?`;
export const leaveSub =
	'After leaving you see nothing of the group. You keep copies of what you choose.';
export const reconnectNote = 'What you keep becomes your copies. Rejoin later and they reconnect.';
export const REMOVE_BODY = 'They leave the group and keep copies of what they had.';
export const COPY_CHIP = 'Copy';

export const chooseButton = (n: number) => `Leave and keep ${n}`;

/** Keep everything's meta: the counts (zeros left out) and what it charges. */
export function everythingMeta(p: KeepPreview): string {
	const parts = [
		[p.lessons.length, 'lesson', 'lessons'],
		[p.figures.length, 'figure', 'figures'],
		[p.routines.length, 'routine', 'routines'],
		[p.songs.length, 'song', 'songs']
	] as const;
	const counts = parts.filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many));
	if (counts.length === 0) return 'Nothing to keep';
	return `${counts.join(', ')} · ${size(p.allBytes)} counted to you`;
}

/** Keep only what my routines use: the figures (or more), and the routine that uses them. */
export function usedMeta(names: string[], routine: string | null): string {
	if (names.length === 0) return 'Nothing of yours uses it. Everything goes';
	const who = routine ? `${routine} uses` : 'your routines use';
	return `${names.join(' and ')}, which ${who}. Everything else goes`;
}

export function overLimitLine(limit: number): string {
	return `That takes you over your ${size(limit)}. You can still practise; new uploads wait until you’re under.`;
}

/** A locked row in Choose: what it is, and who needs it. */
export function lockedMeta(meta: string, by: 'routine' | 'lesson' | 'figure'): string {
	return meta ? `${meta} · used by your ${by}` : `Used by your ${by}`;
}

/** A kept copy's meta in the Lessons tab. */
export const copyMeta = (group: string) => `Your copy · from ${group}`;
