/**
 * The order of the boot's background work (`startTrashPurge`): settle the
 * former members, then what waits for them (the integrity checks), then the
 * purge. Settling and the group purge are mocks; the trash purge runs on an
 * empty in-memory database, so no file is touched.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, type Db } from './db';

const m = vi.hoisted(() => ({ order: [] as string[], settleFails: false }));

vi.mock('./clones/settle', () => ({
	settleFormerMembers: async () => {
		await Promise.resolve();
		if (m.settleFails) throw new Error('settle broke');
		m.order.push('settle');
		return 0;
	}
}));
vi.mock('./team-purge', () => ({
	purgeTeams: async () => {
		m.order.push('purge');
		return 0;
	}
}));

import { startTrashPurge } from './trash';

const timer = globalThis as { __salsaTrashPurge?: ReturnType<typeof setInterval> };
let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	m.order.length = 0;
	m.settleFails = false;
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	clearInterval(timer.__salsaTrashPurge);
	delete timer.__salsaTrashPurge;
	vi.restoreAllMocks();
});

describe('startTrashPurge', () => {
	// Catches: integrity logging what the settling is about to fix.
	it('runs what waits for the settling after it, and before the purge', async () => {
		startTrashPurge(
			() => db,
			() => m.order.push('checks')
		);
		await vi.waitFor(() => expect(m.order).toContain('purge'));
		expect(m.order).toEqual(['settle', 'checks', 'purge']);
	});

	it('a failed settling is logged, and the checks and the purge still run', async () => {
		m.settleFails = true;
		startTrashPurge(
			() => db,
			() => m.order.push('checks')
		);
		await vi.waitFor(() => expect(m.order).toContain('purge'));
		expect(m.order).toEqual(['checks', 'purge']);
		expect(vi.mocked(console.warn).mock.calls[0][0]).toBe(
			'[clones] settling former members failed'
		);
	});

	it('a throwing check is logged and never stops the purge', async () => {
		startTrashPurge(
			() => db,
			() => {
				throw new Error('check broke');
			}
		);
		await vi.waitFor(() => expect(m.order).toContain('purge'));
		expect(m.order).toEqual(['settle', 'purge']);
		expect(vi.mocked(console.warn).mock.calls.map((c) => c[0])).toContain(
			'[integrity] checks failed'
		);
	});
});
