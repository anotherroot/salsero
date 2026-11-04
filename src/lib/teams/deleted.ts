/**
 * A group's Recently deleted, as words: each row's lines, and why a Restore
 * was refused. PURE and client-safe; the rows come from `server/trash.ts`.
 */
import { agoText, dayMonth } from '$lib/format';
import type { DeletedItem, DeletedKind } from '$lib/types';

/** What each kind is called on its row. */
export const KIND_NAME: Record<DeletedKind, string> = {
	video: 'Video',
	section: 'Section',
	link: 'Link',
	'spot-link': 'Section link',
	recording: 'Recording',
	lesson: 'Lesson',
	variation: 'Figure',
	routine: 'Routine',
	drill: 'Drill',
	song: 'Song',
	position: 'Position',
	'position-link': 'Position link'
};

/** The kinds kept in the trash for 30 days; the rest stay archived until restored. */
export const TRASH_KINDS = new Set<DeletedKind>([
	'video',
	'section',
	'link',
	'spot-link',
	'recording',
	'position-link'
]);

/** "Ana · 5 min ago". */
export function deletedByLine(item: Pick<DeletedItem, 'by' | 'at'>, now: number): string {
	return `${item.by ?? 'Someone'} · ${agoText(item.at, now)}`;
}

/** "deleted for good on 2 Dec", for a trash kind; null for an archived one. */
export function purgeLine(item: Pick<DeletedItem, 'purgeOn'>): string | null {
	return item.purgeOn === null ? null : `deleted for good on ${dayMonth(item.purgeOn)}`;
}

/** A restore refused because the name is now another's. */
export function takenLine(name: string): string {
	return `${name} is taken; rename that one first`;
}

/** What the restore of a trash entry was refused for. */
export type TrashRefusal =
	'parent-gone' | 'purged' | 'restored' | 'exists' | 'family' | 'not-found';

/** Where a trash kind lives, for "Restore the video first". */
const PARENT: Partial<Record<DeletedKind, string>> = {
	section: 'video',
	'spot-link': 'section',
	'position-link': 'section or point'
};

/** Why a trash entry did not come back, in words. */
export function trashRefusalLine(kind: DeletedKind, reason: TrashRefusal): string {
	switch (reason) {
		case 'parent-gone':
			return PARENT[kind] ? `Restore the ${PARENT[kind]} first` : 'What it was in is gone';
		case 'purged':
			return 'This was deleted for good.';
		case 'restored':
			return 'This is back already.';
		case 'exists':
			if (kind === 'spot-link') return 'That section was linked to it again since.';
			if (kind === 'position-link') return 'It was linked to that position again since.';
			return 'This is back already.';
		case 'family':
			return 'A copy of this is here already.';
		case 'not-found':
			return 'That is no longer there to restore.';
	}
}
