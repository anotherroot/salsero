import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { deviceTokens, users } from './db/schema';
import { archiveExercise, createCustomExercise, logSet, updateExercise } from './exercises';
import {
	bearerToken,
	createDeviceToken,
	deviceSettings,
	dueByDance,
	listDevices,
	removeDevice,
	setReminderMinute,
	setVideoShortSide,
	userForDeviceToken
} from './devices';

let db: Db;
const T0 = 1_760_000_000_000;

function addUser(id: string) {
	db.insert(users)
		.values({ id, email: `${id}@example.com`, passwordHash: 'x', timezone: 'Europe/Ljubljana' })
		.run();
}

beforeEach(() => {
	db = openDb(':memory:');
	addUser('u1');
	addUser('u2');
});

describe('device tokens', () => {
	it('resolve to the user who paired them', () => {
		const { token } = createDeviceToken(db, 'u1', 'Phone', T0);
		expect(userForDeviceToken(db, token, T0)).toEqual({
			id: 'u1',
			email: 'u1@example.com',
			timezone: 'Europe/Ljubljana'
		});
	});

	it('are stored only as a hash', () => {
		const { id, token } = createDeviceToken(db, 'u1', 'Phone', T0);
		const row = db.select().from(deviceTokens).where(eq(deviceTokens.id, id)).get()!;
		expect(row.tokenHash).not.toBe(token);
		expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('do not resolve when unknown or removed', () => {
		const { id, token } = createDeviceToken(db, 'u1', 'Phone', T0);
		expect(userForDeviceToken(db, 'nope', T0)).toBeNull();
		expect(userForDeviceToken(db, '', T0)).toBeNull();
		expect(removeDevice(db, 'u1', id)).toBe(true);
		expect(userForDeviceToken(db, token, T0)).toBeNull();
	});

	it('cannot be removed by another user', () => {
		const { id, token } = createDeviceToken(db, 'u1', 'Phone', T0);
		expect(removeDevice(db, 'u2', id)).toBe(false);
		expect(userForDeviceToken(db, token, T0)).not.toBeNull();
	});

	it('record last use at most once a minute', () => {
		const { token } = createDeviceToken(db, 'u1', 'Phone', T0);
		const lastUsed = () => listDevices(db, 'u1')[0].lastUsedAt;
		expect(lastUsed()).toBeNull();
		userForDeviceToken(db, token, T0 + 1000);
		expect(lastUsed()).toBe(T0 + 1000);
		userForDeviceToken(db, token, T0 + 31_000);
		expect(lastUsed()).toBe(T0 + 1000);
		userForDeviceToken(db, token, T0 + 62_000);
		expect(lastUsed()).toBe(T0 + 62_000);
	});

	it("list only the user's own, newest first", () => {
		createDeviceToken(db, 'u1', 'Old', T0);
		createDeviceToken(db, 'u1', 'New', T0 + 5);
		createDeviceToken(db, 'u2', 'Theirs', T0 + 9);
		expect(listDevices(db, 'u1').map((d) => d.label)).toEqual(['New', 'Old']);
	});
});

describe('device settings', () => {
	it('default to no reminder and 480p', () => {
		expect(deviceSettings(db, 'u1')).toEqual({ reminderMinute: null, shortSide: 480 });
	});

	it('save a reminder time and a size', () => {
		setReminderMinute(db, 'u1', 18 * 60);
		setVideoShortSide(db, 'u1', 720);
		expect(deviceSettings(db, 'u1')).toEqual({ reminderMinute: 1080, shortSide: 720 });
		expect(deviceSettings(db, 'u2')).toEqual({ reminderMinute: null, shortSide: 480 });
		setReminderMinute(db, 'u1', null);
		expect(deviceSettings(db, 'u1').reminderMinute).toBeNull();
	});

	it('refuse values outside the range and change nothing', () => {
		setReminderMinute(db, 'u1', 600);
		expect(() => setReminderMinute(db, 'u1', 1440)).toThrow(RangeError);
		expect(() => setReminderMinute(db, 'u1', -1)).toThrow(RangeError);
		expect(() => setReminderMinute(db, 'u1', 1.5)).toThrow(RangeError);
		expect(() => setVideoShortSide(db, 'u1', 600)).toThrow(RangeError);
		expect(deviceSettings(db, 'u1')).toEqual({ reminderMinute: 600, shortSide: 480 });
	});
});

describe('bearerToken', () => {
	it('takes the token from a Bearer header only', () => {
		expect(bearerToken('Bearer abc')).toBe('abc');
		expect(bearerToken('Basic abc')).toBeNull();
		expect(bearerToken('Bearer ')).toBeNull();
		expect(bearerToken(null)).toBeNull();
	});
});

describe('dueByDance', () => {
	const DAY = 86_400_000;
	const ex = (dance: 'salsa' | 'bachata', name: string, everyDays = 1) =>
		createCustomExercise(db, dance, { name, everyDays, notes: null });
	const done = (exerciseId: number, doneAt: number) =>
		logSet(db, {
			exerciseId,
			doneAt,
			durationS: null,
			reps: null,
			rating: null,
			note: null,
			playerJson: null
		});

	it('gives each dance its own due list, most urgent first', () => {
		// Created least urgent first, so insertion order is NOT the expected order.
		const mild = ex('salsa', 'Mild');
		const urgent = ex('salsa', 'Urgent');
		done(mild.id, T0 - 3 * DAY);
		done(urgent.id, T0 - 10 * DAY);
		ex('bachata', 'Basics');
		expect(dueByDance(db, T0, 'Europe/Ljubljana')).toEqual({
			salsa: { due: ['Urgent', 'Mild'] },
			bachata: { due: ['Basics'] }
		});
	});

	it('leaves out what was done today, parked, archived or not yet due', () => {
		const today = ex('salsa', 'Today');
		done(today.id, T0 - 60_000);
		const parked = ex('salsa', 'Parked');
		updateExercise(db, parked.id, { name: 'Parked', everyDays: 1, active: false, notes: null });
		const gone = ex('salsa', 'Gone');
		archiveExercise(db, gone.id, T0);
		const weekly = ex('salsa', 'Weekly', 7);
		done(weekly.id, T0 - 2 * DAY);
		expect(dueByDance(db, T0, 'Europe/Ljubljana').salsa.due).toEqual([]);
	});
});
