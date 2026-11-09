import { describe, expect, it } from 'vitest';
import { openDb } from '../db';
import { isLanded, LANDED_KEEP_MS, markLanded, pruneLanded } from './landed';

describe('landed entries', () => {
	it('knows a landed entry, for its own person only', () => {
		const db = openDb(':memory:');
		expect(isLanded(db, 'e1', 'u1')).toBe(false);
		markLanded(db, 'e1', 'u1', 1000);
		expect(isLanded(db, 'e1', 'u1')).toBe(true);
		expect(isLanded(db, 'e1', 'u2')).toBe(false);
	});

	it('prunes what landed more than 180 days ago', () => {
		expect(LANDED_KEEP_MS).toBe(180 * 24 * 3600_000);
		const db = openDb(':memory:');
		const now = 1_800_000_000_000;
		markLanded(db, 'old', 'u1', now - LANDED_KEEP_MS - 1);
		markLanded(db, 'edge', 'u1', now - LANDED_KEEP_MS);
		markLanded(db, 'new', 'u1', now - 1);
		expect(pruneLanded(db, now)).toBe(1);
		expect(isLanded(db, 'old', 'u1')).toBe(false);
		expect(isLanded(db, 'edge', 'u1')).toBe(true);
		expect(isLanded(db, 'new', 'u1')).toBe(true);
	});
});
