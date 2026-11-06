/**
 * The boot's integrity checks wait for the settling of former members: run
 * before it, the first boot after a deploy logs cross-refs lines that the
 * settling is about to fix. Everything the boot calls is a mock; no database,
 * no files.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
	ownerIntegrity: vi.fn((): string[] => []),
	familyIntegrity: vi.fn((): string[] => []),
	crossRefs: vi.fn((): string[] => []),
	danceIntegrity: vi.fn((): string[] => []),
	startTrashPurge: vi.fn(),
	order: [] as string[]
}));

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('../admin', () => ({
	seedAdmin: async () => {
		m.order.push('admin');
	}
}));
vi.mock('../dance-split', () => ({
	splitAccounts: async () => {
		m.order.push('split');
		return { assigned: 0, split: 0, failed: 0 };
	}
}));
vi.mock('../clones/files', () => ({ realCloneFiles: () => ({}) }));
vi.mock('../files', () => ({ sweepUploads: async () => {} }));
vi.mock('../integrity', () => ({
	ownerIntegrity: m.ownerIntegrity,
	familyIntegrity: m.familyIntegrity,
	crossRefs: m.crossRefs,
	danceIntegrity: m.danceIntegrity
}));
vi.mock('../links', () => ({ importNoteLinks: () => {} }));
vi.mock('../positions-move', () => ({ movePositionsToOwners: () => ({ ran: false }) }));
vi.mock('../storage', () => ({ backfillSongSizes: () => {} }));
vi.mock('../trash', () => ({ startTrashPurge: m.startTrashPurge }));
vi.mock('./index', () => ({ getDb: () => ({}) }));

import { bootstrap } from './bootstrap';

beforeEach(() => {
	vi.spyOn(console, 'info').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('bootstrap', () => {
	// Catches: the checks running before `settleFormerMembers`, so the first
	// boot after a deploy logs the cross-refs the settling is about to fix.
	it('hands the integrity checks to the purge timer, to run once former members are settled', async () => {
		await bootstrap();
		expect(m.crossRefs).not.toHaveBeenCalled();
		expect(m.ownerIntegrity).not.toHaveBeenCalled();
		expect(m.familyIntegrity).not.toHaveBeenCalled();
		expect(m.startTrashPurge).toHaveBeenCalledTimes(1);

		const afterSettle = m.startTrashPurge.mock.calls[0][1] as () => void;
		m.crossRefs.mockReturnValueOnce(['exercises 7: a line']);
		m.familyIntegrity.mockImplementationOnce(() => {
			throw new Error('boom');
		});
		afterSettle();
		expect(m.ownerIntegrity).toHaveBeenCalledTimes(1);
		expect(m.crossRefs).toHaveBeenCalledTimes(1);
		const info = vi.mocked(console.info).mock.calls.map((c) => c[0]);
		expect(info).toEqual([
			'[integrity] owners: 0 found',
			'[integrity] cross-refs: 1 found',
			'[integrity] dances: 0 found'
		]);
		const warn = vi.mocked(console.warn).mock.calls.map((c) => c[0]);
		expect(warn).toEqual(['[integrity] families check failed', '[integrity] exercises 7: a line']);
	});
});

describe('the dance split at boot', () => {
	// Catches: the boot admin running while every account is unplaced, so it
	// makes admins that clash with the split's new bachata account.
	it('splits the accounts before it seeds the admin', async () => {
		await bootstrap();
		expect(m.order).toEqual(['split', 'admin']);
	});
});
