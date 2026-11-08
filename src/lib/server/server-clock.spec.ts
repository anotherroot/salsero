import { describe, expect, it } from 'vitest';
import { serverNow } from './server-clock';
import { findInServer } from './server-sources';

describe('one clock for the server', () => {
	it('is the wall clock', () => {
		expect(Math.abs(serverNow() - Date.now())).toBeLessThan(50);
	});

	it('reads the time only through serverNow', () => {
		// Replay (offline phase 3) sets the clock to when a change was made, so a
		// read that skips it would date a replayed change by the server's time.
		expect(
			findInServer(/\bDate\.now\b|new Date\(\s*\)/, ['src/lib/server/server-clock.ts'])
		).toEqual([]);
	});
});
