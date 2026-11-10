import { afterEach, describe, expect, it, vi } from 'vitest';
import { GATE_WAIT_MS, WriteGate, gatedRequest } from './gate';

afterEach(() => vi.useRealTimers());

/** A promise and its resolver: a write that finishes when told. */
function held() {
	let done!: () => void;
	const p = new Promise<void>((r) => (done = r));
	return { p, done };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('the write gate', () => {
	it('runs shared writes side by side', async () => {
		const gate = new WriteGate();
		const a = held();
		const b = held();
		const log: string[] = [];
		const one = gate.shared(async () => (log.push('a'), await a.p));
		const two = gate.shared(async () => (log.push('b'), await b.p));
		await tick();
		expect(log).toEqual(['a', 'b']);
		expect(gate.inFlight).toBe(2);
		a.done();
		b.done();
		await Promise.all([one, two]);
		expect(gate.inFlight).toBe(0);
	});

	it('a replay waits for the writes in flight, then runs alone', async () => {
		const gate = new WriteGate();
		const w = held();
		const log: string[] = [];
		const write = gate.shared(async () => {
			await w.p;
			log.push('write');
		});
		const replay = gate.exclusive(async () => {
			log.push('replay');
			return 7;
		});
		await tick();
		expect(log).toEqual([]);
		w.done();
		await write;
		expect(await replay).toEqual({ ran: true, value: 7 });
		expect(log).toEqual(['write', 'replay']);
	});

	it('a shared write waits while a replay holds the gate', async () => {
		const gate = new WriteGate();
		const r = held();
		const log: string[] = [];
		const replay = gate.exclusive(async () => {
			log.push('replay starts');
			await r.p;
			log.push('replay ends');
		});
		await tick();
		const write = gate.shared(async () => log.push('write'));
		await tick();
		expect(log).toEqual(['replay starts']);
		r.done();
		await replay;
		await write;
		expect(log).toEqual(['replay starts', 'replay ends', 'write']);
	});

	it('gives up after waitMs and runs nothing', async () => {
		vi.useFakeTimers();
		const gate = new WriteGate();
		const w = held();
		void gate.shared(() => w.p);
		const fn = vi.fn(async () => 1);
		const replay = gate.exclusive(fn, GATE_WAIT_MS);
		await vi.advanceTimersByTimeAsync(GATE_WAIT_MS + 1);
		expect(await replay).toEqual({ ran: false });
		expect(fn).not.toHaveBeenCalled();
		w.done();
	});

	it('lets go when a write throws', async () => {
		const gate = new WriteGate();
		await expect(gate.shared(async () => Promise.reject(new Error('boom')))).rejects.toThrow(
			'boom'
		);
		expect(gate.inFlight).toBe(0);
		await expect(gate.exclusive(async () => Promise.reject(new Error('bang')))).rejects.toThrow(
			'bang'
		);
		expect(await gate.shared(async () => 'after')).toBe('after');
	});

	it('gates writes, not reads, not the sync endpoints, not the device or a replay', () => {
		expect(gatedRequest('POST', '/salsa', false, false)).toBe(true);
		// An upload takes the gate only around its database write (in the route).
		expect(gatedRequest('PUT', '/api/lessons/1/videos/x', false, false)).toBe(false);
		expect(gatedRequest('POST', '/api/figures/3/recordings', false, false)).toBe(false);
		expect(gatedRequest('PUT', '/api/worker/videos/4/file', false, false)).toBe(false);
		expect(gatedRequest('POST', '/api/worker/claim', false, false)).toBe(true);
		expect(gatedRequest('GET', '/salsa', false, false)).toBe(false);
		expect(gatedRequest('HEAD', '/salsa', false, false)).toBe(false);
		expect(gatedRequest('POST', '/api/sync/push', false, false)).toBe(false);
		// The pull reads under the gate: never a replay's uncommitted rows (the Part A review).
		expect(gatedRequest('POST', '/api/sync/pull', false, false)).toBe(true);
		expect(gatedRequest('POST', '/salsa', true, false)).toBe(false);
		expect(gatedRequest('POST', '/salsa', false, true)).toBe(false);
	});
});

describe('the gate and offline phase 4c (final review 4)', () => {
	it("the new uploads take it only around their write; a phone-only add's JSON post holds it", () => {
		expect(gatedRequest('PUT', '/api/figures/3/recordings/abc', false, false)).toBe(false);
		expect(gatedRequest('PUT', '/api/recordings/3/file/abc', false, false)).toBe(false);
		expect(gatedRequest('PUT', '/api/lesson-videos/3/file/abc', false, false)).toBe(false);
		expect(gatedRequest('POST', '/api/lessons/5/videos/phone', false, false)).toBe(true);
		expect(gatedRequest('POST', '/api/figures/5/recordings/phone', false, false)).toBe(true);
		expect(gatedRequest('DELETE', '/api/recordings/5/server-copy', false, false)).toBe(true);
	});
});
