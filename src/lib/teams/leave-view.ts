/** PURE, client-safe: the leave sheet's words, and the Lessons tab's mark on a kept copy. */
import { byteSize } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import type { KeepPreview } from '$lib/types';

/** `1 GB`, not `1.0 GB` (`1,0 GB` in Slovenian): the board says a whole gigabyte plainly. */
const size = (bytes: number) => byteSize(bytes).replace(/[.,]0 GB$/, ' GB');

export const leaveTitle = (team: string) => t().groups.leave.title(team);
export const leaveSub = (): string => t().groups.leave.sub;
export const reconnectNote = (): string => t().groups.leave.reconnect;
export const removeBody = (): string => t().groups.people.removeBody;
export const copyChip = (): string => t().groups.leave.copyChip;

export const chooseButton = (n: number) => t().groups.leave.choose(n);

/** Keep everything's meta: the counts (zeros left out) and what it charges. */
export function everythingMeta(p: KeepPreview): string {
	const w = t().groups.leave;
	const parts = [
		[p.lessons.length, w.lessons],
		[p.figures.length, w.figures],
		[p.routines.length, w.routines],
		[p.songs.length, w.songs]
	] as const;
	const counts = parts.filter(([n]) => n > 0).map(([n, word]) => word(n));
	if (counts.length === 0) return w.nothing;
	return w.everything(counts, size(p.allBytes));
}

/** Keep only what my routines use: the figures (or more), and the routine that uses them. */
export function usedMeta(names: string[], routine: string | null): string {
	const w = t().groups.leave;
	if (names.length === 0) return w.usedNone;
	return w.used(names, routine);
}

export function overLimitLine(limit: number): string {
	return t().groups.leave.overLimit(size(limit));
}

/** A locked row in Choose: what it is, and who needs it. */
export function lockedMeta(meta: string, by: 'routine' | 'lesson' | 'figure'): string {
	return t().groups.leave.locked(meta, by);
}

/** A kept copy's meta in the Lessons tab. */
export const copyMeta = (group: string) => t().groups.leave.copyMeta(group);
