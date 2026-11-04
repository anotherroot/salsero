/**
 * Every spec that opens `openDb(':memory:')` replays all the migrations, and
 * on a loaded machine the full suite crossed vitest's 5 s default. The limit
 * lives in vite.config.ts (`testTimeout` and `hookTimeout`, 15 s).
 */
import { describe, expect, it } from 'vitest';

describe('the suite', () => {
	// Catches: the config's longer timeout dropped (or not reaching the project).
	it('gives a test 15 s', ({ task }) => {
		expect(task.timeout).toBe(15_000);
	});
});
