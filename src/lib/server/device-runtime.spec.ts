import { afterEach, describe, expect, it } from 'vitest';
import { openDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { deviceRuntime, deviceUser } from './device-runtime';

const g = globalThis as { __salsaDevice?: unknown };
afterEach(() => {
	delete g.__salsaDevice;
});

describe('deviceRuntime', () => {
	it('carries the device slot', () => {
		g.__salsaDevice = { userId: 'u1', cookies: {}, slot: 4 };
		expect(deviceRuntime()?.slot).toBe(4);
		g.__salsaDevice = { userId: 'u1', cookies: {}, slot: null };
		expect(deviceRuntime()?.slot).toBeNull();
	});

	it('is off unless the device worker set it', () => {
		expect(deviceRuntime()).toBeNull();
		g.__salsaDevice = { userId: 'u1', cookies: { a: 'b' } };
		expect(deviceRuntime()).toEqual({ userId: 'u1', cookies: { a: 'b' } });
	});
});

describe('deviceUser', () => {
	it("builds the session's user shape from the users row", () => {
		const db = openDb(':memory:');
		db.insert(users)
			.values({
				id: 'u1',
				email: 'a@b.c',
				passwordHash: 'x',
				firstName: 'Ana',
				lastName: 'N',
				timezone: 'Europe/Ljubljana',
				isAdmin: false,
				level: 'own',
				dance: 'bachata',
				locale: 'sl',
				createdAt: 1
			} as never)
			.run();
		expect(deviceUser(db, 'u1')).toEqual({
			id: 'u1',
			email: 'a@b.c',
			firstName: 'Ana',
			lastName: 'N',
			timezone: 'Europe/Ljubljana',
			isAdmin: false,
			level: 'own',
			dance: 'bachata',
			locale: 'sl'
		});
	});
	it('is null for a missing row or an unplaced account', () => {
		const db = openDb(':memory:');
		expect(deviceUser(db, 'nobody')).toBeNull();
	});
});
