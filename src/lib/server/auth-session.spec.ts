import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { users } from './db/schema';
import { createSession, validateSession } from './auth';

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
});

function addUser(id: string, dance: 'salsa' | 'bachata' | null) {
	db.insert(users).values({ id, email: 'same@example.com', passwordHash: 'x', dance }).run();
}

describe('validateSession', () => {
	// Catches: locals.user without the account's dance, so the wall has nothing to compare.
	it("carries the account's dance", () => {
		addUser('u1', 'bachata');
		const { id } = createSession('u1', db);
		expect(validateSession(id, db)?.dance).toBe('bachata');
	});

	// Catches: an account the split has not placed signing in to either dance.
	it('signs nobody in for an account with no dance', () => {
		addUser('u1', null);
		const { id } = createSession('u1', db);
		expect(validateSession(id, db)).toBeNull();
	});

	// Catches: the old unique email, which would refuse a second dance's account.
	it('lets one email hold an account in each dance', () => {
		addUser('u1', 'salsa');
		addUser('u2', 'bachata');
		expect(() => addUser('u3', 'salsa')).toThrow();
	});
});
