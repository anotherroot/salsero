import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import { figures, positions } from './db/schema';

describe('positions schema', () => {
	it('stores a position and a figure tagged with start and end', () => {
		const db = openDb(':memory:');
		const open = db
			.insert(positions)
			.values({ dance: 'salsa', slug: 'open-two', name: 'Open, two hands', neutral: true })
			.returning()
			.get();
		expect(open.neutral).toBe(true);
		expect(open.sortOrder).toBe(0);

		const fig = db
			.insert(figures)
			.values({ name: 'enchufla', dance: 'salsa', endPositionId: open.id })
			.returning()
			.get();
		expect(fig.endPositionId).toBe(open.id);
		// Defaults: every existing figure keeps behaving as it does today.
		expect(fig.eights).toBe(1);
	});
});
