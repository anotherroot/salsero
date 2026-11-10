import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const now = vi.hoisted(() => ({ openSheets: 0, unsaved: 0, sending: 0 }));
const refresh = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('./history.svelte', () => ({
	sheetStack: {
		get openCount() {
			return now.openSheets;
		}
	},
	refreshWhenSettled: refresh
}));
vi.mock('$lib/unsaved/guard.svelte', () => ({
	unsaved: () => Array.from({ length: now.unsaved }),
	sendingNow: () => now.sending
}));

import { IDLE_CHECK_MS, busy, refreshWhenIdle } from './idle-refresh';

const place = { href: 'https://x/salsa', pathname: '/salsa' };

beforeEach(() => {
	vi.useFakeTimers();
	Object.assign(now, { openSheets: 0, unsaved: 0, sending: 0 });
	place.href = 'https://x/salsa';
	place.pathname = '/salsa';
	vi.stubGlobal('location', place);
	refresh.mockClear();
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('busy', () => {
	const idle = { openSheets: 0, unsaved: 0, sending: 0, path: '/salsa' };
	it('is idle with nothing open', () => expect(busy(idle)).toBe(false));
	it('is busy with a sheet open', () => expect(busy({ ...idle, openSheets: 1 })).toBe(true));
	it('is busy with an unsaved form', () => expect(busy({ ...idle, unsaved: 1 })).toBe(true));
	it('is busy while a save is out', () => expect(busy({ ...idle, sending: 1 })).toBe(true));
	it('counts the player page as busy', () =>
		expect(busy({ ...idle, path: '/salsa/player' })).toBe(true));
});

describe('refreshWhenIdle', () => {
	it('re-reads at once when nothing is open', async () => {
		refreshWhenIdle();
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('waits while a sheet is open, then re-reads once', async () => {
		now.openSheets = 1;
		refreshWhenIdle();
		await vi.advanceTimersByTimeAsync(IDLE_CHECK_MS * 4);
		expect(refresh).not.toHaveBeenCalled();
		now.openSheets = 0;
		await vi.advanceTimersByTimeAsync(IDLE_CHECK_MS * 4);
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('waits while a guarded form is unsaved', async () => {
		now.unsaved = 1;
		refreshWhenIdle();
		await vi.advanceTimersByTimeAsync(IDLE_CHECK_MS * 4);
		expect(refresh).not.toHaveBeenCalled();
		now.unsaved = 0;
		await vi.advanceTimersByTimeAsync(IDLE_CHECK_MS);
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('three pulls while busy make one re-read', async () => {
		now.openSheets = 1;
		refreshWhenIdle();
		refreshWhenIdle();
		refreshWhenIdle();
		now.openSheets = 0;
		await vi.advanceTimersByTimeAsync(IDLE_CHECK_MS * 4);
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('drops the re-read when the page changed meanwhile', async () => {
		now.openSheets = 1;
		refreshWhenIdle();
		place.href = 'https://x/salsa/figures';
		now.openSheets = 0;
		await vi.advanceTimersByTimeAsync(IDLE_CHECK_MS * 4);
		expect(refresh).not.toHaveBeenCalled();
		// A later pull on the new page re-reads it.
		refreshWhenIdle();
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh).toHaveBeenCalledTimes(1);
	});
});
