/*
 * A re-read the person did not ask for (a pull brought changes, device first):
 * it waits until nothing is open over the page (a sheet, a half-filled form, a
 * save on its way, the player), then runs once through `refreshWhenSettled`.
 * Calls while one waits make no second one; a page left meanwhile drops it, as
 * the new page read afresh.
 */
import { refreshWhenSettled, sheetStack } from './history.svelte';
import { sendingNow, unsaved } from '$lib/unsaved/guard.svelte';

/** How often a waiting re-read looks again. */
export const IDLE_CHECK_MS = 500;

const PLAYER = /^\/[^/]+\/player\/?$/;

/** Whether something is open over the page that a re-read must not run under. */
export function busy(now: {
	openSheets: number;
	unsaved: number;
	sending: number;
	path: string;
}): boolean {
	return now.openSheets > 0 || now.unsaved > 0 || now.sending > 0 || PLAYER.test(now.path);
}

/** The page a waiting re-read is for; null: none waits. */
let waitingFor: string | null = null;

function busyNow(): boolean {
	return busy({
		openSheets: sheetStack.openCount,
		unsaved: unsaved(null).length,
		sending: sendingNow(),
		path: location.pathname
	});
}

function check(): void {
	if (waitingFor === null) return;
	if (location.href !== waitingFor) {
		waitingFor = null;
		return;
	}
	if (busyNow()) {
		setTimeout(check, IDLE_CHECK_MS);
		return;
	}
	waitingFor = null;
	void refreshWhenSettled();
}

/** Re-read the page once nothing is open over it. */
export function refreshWhenIdle(): void {
	if (waitingFor === location.href) return;
	waitingFor = location.href;
	setTimeout(check, 0);
}
