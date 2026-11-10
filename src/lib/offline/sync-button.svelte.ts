/*
 * Sync now, pressed (last-synced): the one button state the phone's Settings row
 * and the desktop's side share, so a press in one shows in the other.
 */
import { invalidateAll } from '$app/navigation';
import { runSyncButton, type SyncPhase } from '$lib/sync/sync-button';
import { syncNow } from './device.svelte';

export const syncButton = $state<{ phase: SyncPhase }>({ phase: 'idle' });

/** Push what waits, pull, read the page again; a press while it works does nothing. */
export function pressSyncNow(): void {
	if (syncButton.phase !== 'idle') return;
	void runSyncButton({
		online: () => navigator.onLine,
		syncNow,
		refresh: () => invalidateAll(),
		wait: (ms) => new Promise((done) => setTimeout(done, ms)),
		set: (phase) => (syncButton.phase = phase)
	});
}
