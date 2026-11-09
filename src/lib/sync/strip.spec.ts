import { describe, expect, it } from 'vitest';
import type { OutboxSummary } from '$lib/offline/protocol';
import { nextMarks, SENDING_WINDOW_MS, SENT_SHOW_MS, stripState, type StripMarks } from './strip';
import { WAITING_GRACE_MS } from './status';

const NOW = 1_000_000;
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
const none: StripMarks = { backOnlineAt: null, sentUntil: null };

describe('the offline strip (offline phase 3, look C2)', () => {
	it('offline: says so, with how many changes wait (none too)', () => {
		expect(stripState(false, sum({ waiting: 5, oldestWaitingAt: NOW }), NOW, none)).toEqual({
			kind: 'offline',
			count: 5
		});
		expect(stripState(false, null, NOW, none)).toEqual({ kind: 'offline', count: 0 });
	});

	it('online with nothing waiting: nothing', () => {
		expect(stripState(true, sum(), NOW, none)).toBeNull();
		expect(stripState(true, null, NOW, none)).toBeNull();
	});

	it('online: a change that goes up within the grace never shows', () => {
		const s = sum({ waiting: 1, oldestWaitingAt: NOW - WAITING_GRACE_MS + 1 });
		expect(stripState(true, s, NOW, none)).toBeNull();
	});

	it('online: changes still waiting after the grace say so', () => {
		const s = sum({ waiting: 3, oldestWaitingAt: NOW - WAITING_GRACE_MS });
		expect(stripState(true, s, NOW, none)).toEqual({ kind: 'waiting', count: 3 });
	});

	it('just back online: sending, whatever the grace', () => {
		const s = sum({ waiting: 5, oldestWaitingAt: NOW });
		const marks = { backOnlineAt: NOW - 1000, sentUntil: null };
		expect(stripState(true, s, NOW, marks)).toEqual({ kind: 'sending', count: 5 });
		expect(
			stripState(true, s, NOW + SENDING_WINDOW_MS, { ...marks, backOnlineAt: NOW - 1000 })
		).toEqual({ kind: 'waiting', count: 5 });
	});

	it('everything sent: "all sent" for a moment, then nothing', () => {
		const marks = { backOnlineAt: NOW - 3000, sentUntil: NOW + 500 };
		expect(stripState(true, sum(), NOW, marks)).toEqual({ kind: 'sent' });
		expect(stripState(true, sum(), NOW + 500, marks)).toBeNull();
	});

	it('marks the moment the connection comes back', () => {
		expect(
			nextMarks({ online: false, waiting: 2, shown: true }, { online: true, waiting: 2 }, NOW, none)
		).toEqual({
			backOnlineAt: NOW,
			sentUntil: null
		});
	});

	it('marks "all sent" only when the strip was showing changes that then left', () => {
		const shown = nextMarks(
			{ online: true, waiting: 2, shown: true },
			{ online: true, waiting: 0 },
			NOW,
			none
		);
		expect(shown.sentUntil).toBe(NOW + SENT_SHOW_MS);
		// A quick save online never showed: no "all sent" either.
		const quiet = nextMarks(
			{ online: true, waiting: 1, shown: false },
			{ online: true, waiting: 0 },
			NOW,
			none
		);
		expect(quiet.sentUntil).toBeNull();
		// Going offline forgets "back online".
		expect(
			nextMarks({ online: true, waiting: 0, shown: false }, { online: false, waiting: 0 }, NOW, {
				backOnlineAt: NOW - 5,
				sentUntil: null
			}).backOnlineAt
		).toBeNull();
	});
});
