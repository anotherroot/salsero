import { describe, expect, it } from 'vitest';
import { openDb } from '../db';
import { slotFor } from './slots';
import { deviceSlots } from '../db/schema';
import { parseDeviceLabel } from '$lib/devices/label';

describe('device slots', () => {
	it('hands the first device slot 1, the next slot 2', () => {
		const db = openDb(':memory:');
		expect(slotFor(db, 'u1', 'dev-a', 1)).toBe(1);
		expect(slotFor(db, 'u1', 'dev-b', 2)).toBe(2);
	});

	it('gives the same key the same slot, whoever asks', () => {
		const db = openDb(':memory:');
		expect(slotFor(db, 'u1', 'dev-a', 1)).toBe(1);
		expect(slotFor(db, 'u2', 'dev-a', 2)).toBe(1);
		expect(slotFor(db, 'u1', 'dev-a', 3)).toBe(1);
	});

	it('never hands out the server slot 0', () => {
		const db = openDb(':memory:');
		const slots = ['a', 'b', 'c'].map((k, i) => slotFor(db, 'u1', `dev-${k}`, i));
		expect(slots).not.toContain(0);
		expect(Math.min(...slots)).toBe(1);
	});
});

describe('the slot keeps what the device is (offline phase 4c)', () => {
	const ANDROID =
		'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36';
	const label = (db: ReturnType<typeof openDb>) =>
		db.select({ label: deviceSlots.label }).from(deviceSlots).get()?.label ?? null;

	it('stores the label from the user agent, and follows a change', () => {
		const db = openDb(':memory:');
		slotFor(db, 'u1', 'dev-a', 1, ANDROID);
		expect(parseDeviceLabel(label(db))).toEqual({ kind: 'android', model: 'Pixel 8' });
		slotFor(db, 'u1', 'dev-a', 2, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)');
		expect(parseDeviceLabel(label(db))).toEqual({ kind: 'iphone', model: null });
	});

	it('no user agent: the label stays as it was', () => {
		const db = openDb(':memory:');
		slotFor(db, 'u1', 'dev-a', 1, ANDROID);
		slotFor(db, 'u1', 'dev-a', 2);
		expect(parseDeviceLabel(label(db))?.model).toBe('Pixel 8');
	});
});
