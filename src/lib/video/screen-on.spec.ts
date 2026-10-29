import { describe, expect, it, vi } from 'vitest';
import { holdScreenOn } from './screen-on';

function fakes(opts: { reject?: boolean } = {}) {
	const released: number[] = [];
	let n = 0;
	const resolvers: (() => void)[] = [];
	const wakeLock = {
		request: vi.fn(() => {
			const id = ++n;
			if (opts.reject) return Promise.reject(new Error('NotAllowedError'));
			return new Promise<{ release(): Promise<void> }>((res) => {
				resolvers.push(() =>
					res({
						release: async () => void released.push(id)
					})
				);
			});
		})
	};
	const listeners = new Set<() => void>();
	const doc = {
		visibilityState: 'visible',
		addEventListener: (_: 'visibilitychange', f: () => void) => void listeners.add(f),
		removeEventListener: (_: 'visibilitychange', f: () => void) => void listeners.delete(f)
	};
	const settle = async () => {
		while (resolvers.length) resolvers.shift()!();
		await new Promise((r) => setTimeout(r, 0));
	};
	const fire = () => listeners.forEach((f) => f());
	return { wakeLock, doc, released, listeners, settle, fire };
}

describe('holdScreenOn', () => {
	it('asks for the lock at once', async () => {
		const f = fakes();
		holdScreenOn({ wakeLock: f.wakeLock, doc: f.doc });
		expect(f.wakeLock.request).toHaveBeenCalledWith('screen');
	});

	it('asks again when the page comes back, not when it goes', async () => {
		const f = fakes();
		holdScreenOn({ wakeLock: f.wakeLock, doc: f.doc });
		await f.settle();
		f.doc.visibilityState = 'hidden';
		f.fire();
		expect(f.wakeLock.request).toHaveBeenCalledTimes(1);
		f.doc.visibilityState = 'visible';
		f.fire();
		expect(f.wakeLock.request).toHaveBeenCalledTimes(2);
	});

	it('lets go on stop and stops listening', async () => {
		const f = fakes();
		const stop = holdScreenOn({ wakeLock: f.wakeLock, doc: f.doc });
		await f.settle();
		stop();
		await f.settle();
		expect(f.released).toEqual([1]);
		expect(f.listeners.size).toBe(0);
	});

	it('lets go of a lock that arrives after stop', async () => {
		const f = fakes();
		const stop = holdScreenOn({ wakeLock: f.wakeLock, doc: f.doc });
		stop();
		await f.settle();
		expect(f.released).toEqual([1]);
	});

	it('does nothing without the API, and swallows a refusal', async () => {
		const f = fakes({ reject: true });
		expect(() => holdScreenOn({ doc: f.doc })()).not.toThrow();
		const stop = holdScreenOn({ wakeLock: f.wakeLock, doc: f.doc });
		await f.settle();
		expect(() => stop()).not.toThrow();
	});
});
