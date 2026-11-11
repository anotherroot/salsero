import { describe, expect, it, vi } from 'vitest';
import { newWorkerReady, type ContainerLike, type RegistrationLike } from './sw-update';

/** A service worker container whose registration's `update()` finds what `found` says. */
function setup(found: 'new' | 'held' | 'nothing' | 'offline' | 'no-registration') {
	const listeners = new Set<() => void>();
	const reg: RegistrationLike = {
		installing: null,
		waiting: null,
		update: vi.fn(async () => {
			if (found === 'offline') throw new TypeError('Failed to fetch');
			if (found === 'new') reg.installing = {};
			if (found === 'held') reg.waiting = {};
		})
	};
	const container: ContainerLike = {
		getRegistration: async () => (found === 'no-registration' ? undefined : reg),
		addEventListener: (_t, fn) => void listeners.add(fn),
		removeEventListener: (_t, fn) => void listeners.delete(fn)
	};
	/** The new worker takes over (`skipWaiting` + `clients.claim`). */
	const takeOver = () => {
		reg.installing = null;
		for (const fn of [...listeners]) fn();
	};
	return { container, reg, takeOver, listeners };
}

describe('newWorkerReady', () => {
	it('waits for a new build’s worker to take over, so one reload gets the new build', async () => {
		const s = setup('new');
		const ready = newWorkerReady(s.container, 15_000);
		await vi.waitFor(() => expect(s.reg.installing).not.toBeNull());
		let done: string | null = null;
		void ready.then((r) => (done = r));
		await Promise.resolve();
		expect(done).toBeNull();
		s.takeOver();
		expect(await ready).toBe('took-over');
		expect(s.listeners.size).toBe(0);
	});

	it('gives up after the limit, and the reload goes ahead as before', async () => {
		vi.useFakeTimers();
		try {
			const s = setup('new');
			const ready = newWorkerReady(s.container, 15_000);
			await vi.advanceTimersByTimeAsync(15_000);
			expect(await ready).toBe('timeout');
			expect(s.listeners.size).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});

	it('does not wait when there is nothing new, a held worker, no connection or no worker', async () => {
		expect(await newWorkerReady(setup('nothing').container, 15_000)).toBe('none');
		// Held back on purpose (`holdsUpdate`: older changes still to send): it will not take over now.
		expect(await newWorkerReady(setup('held').container, 15_000)).toBe('held');
		expect(await newWorkerReady(setup('offline').container, 15_000)).toBe('none');
		expect(await newWorkerReady(setup('no-registration').container, 15_000)).toBe('none');
	});
});
