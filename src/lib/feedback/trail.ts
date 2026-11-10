/**
 * What a feedback message carries from the page: the last pages opened and the
 * last script errors met, kept in this tab since it loaded. The root layout
 * records them (`notePage`, `noteError`); Send feedback reads them (`report`).
 * The list helpers are pure; the two lists are this tab's, in memory only.
 */

/** How many pages and errors are kept. */
export const KEEP_PAGES = 8;
export const KEEP_ERRORS = 5;
/** An error's message is cut at this length. */
export const ERROR_CHARS = 300;

/** `list` with `item` last, at most `keep` long; a repeat of the last item is not added again. */
export function pushed(list: readonly string[], item: string, keep: number): string[] {
	if (list[list.length - 1] === item) return [...list];
	return [...list, item].slice(-keep);
}

/**
 * The page they most likely mean: the one before the page they write from (the
 * You or Settings page holding Send feedback); that page itself when it is the
 * only one.
 */
export function pageBefore(trail: readonly string[]): string | null {
	if (trail.length === 0) return null;
	return trail.length === 1 ? trail[0] : trail[trail.length - 2];
}

/** An error as one short line: its message, cut at `ERROR_CHARS`. */
export function errorLine(reason: unknown): string {
	const text =
		reason instanceof Error
			? `${reason.name}: ${reason.message}`
			: typeof reason === 'string'
				? reason
				: String(reason);
	return text.length > ERROR_CHARS ? `${text.slice(0, ERROR_CHARS - 1)}…` : text;
}

let pages: string[] = [];
let errors: string[] = [];

/** A page opened: its path and query. */
export function notePage(url: URL): void {
	pages = pushed(pages, url.pathname + url.search, KEEP_PAGES);
}

/** A script error or an unhandled rejection the page met. */
export function noteError(reason: unknown): void {
	errors = pushed(errors, errorLine(reason), KEEP_ERRORS);
}

/**
 * What Send feedback sends from this tab. `here`: sent from the page itself (after
 * a screenshot), so the page is the one open, not the one before it.
 */
export function report(here = false): { page: string | null; trail: string[]; errors: string[] } {
	const page = here ? (pages[pages.length - 1] ?? null) : pageBefore(pages);
	return { page, trail: [...pages], errors: [...errors] };
}
