import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import { figures, positions } from './db/schema';
import {
	archivePosition,
	createPosition,
	getPosition,
	listPositions,
	liveNameTaken,
	neutralPosition,
	restorePosition,
	updatePosition
} from './positions';
import { seedPositions } from './test-positions';

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

	it('brings an archived position back when its name is added again', () => {
		// Removing a position archives it, and the archived row keeps its slug —
		// so adding "Cradle" again used to hit the clash and be refused for good.
		const db = openDb(':memory:');
		const first = createPosition(db, 'bachata', {
			slug: 'cradle',
			name: 'Cradle',
			neutral: false,
			sortOrder: 3
		})!;
		expect(archivePosition(db, first.id, 1000)).toBe(true);

		const again = createPosition(db, 'bachata', {
			slug: 'cradle',
			name: 'Cradle (wrap)',
			neutral: false,
			sortOrder: 7
		});
		// The same row, live again, under the name just typed — so a figure still
		// tagged with it keeps pointing at the position it always meant.
		expect(again).toMatchObject({
			id: first.id,
			archivedAt: null,
			name: 'Cradle (wrap)',
			sortOrder: 7
		});
		expect(listPositions(db, 'bachata').map((p) => p.id)).toContain(first.id);
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

	it('refuses to promote an archived position to neutral', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const closed = listPositions(db, 'salsa').find((p) => p.slug === 'closed')!;
		expect(archivePosition(db, closed.id, Date.now())).toBe(true);
		// No route sends `neutral: true` for an archived row today, but the data
		// layer must refuse it anyway: an archived row is hidden from the
		// pickers and the gap report, so promoting one would make the dance's
		// neutral point at a position nothing ever shows.
		expect(updatePosition(db, closed.id, { ...closed, neutral: true })).toBeNull();
		expect(neutralPosition(db, 'salsa')!.slug).toBe('open-two');
	});
});

describe('archivePosition', () => {
	it('archives a non-neutral position, dropping it from the list; a second archive fails', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const closed = listPositions(db, 'salsa').find((p) => p.slug === 'closed')!;
		expect(archivePosition(db, closed.id, Date.now())).toBe(true);
		expect(listPositions(db, 'salsa').some((p) => p.id === closed.id)).toBe(false);
		expect(archivePosition(db, closed.id, Date.now())).toBe(false);
	});
});

describe('restorePosition', () => {
	const setup = () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const row = listPositions(db, 'salsa').find((p) => !p.neutral)!;
		return { db, row };
	};

	it('brings a removed position back with its name and its figures still tagged', () => {
		const { db, row } = setup();
		const fig = db
			.insert(figures)
			.values({ name: 'enchufla', dance: 'salsa', endPositionId: row.id })
			.returning()
			.get();
		archivePosition(db, row.id, 5);
		expect(restorePosition(db, row.id)).toBe(true);
		const back = getPosition(db, row.id)!;
		expect(back.archivedAt).toBeNull();
		expect(back.name).toBe(row.name);
		expect(listPositions(db, 'salsa').map((p) => p.id)).toContain(row.id);
		expect(db.select().from(figures).where(eq(figures.id, fig.id)).get()!.endPositionId).toBe(
			row.id
		);
	});

	it('does nothing to a live position, or one that does not exist', () => {
		const { db, row } = setup();
		expect(restorePosition(db, row.id)).toBe(false);
		expect(getPosition(db, row.id)).toEqual(row);
		expect(restorePosition(db, 99999)).toBe(false);
	});

	it('after the name was added again, leaves exactly one live position', () => {
		const { db, row } = setup();
		archivePosition(db, row.id, 5);
		createPosition(db, 'salsa', { slug: row.slug, name: row.name, neutral: false, sortOrder: 3 });
		expect(restorePosition(db, row.id)).toBe(false);
		expect(listPositions(db, 'salsa').filter((p) => p.slug === row.slug)).toHaveLength(1);
	});
});

describe('liveNameTaken and restorePosition with a twin name', () => {
	it('folds accents and case, and leaves the row itself out', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const caida = listPositions(db, 'salsa').find((p) => p.slug === 'caida')!;
		expect(liveNameTaken(db, 'salsa', 'CAIDA')).toBe(true);
		expect(liveNameTaken(db, 'salsa', 'caida', caida.id)).toBe(false);
		expect(liveNameTaken(db, 'bachata', 'Caída')).toBe(false);
	});

	it('refuses to restore a row whose name a live position now has', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const caida = listPositions(db, 'salsa').find((p) => p.slug === 'caida')!;
		archivePosition(db, caida.id, 5);
		createPosition(db, 'salsa', { slug: 'ca-da', name: 'Caída', neutral: false, sortOrder: 99 });
		expect(restorePosition(db, caida.id)).toBe(false);
		expect(getPosition(db, caida.id)!.archivedAt).toBe(5);
	});
});
