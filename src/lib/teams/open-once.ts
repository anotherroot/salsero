/**
 * "Opened" once per shown item and stamp (a lesson's publishedAt), however often
 * the page's data reloads. The report is a device write whose landing refreshes
 * the page, so an effect that reported on every load fed itself: a refresh
 * about every second while a group's lesson was open (spec beside it).
 * Client-safe; one per page instance.
 */
export function openOnce<K extends string>(
	send: (kind: K, id: number) => void
): (kind: K, id: number, stamp: number | null) => void {
	let last: string | null = null;
	return (kind, id, stamp) => {
		const key = `${kind}:${id}:${stamp}`;
		if (key === last) return;
		last = key;
		send(kind, id);
	};
}
