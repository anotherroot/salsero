import { describe, expect, it } from 'vitest';
import { workerTokenOk } from './worker-auth';

describe('workerTokenOk', () => {
	const token = 'a'.repeat(43);
	it('accepts exactly the bearer token', () => {
		expect(workerTokenOk(`Bearer ${token}`, token)).toBe(true);
	});
	it('refuses anything else, and everything when no token is configured', () => {
		expect(workerTokenOk(`Bearer ${token}x`, token)).toBe(false);
		expect(workerTokenOk(token, token)).toBe(false);
		expect(workerTokenOk(null, token)).toBe(false);
		expect(workerTokenOk('Bearer ', '')).toBe(false);
		expect(workerTokenOk(`Bearer ${token}`, undefined)).toBe(false);
	});
});
