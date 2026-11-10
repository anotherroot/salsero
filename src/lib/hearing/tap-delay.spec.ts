import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTapDelay, saveTapDelay, tapDelayFrom, tapSongTime } from './tap-delay';

const around70 = [62, 75, 68, 71, 80, 66, 70, 73, 64, 77, 69, 70];

describe('tapDelayFrom', () => {
	it('takes the middle of steady taps', () => {
		expect(tapDelayFrom(around70)).toEqual({ ms: 70, uneven: false });
	});

	it('waits for twelve taps', () => {
		expect(tapDelayFrom(around70.slice(1))).toBeNull();
	});

	it('uses the last twelve, so the first clumsy taps do not count', () => {
		expect(tapDelayFrom([400, 400, 400, 400, ...around70])).toEqual({ ms: 70, uneven: false });
	});

	it('calls wild taps uneven', () => {
		const wild = [-200, 300, 40, -120, 250, 10, 180, -60, 90, 290, -180, 120];
		expect(tapDelayFrom(wild)?.uneven).toBe(true);
	});

	it('never goes below 0', () => {
		expect(tapDelayFrom(new Array(12).fill(-30))).toEqual({ ms: 0, uneven: false });
	});
});

describe('tapSongTime', () => {
	it('takes the finger and the event lag off the song time', () => {
		expect(tapSongTime(10, 20, 70, 1)).toBeCloseTo(9.91, 9);
	});

	it('scales by the playback rate (song seconds pass slower at 0.8×)', () => {
		expect(tapSongTime(10, 0, 100, 0.8)).toBeCloseTo(9.92, 9);
	});
});

describe('the stored tap delay', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('reads back what was saved', () => {
		const store = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => store.set(k, v)
		});
		expect(loadTapDelay()).toBeNull();
		saveTapDelay(70);
		expect(loadTapDelay()).toBe(70);
		store.set('hearing.tapDelayMs', 'nonsense');
		expect(loadTapDelay()).toBeNull();
		store.set('hearing.tapDelayMs', '900');
		expect(loadTapDelay()).toBeNull();
	});

	it('survives storage that throws (private mode)', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		});
		expect(loadTapDelay()).toBeNull();
		expect(() => saveTapDelay(70)).not.toThrow();
	});
});
