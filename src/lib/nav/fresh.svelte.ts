/*
 * What keeps the page from reloading by itself after a deploy (`./fresh.ts`):
 * an upload in flight, a practice run. Not reactive on purpose: it is only
 * read at the moment a reload or a full load is decided.
 */

let holds = 0;

/** Keep the page from reloading by itself until the returned release runs (once). */
export function holdReload(): () => void {
	holds++;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		holds--;
	};
}

/** How many holds are taken. */
export function held(): number {
	return holds;
}

/** Call during a component's init: holds while `active()` is true, and lets go on false or on destroy. */
export function holdReloadWhile(active: () => boolean): void {
	$effect(() => {
		if (active()) return holdReload();
	});
}
