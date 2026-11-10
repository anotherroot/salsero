/** A phone-only video's delete question (offline phase 4c): it is the only copy, so deleting is final. */
import { t } from '$lib/i18n/catalog';

export function phoneOnlyDeleteNote(row: { serverCopy: boolean }, iphone: boolean): string | null {
	if (row.serverCopy) return null;
	const w = t().video.place;
	return iphone ? w.deleteOnlyIphone : w.deleteOnly;
}
