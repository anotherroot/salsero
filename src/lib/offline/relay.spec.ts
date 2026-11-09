import { afterEach, describe, expect, it } from 'vitest';
import type { OutboxSummary } from './protocol';
import { createRelay } from './relay';

const open: { close(): void }[] = [];
afterEach(() => {
	for (const r of open.splice(0)) r.close();
});
const NAME = `salsa-device-test-${Math.random()}`;
const relay = (
	self: string,
	answer: Parameters<typeof createRelay>[0]['answer'],
	limitMs?: number
) => {
	const r = createRelay({ channel: new BroadcastChannel(NAME), self, answer, limitMs });
	open.push(r);
	return r;
};
const SUM: OutboxSummary = {
	waiting: 2,
	oldestWaitingAt: 1,
	refused: 0,
	held: 0,
	signedOut: false,
	lastSyncedAt: null,
	seq: 7,
	queued: {},
	epochs: [12]
};

describe('the relay between tabs', () => {
	it("brings a second tab's ask to the owner's device and the answer back", async () => {
		relay('owner', async (m) => (m.type === 'retry' ? `retried ${m.id}` : null));
		const second = relay('second', () => null);
		expect(await second.ask({ type: 'retry', id: 'e1' })).toBe('retried e1');
	});

	it('gives up after the limit when no tab owns the copy', async () => {
		const lone = relay('lone', () => null, 50);
		relay('other', () => null, 50);
		expect(await lone.ask({ type: 'sync-now' })).toBeNull();
	});

	it('ignores an answer meant for another tab', async () => {
		relay('owner', async () => 'mine');
		const a = relay('a', () => null, 200);
		const b = relay('b', () => null, 200);
		const [ra, rb] = await Promise.all([
			a.ask({ type: 'outbox-list' }),
			b.ask({ type: 'outbox-list' })
		]);
		expect([ra, rb]).toEqual(['mine', 'mine']);
	});

	it("hands the owner's state and summary to the other tabs", async () => {
		const owner = relay('owner', async () => null);
		const second = relay('second', () => null);
		expect(second.owner()).toBeNull();
		owner.announce('ready', SUM);
		await new Promise((r) => setTimeout(r, 20));
		expect(second.owner()).toEqual({ state: 'ready', summary: SUM });
	});
});
