import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { figures } from './db/schema';
import { createFigure } from './figures';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

/** A base figure of one dance, with its exercise. */
const base = (name = 'Enchufla', dance: 'salsa' | 'bachata' = 'salsa') =>
	createFigure(db, dance, {
		name,
		partner: 'partner',
		style: dance === 'salsa' ? 'salsa' : 'dominican',
		notes: null,
		callable: true,
		callText: null
	})!.figure;

describe('figures.parent_id', () => {
	it('is null on a figure and points at the figure on a variation row', () => {
		const parent = base();
		expect(parent.parentId).toBeNull();
		const row = db
			.insert(figures)
			.values({ name: 'Doble', dance: 'salsa', parentId: parent.id })
			.returning()
			.get();
		expect(db.select().from(figures).where(eq(figures.id, row.id)).get()?.parentId).toBe(
			parent.id
		);
	});
});
