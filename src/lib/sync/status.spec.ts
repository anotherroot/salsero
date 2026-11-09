import { describe, expect, it } from 'vitest';
import type { OutboxSummary } from '$lib/offline/protocol';
import { WAITING_GRACE_MS, graceEndsAt, syncStatus, waitingMark } from './status';

const sum = (over: Partial<OutboxSummary> = {}): OutboxSummary => ({
	waiting: 0,
	oldestWaitingAt: null,
	refused: 0,
	held: 0,
	signedOut: false,
	lastSyncedAt: null,
	seq: 0,
	queued: {},
	epochs: [],
	...over
});

describe('the sync status', () => {
	it('says nothing while all is synced', () => {
		expect(syncStatus(null, 5)).toEqual({ kind: 'none' });
		expect(syncStatus(sum(), 5)).toEqual({ kind: 'none' });
	});

	it('waits 2 s before saying "waiting"', () => {
		expect(WAITING_GRACE_MS).toBe(2000);
		const s = sum({ waiting: 3, oldestWaitingAt: 1000 });
		expect(syncStatus(s, 2999)).toEqual({ kind: 'none' });
		expect(graceEndsAt(s, 2999)).toBe(3000);
		expect(syncStatus(s, 3000)).toEqual({ kind: 'waiting', count: 3 });
		expect(graceEndsAt(s, 3000)).toBeNull();
	});

	it("says couldn't sync over waiting, and sign in over waiting", () => {
		expect(syncStatus(sum({ waiting: 2, oldestWaitingAt: 0, refused: 1 }), 9000)).toEqual({
			kind: 'refused',
			count: 1
		});
		expect(syncStatus(sum({ waiting: 2, oldestWaitingAt: 0, signedOut: true }), 9000)).toEqual({
			kind: 'signin'
		});
		expect(syncStatus(sum({ refused: 1, signedOut: true }), 9000)).toEqual({
			kind: 'refused',
			count: 1
		});
	});

	it('marks a queued thing only after the grace', () => {
		const s = sum({ waiting: 1, oldestWaitingAt: 1000, queued: { 'lesson_comments:4': 1000 } });
		expect(waitingMark(s, 'lesson_comments', 4, 2999)).toBe(false);
		expect(waitingMark(s, 'lesson_comments', 4, 3000)).toBe(true);
		expect(waitingMark(s, 'lesson_comments', 5, 9000)).toBe(false);
		expect(waitingMark(null, 'lesson_comments', 4, 9000)).toBe(false);
	});
});
