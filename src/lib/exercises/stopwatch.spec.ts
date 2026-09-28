import { describe, expect, it } from 'vitest';
import { STOPPED, elapsedMs, pauseWatch, startWatch } from './stopwatch';

describe('stopwatch', () => {
	it('counts running time and leaves pauses out', () => {
		let w = startWatch(STOPPED, 1_000);
		expect(elapsedMs(w, 4_000)).toBe(3_000);
		w = pauseWatch(w, 4_000);
		expect(elapsedMs(w, 60_000)).toBe(3_000);
		w = startWatch(w, 60_000);
		expect(elapsedMs(w, 62_000)).toBe(5_000);
	});

	it('ignores a second start or a second pause', () => {
		const running = startWatch(STOPPED, 1_000);
		expect(startWatch(running, 5_000)).toBe(running);
		const paused = pauseWatch(running, 2_000);
		expect(pauseWatch(paused, 9_000)).toBe(paused);
	});

	it('never goes negative if the clock steps backwards', () => {
		expect(elapsedMs(startWatch(STOPPED, 5_000), 4_000)).toBe(0);
	});
});
