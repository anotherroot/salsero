import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { users } from './db/schema';
import { createDeviceToken, removeDevice } from './devices';
import { apiDeviceUser } from './request-user';

let db: Db;
let token: string;
let deviceId: number;
const NOW = 1_760_000_000_000;

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users).values({ id: 'u1', email: 'u1@example.com', passwordHash: 'x' }).run();
	({ token, id: deviceId } = createDeviceToken(db, 'u1', 'Phone', NOW));
});

describe('apiDeviceUser', () => {
	it('signs a device token in on the API', () => {
		expect(apiDeviceUser(db, '/api/device/config', `Bearer ${token}`, NOW)?.id).toBe('u1');
		expect(apiDeviceUser(db, '/api/lessons/3/videos/x', `Bearer ${token}`, NOW)?.id).toBe('u1');
	});

	it('never signs it in on a page', () => {
		expect(apiDeviceUser(db, '/salsa', `Bearer ${token}`, NOW)).toBeNull();
		expect(apiDeviceUser(db, '/settings', `Bearer ${token}`, NOW)).toBeNull();
		expect(apiDeviceUser(db, '/apiary', `Bearer ${token}`, NOW)).toBeNull();
	});

	it("never stands in for the worker's token", () => {
		expect(apiDeviceUser(db, '/api/worker/next', `Bearer ${token}`, NOW)).toBeNull();
	});

	it('refuses a removed token, a wrong one, and none', () => {
		expect(apiDeviceUser(db, '/api/device/config', 'Bearer nope', NOW)).toBeNull();
		expect(apiDeviceUser(db, '/api/device/config', null, NOW)).toBeNull();
		removeDevice(db, 'u1', deviceId);
		expect(apiDeviceUser(db, '/api/device/config', `Bearer ${token}`, NOW)).toBeNull();
	});
});
