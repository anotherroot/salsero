import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { users } from './db/schema';
import { listAppsSeen, noteAppSeen } from './app-seen';
import type { AppAgent } from '$lib/app-update/agent';

let db: Db;
const T0 = 1_760_000_000_000;
const salsa: AppAgent = { versionCode: 2, dance: 'salsa', channel: 'direct' };

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users).values({ id: 'u1', email: 'u1@example.com', passwordHash: 'x' }).run();
});

describe('noteAppSeen', () => {
	it('inserts the first sighting', () => {
		noteAppSeen(db, 'u1', salsa, T0);
		expect(listAppsSeen(db)).toEqual([
			{ userId: 'u1', dance: 'salsa', versionCode: 2, channel: 'direct', seenAt: T0 }
		]);
	});

	it('skips the write when nothing changed within a minute', () => {
		noteAppSeen(db, 'u1', salsa, T0);
		noteAppSeen(db, 'u1', salsa, T0 + 10_000);
		expect(listAppsSeen(db)[0].seenAt).toBe(T0);
	});

	it('updates after a minute', () => {
		noteAppSeen(db, 'u1', salsa, T0);
		noteAppSeen(db, 'u1', salsa, T0 + 61_000);
		expect(listAppsSeen(db)[0].seenAt).toBe(T0 + 61_000);
	});

	it('updates at once when the version changes', () => {
		noteAppSeen(db, 'u1', salsa, T0);
		noteAppSeen(db, 'u1', { ...salsa, versionCode: 3 }, T0 + 1_000);
		const [row] = listAppsSeen(db);
		expect(row.versionCode).toBe(3);
		expect(row.seenAt).toBe(T0 + 1_000);
	});

	it('keeps salsa and bachata apart', () => {
		noteAppSeen(db, 'u1', salsa, T0);
		noteAppSeen(db, 'u1', { ...salsa, dance: 'bachata' }, T0);
		expect(listAppsSeen(db)).toHaveLength(2);
	});

	it('goes with the user', () => {
		noteAppSeen(db, 'u1', salsa, T0);
		db.delete(users).where(eq(users.id, 'u1')).run();
		expect(listAppsSeen(db)).toEqual([]);
	});
});
