/**
 * The page epoch: the safety net for a deploy that breaks pages already open.
 * Client-safe and PURE.
 *
 * Raise `PAGE_EPOCH` by hand in the commit that makes the server refuse what
 * an older page would still send (a changed form field, action or API shape).
 * `app.html` writes it into `<html data-page-epoch>` and wraps `fetch`, so
 * every same-origin request the page makes carries it in `x-page-epoch`.
 * `hooks.server.ts` answers a request from an older epoch with 409 and
 * `x-page-stale`; the page hears that as `salsa:stale` and the root layout
 * reloads, or shows "This page is out of date" with Reload. A request without
 * the header (a full page load, the Android app's own calls, the home worker)
 * is never refused by this.
 */
import { mayReloadNow, type Quiet } from '$lib/nav/fresh';

export const PAGE_EPOCH = 1;

export const EPOCH_HEADER = 'x-page-epoch';
export const STALE_HEADER = 'x-page-stale';
/** Filled by the hook in `app.html`, like the theme. */
export const EPOCH_PLACEHOLDER = '%salsa.epoch%';

export const STALE_MESSAGE = 'This page is out of date. Reload to continue.';

/**
 * Whether a request comes from a page older than the server. No header, or
 * anything that is not a whole number, is never stale: refusing a request
 * the page did not mark would refuse the ones that cannot carry it.
 */
export function staleEpoch(header: string | null, current: number): boolean {
	if (header === null || !/^\d+$/.test(header)) return false;
	return Number(header) < current;
}

export function fillEpoch(html: string): string {
	return html.replace(EPOCH_PLACEHOLDER, String(PAGE_EPOCH));
}

/**
 * The refusal. A form action (`use:enhance` sends `x-sveltekit-action`) gets
 * it as an action failure, which the form shows like any other refused save:
 * the page stays, with what was typed. As a plain error, SvelteKit would swap
 * the page for its error page. `data` is devalue's encoding of
 * `{ message: STALE_MESSAGE }`, as `deserialize` in `$app/forms` reads it.
 */
export function staleAnswer(action: boolean): Response {
	if (!action) return new Response('Reload', { status: 409, headers: { [STALE_HEADER]: '1' } });
	const body = {
		type: 'failure',
		status: 409,
		data: JSON.stringify([{ message: 1 }, STALE_MESSAGE])
	};
	return new Response(JSON.stringify(body), {
		status: 409,
		headers: { [STALE_HEADER]: '1', 'content-type': 'application/json' }
	});
}

/**
 * `go`: load the page a navigation was heading for (the unsaved-changes guard
 * has already let it go), `reload`: reload this one, `bar`: keep the page and
 * show "This page is out of date" with Reload.
 */
export type StaleMove = 'go' | 'reload' | 'bar';

/**
 * What the page does on a stale answer. A navigation under way becomes a full
 * load unless that would cut an upload or a run short; otherwise the page
 * reloads only when nothing would be lost (`mayReloadNow`, as for a deploy).
 */
export function staleMove(s: { routeId: string | null; navigating: boolean } & Quiet): StaleMove {
	if (s.navigating) return s.held === 0 ? 'go' : 'bar';
	return mayReloadNow(s) ? 'reload' : 'bar';
}

/**
 * Whether the fetch wrapper keeps a stale answer from its caller (the promise
 * never settles). Always while the page is going away, so no error flashes up
 * first. While it stays, only a data reload of this very page (an
 * invalidation): SvelteKit would put its error page in place of the page and
 * what was typed in it. A preload of another page is handed back, or the tap
 * that uses it would wait forever; so are API calls (they show their own
 * failure) and form actions (`staleAnswer` made theirs a failure).
 */
export function holdsBack(move: StaleMove, requestUrl: string, pageUrl: string): boolean {
	if (move !== 'bar') return true;
	const request = new URL(requestUrl);
	const page = new URL(pageUrl);
	const base = page.pathname.endsWith('/') ? page.pathname : `${page.pathname}/`;
	return request.origin === page.origin && request.pathname === `${base}__data.json`;
}
