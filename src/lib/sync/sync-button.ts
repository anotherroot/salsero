/*
 * Sync now, pressed (last-synced, look A on the phone's Settings, look E on the
 * desktop's side): what the pull does, without the pull. Pure; the page gives it
 * the device, the page's re-read and a clock.
 */
import { doneWord } from '$lib/motion/pull-refresh';

/** What the button says: its own name, Syncing…, Up to date, Offline. */
export type SyncPhase = 'idle' | 'syncing' | 'done' | 'offline';

/** How long Up to date and Offline stay before the button names itself again. */
export const SYNC_DONE_MS = 1400;
export const SYNC_OFFLINE_MS = 1400;

type Summary = { waiting: number; refused: number; signedOut: boolean } | null;

export async function runSyncButton(deps: {
	online: () => boolean;
	syncNow: () => Promise<Summary>;
	refresh: () => Promise<void>;
	wait: (ms: number) => Promise<void>;
	set: (phase: SyncPhase) => void;
}): Promise<void> {
	if (!deps.online()) {
		deps.set('offline');
		await deps.wait(SYNC_OFFLINE_MS);
		deps.set('idle');
		return;
	}
	deps.set('syncing');
	let done = false;
	try {
		const summary = await deps.syncNow();
		await deps.refresh();
		// What waits or was refused shows in the band; the button says nothing of it.
		done = doneWord(summary);
	} catch (e) {
		console.warn('[sync] Sync now failed', e);
	}
	if (done) {
		deps.set('done');
		await deps.wait(SYNC_DONE_MS);
	}
	deps.set('idle');
}
