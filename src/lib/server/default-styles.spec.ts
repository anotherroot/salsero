import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { defaultStyles, users } from './db/schema';
import { defaultStyle, defaultStylesFor, setDefaultStyle } from './default-styles';

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	for (const id of ['u1', 'u2']) {
		db.insert(users)
			.values({ id, email: `${id}@example.com`, passwordHash: 'x' })
			.run();
	}
});

describe('default styles', () => {
	it("fall back to the registry's: salsa for salsa, sensual for bachata", () => {
		expect(defaultStylesFor(db, 'u1')).toEqual({ salsa: 'salsa', bachata: 'sensual' });
	});

	it('remember a pick per user and dance, and overwrite it', () => {
		setDefaultStyle(db, 'u1', 'bachata', 'dominican');
		setDefaultStyle(db, 'u1', 'bachata', 'traditional');
		setDefaultStyle(db, 'u1', 'salsa', 'son');
		expect(defaultStylesFor(db, 'u1')).toEqual({ salsa: 'son', bachata: 'traditional' });
		expect(defaultStyle(db, 'u2', 'bachata')).toBe('sensual');
	});

	it('refuse a style the dance does not have', () => {
		expect(() => setDefaultStyle(db, 'u1', 'bachata', 'son')).toThrow(RangeError);
		expect(defaultStyle(db, 'u1', 'bachata')).toBe('sensual');
	});

	it('fall back when a stored style is no longer one of the dance', () => {
		db.insert(defaultStyles).values({ userId: 'u1', dance: 'salsa', style: 'gone' }).run();
		expect(defaultStyle(db, 'u1', 'salsa')).toBe('salsa');
	});
});
