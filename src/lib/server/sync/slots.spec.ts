import { describe, expect, it } from 'vitest';
import { openDb } from '../db';
import { slotFor } from './slots';

describe('device slots', () => {
	it('hands the first device slot 1, the next slot 2', () => {
		const db = openDb(':memory:');
		expect(slotFor(db, 'u1', 'dev-a', 1)).toBe(1);
		expect(slotFor(db, 'u1', 'dev-b', 2)).toBe(2);
	});

	it('gives the same key the same slot, whoever asks', () => {
		const db = openDb(':memory:');
		expect(slotFor(db, 'u1', 'dev-a', 1)).toBe(1);
		expect(slotFor(db, 'u2', 'dev-a', 2)).toBe(1);
		expect(slotFor(db, 'u1', 'dev-a', 3)).toBe(1);
	});

	it('never hands out the server slot 0', () => {
		const db = openDb(':memory:');
		const slots = ['a', 'b', 'c'].map((k, i) => slotFor(db, 'u1', `dev-${k}`, i));
		expect(slots).not.toContain(0);
		expect(Math.min(...slots)).toBe(1);
	});
});
