import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import { figures, positions } from './db/schema';
import {
	createPosition,
	listPositions,
	neutralPosition,
	seedPositions,
	updatePosition
} from './positions';

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

describe('seedPositions', () => {
	it('seeds each dance once and is idempotent', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const first = listPositions(db, 'salsa');
		expect(first.length).toBeGreaterThan(5);
		expect(listPositions(db, 'bachata').length).toBeGreaterThan(5);

		seedPositions(db);
		expect(listPositions(db, 'salsa')).toHaveLength(first.length);
	});

	it('gives each dance its own neutral, and they differ', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		expect(neutralPosition(db, 'salsa')?.slug).toBe('open-two');
		expect(neutralPosition(db, 'bachata')?.slug).toBe('closed');
	});

	it('leaves a dance alone once it has positions of its own', () => {
		const db = openDb(':memory:');
		createPosition(db, 'salsa', { slug: 'mine', name: 'Mine', neutral: true, sortOrder: 0 });
		seedPositions(db);
		expect(listPositions(db, 'salsa').map((p) => p.slug)).toEqual(['mine']);
		// The other dance is seeded independently.
		expect(listPositions(db, 'bachata').length).toBeGreaterThan(5);
	});
});

describe('createPosition', () => {
	it('keeps exactly one neutral per dance', () => {
		const db = openDb(':memory:');
		const a = createPosition(db, 'salsa', {
			slug: 'a',
			name: 'A',
			neutral: true,
			sortOrder: 0
		})!;
		const b = createPosition(db, 'salsa', {
			slug: 'b',
			name: 'B',
			neutral: true,
			sortOrder: 1
		})!;
		expect(neutralPosition(db, 'salsa')!.id).toBe(b.id);
		expect(listPositions(db, 'salsa').find((p) => p.id === a.id)!.neutral).toBe(false);
	});

	it('refuses a duplicate slug within a dance but allows it across dances', () => {
		const db = openDb(':memory:');
		const input = { slug: 'open-two', name: 'Open', neutral: false, sortOrder: 0 };
		expect(createPosition(db, 'salsa', input)).not.toBeNull();
		expect(createPosition(db, 'salsa', input)).toBeNull();
		expect(createPosition(db, 'bachata', input)).not.toBeNull();
	});
});

describe('updatePosition', () => {
	it('renames without disturbing the neutral', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const open = neutralPosition(db, 'salsa')!;
		const row = updatePosition(db, open.id, {
			slug: open.slug,
			name: 'Open, both hands',
			neutral: true,
			sortOrder: open.sortOrder
		});
		expect(row!.name).toBe('Open, both hands');
		expect(neutralPosition(db, 'salsa')!.id).toBe(open.id);
	});

	it('moves the neutral, leaving exactly one', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const closed = listPositions(db, 'salsa').find((p) => p.slug === 'closed')!;
		updatePosition(db, closed.id, { ...closed, neutral: true });
		expect(neutralPosition(db, 'salsa')!.id).toBe(closed.id);
		expect(listPositions(db, 'salsa').filter((p) => p.neutral)).toHaveLength(1);
	});

	it('refuses to demote the last neutral, leaving the dance with one', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const open = neutralPosition(db, 'salsa')!;
		// Nothing else is neutral, so clearing this one would leave none — and an
		// untagged figure would have no position to resolve to.
		expect(updatePosition(db, open.id, { ...open, neutral: false })).toBeNull();
		expect(neutralPosition(db, 'salsa')!.id).toBe(open.id);
	});
});
