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
import type { ActionResult } from '@sveltejs/kit';
import { mayReloadNow, type Quiet } from '$lib/nav/fresh';

export const PAGE_EPOCH = 4;

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
 * The refusal: 409 with `x-page-stale`.
 *
 * A form action (`use:enhance` sends `x-sveltekit-action`) gets it as an
 * action failure, which the form shows like any other refused save: the page
 * stays, with what was typed. As a plain error, SvelteKit would swap the page
 * for its error page. `data` is devalue's encoding of
 * `{ message: STALE_MESSAGE }`, as `deserialize` in `$app/forms` reads it.
 * Anything else gets `{ message: STALE_MESSAGE }` as JSON, the shape the API
 * routes refuse with: SvelteKit never sees a page's data refused
 * (`holdsBack`), and an API caller that shows the server's message
 * (`messageFromBody`, the player's `ok`) shows words, not a status number.
 */
export function staleAnswer(action: boolean): Response {
	if (!action) {
		return new Response(JSON.stringify({ message: STALE_MESSAGE }), {
			status: 409,
			headers: { [STALE_HEADER]: '1', 'content-type': 'application/json' }
		});
	}
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
 * What the page does on a stale answer.
 *
 * A navigation under way becomes a full load, unless that would cut an upload
 * or a run short, or a navigation is already `stuck` (held back, see
 * `holdsBack`): while one is pending SvelteKit runs no `beforeNavigate` for the
 * next, so the unsaved-changes guard never had its say about it.
 *
 * Otherwise the page reloads only when nothing would be lost (`mayReloadNow`,
 * as for a deploy) and no form's save is out: `use:guarded` counts a form as
 * clean while it sends, and the refusal reaches here before the form hears
 * it, so `sending` (the guard's `sendingNow()`) stands in for what was typed.
 */
export function staleMove(
	s: { routeId: string | null; navigating: boolean; stuck: boolean; sending: number } & Quiet
): StaleMove {
	if (s.navigating) return s.held === 0 && !s.stuck ? 'go' : 'bar';
	if (s.sending > 0) return 'bar';
	return mayReloadNow(s) ? 'reload' : 'bar';
}

/**
 * Whether the fetch wrapper keeps a stale answer from its caller (the promise
 * never settles). SvelteKit must never see a page's data refused: its error
 * path refetches the root layout's data, is refused again, and falls back to
 * a full load of the URL without asking anyone (an upload is cut off).
 *
 * - The page is going away (`go`, `reload`): everything, so nothing flashes.
 * - `bar` while navigating: the navigation's data. The navigation then stays
 *   pending until Reload; the root layout hides its progress and skeleton.
 * - `bar` otherwise: a data reload of this very page (an invalidation), which
 *   would put the error page in place of the page and what was typed in it.
 *
 * Handed back: a preload of another page (SvelteKit does not cache a failed
 * preload, so the tap that follows asks again, as a navigation), API calls
 * (they show their own failure) and form actions (`staleAnswer` made theirs
 * a failure).
 */
export function holdsBack(
	move: StaleMove,
	requestUrl: string,
	pageUrl: string,
	navigating: boolean
): boolean {
	if (move !== 'bar') return true;
	const request = new URL(requestUrl);
	const page = new URL(pageUrl);
	if (request.origin !== page.origin || !request.pathname.endsWith('/__data.json')) return false;
	if (navigating) return true;
	const base = page.pathname.endsWith('/') ? page.pathname : `${page.pathname}/`;
	return request.pathname === `${base}__data.json`;
}

/**
 * Whether an action's result is this refusal (`staleAnswer(true)`). Code that
 * reloads the page's data after a failure skips it then: the reload would be
 * refused too, and held back (`holdsBack`), so it would never finish.
 */
export function staleFailure(result: ActionResult): boolean {
	if (result.type !== 'failure' || result.status !== 409) return false;
	return (result.data as { message?: unknown } | undefined)?.message === STALE_MESSAGE;
}
