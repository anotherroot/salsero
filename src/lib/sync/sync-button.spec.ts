import { describe, expect, it } from 'vitest';
import { runSyncButton, SYNC_DONE_MS, SYNC_OFFLINE_MS, type SyncPhase } from './sync-button';

const allSent = { waiting: 0, refused: 0, signedOut: false };

function deps(over: Partial<Parameters<typeof runSyncButton>[0]> = {}) {
	const phases: SyncPhase[] = [];
	const waits: number[] = [];
	const calls: string[] = [];
	const d = {
		online: () => true,
		syncNow: async () => {
			calls.push('sync');
			return allSent;
		},
		refresh: async () => {
			calls.push('refresh');
		},
		wait: async (ms: number) => {
			waits.push(ms);
		},
		set: (p: SyncPhase) => phases.push(p),
		...over
	};
	return { d, phases, waits, calls };
}

describe('Sync now (Settings on the phone, the side on the desktop)', () => {
	it('syncs, reads the page again, says Up to date, then goes back', async () => {
		const { d, phases, waits, calls } = deps();
		await runSyncButton(d);
		expect(calls).toEqual(['sync', 'refresh']);
		expect(phases).toEqual(['syncing', 'done', 'idle']);
		expect(waits).toEqual([SYNC_DONE_MS]);
	});

	it('says Offline without a connection and sends nothing', async () => {
		const { d, phases, waits, calls } = deps({ online: () => false });
		await runSyncButton(d);
		expect(calls).toEqual([]);
		expect(phases).toEqual(['offline', 'idle']);
		expect(waits).toEqual([SYNC_OFFLINE_MS]);
	});

	it('does not say Up to date while changes still wait', async () => {
		const { d, phases } = deps({ syncNow: async () => ({ ...allSent, waiting: 2 }) });
		await runSyncButton(d);
		expect(phases).toEqual(['syncing', 'idle']);
	});

	it('goes back to the button when the sync throws', async () => {
		const { d, phases } = deps({
			syncNow: async () => {
				throw new Error('gone');
			}
		});
		await runSyncButton(d);
		expect(phases.at(-1)).toBe('idle');
		expect(phases).not.toContain('done');
	});
});
