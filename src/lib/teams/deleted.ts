/**
 * A group's Recently deleted, as words: each row's lines, and why a Restore
 * was refused. PURE and client-safe; the rows come from `server/trash.ts`.
 * The words are the reader's (`t().groups.deleted`), read at call time.
 */
import { agoText, dayMonth } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import { lazyWords } from '$lib/i18n/lazy';
import type { DeletedItem, DeletedKind } from '$lib/types';

/** What each kind is called on its row (read when used: the reader's language). */
export const KIND_NAME: Record<DeletedKind, string> = lazyWords((c) => c.groups.deleted.kind);

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
	const w = t().groups;
	return w.deleted.by(item.by ?? w.history.someone, agoText(item.at, now));
}

/** "deleted for good on 2 Dec", for a trash kind; null for an archived one. */
export function purgeLine(item: Pick<DeletedItem, 'purgeOn'>): string | null {
	return item.purgeOn === null ? null : t().groups.deleted.purge(dayMonth(item.purgeOn));
}

/** A restore refused because the name is now another's. */
export function takenLine(name: string): string {
	return t().groups.deleted.taken(name);
}

/** What the restore of a trash entry was refused for. */
export type TrashRefusal =
	'parent-gone' | 'purged' | 'restored' | 'exists' | 'family' | 'not-found';

/** Why a trash entry did not come back, in words. */
export function trashRefusalLine(kind: DeletedKind, reason: TrashRefusal): string {
	const w = t().groups.deleted.refused;
	switch (reason) {
		case 'parent-gone':
			// Where a trash kind lives, for "Restore the video first".
			return kind === 'section' || kind === 'spot-link' || kind === 'position-link'
				? w.parentFirst[kind]
				: w.parentGone;
		case 'purged':
			return w.purged;
		case 'restored':
			return w.restored;
		case 'exists':
			if (kind === 'spot-link') return w.spotLinkAgain;
			if (kind === 'position-link') return w.positionLinkAgain;
			return w.restored;
		case 'family':
			return w.family;
		case 'not-found':
			return w.notFound;
	}
}
