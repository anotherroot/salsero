/**
 * Settings saves each control on its own. `getDb()` is mocked per test, as in
 * `lesson-forms.spec.ts`; nothing opens the real database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
	createDeviceToken,
	deviceSettings,
	listDevices,
	userForDeviceToken
} from '$lib/server/devices';
import { defaultStylesFor } from '$lib/server/default-styles';
import { actions, load } from './+page.server';

const USER = { id: 'u1', email: 'u1@example.com', timezone: 'Europe/Ljubljana' };
const OTHER = { id: 'u2', email: 'u2@example.com', timezone: 'Europe/Ljubljana' };
const T0 = 1_760_000_000_000;

function post(fields: Record<string, string>, user = USER, cookie: string | undefined = 'bachata') {
	return {
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		locals: { user },
		cookies: { get: () => cookie },
		// the root layout's `lastDance`: the cookie's dance, else salsa
		parent: async () => ({ lastDance: cookie ?? 'salsa' })
	};
}
type Event = ReturnType<typeof post>;
const call = (action: unknown, event: Event) => (action as (e: Event) => Promise<unknown>)(event);

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const u of [USER, OTHER]) {
		db.insert(users)
			.values({ id: u.id, email: u.email, passwordHash: 'x', timezone: u.timezone })
			.run();
	}
});
afterEach(() => vi.useRealTimers());

describe('load', () => {
	it('is the dance of the cookie', async () => {
		const data = (await (load as (e: unknown) => unknown)(post({}))) as Record<string, unknown>;
		expect(data.dance).toBe('bachata');
		expect(['bachata', 'sensual', 'dominicana', 'other']).toContain(data.defaultStyle);
		expect(data.ownVoice).toBe('0 of 21 tempos in your own voice');
	});
});

describe('style', () => {
	it('saves one dance only', async () => {
		const before = defaultStylesFor(db, 'u1');
		await call(actions.style, post({ dance: 'bachata', style: 'sensual' }));
		const after = defaultStylesFor(db, 'u1');
		expect(after.bachata).toBe('sensual');
		expect(after.salsa).toBe(before.salsa);
	});
	it('refuses a style the dance does not have', async () => {
		expect(await call(actions.style, post({ dance: 'bachata', style: 'son' }))).toMatchObject({
			status: 400
		});
	});
});

describe('reminder', () => {
	it('sets, clears and refuses', async () => {
		await call(actions.reminder, post({ reminder: '07:30' }));
		expect(deviceSettings(db, 'u1').reminderMinute).toBe(450);
		await call(actions.reminder, post({ reminder: '' }));
		expect(deviceSettings(db, 'u1').reminderMinute).toBeNull();
		// A missing field is not "off".
		await call(actions.reminder, post({ reminder: '07:30' }));
		expect(await call(actions.reminder, post({}))).toMatchObject({ status: 400 });
		expect(deviceSettings(db, 'u1').reminderMinute).toBe(450);
		await call(actions.reminder, post({ reminder: '' }));
		expect(await call(actions.reminder, post({ reminder: '25:00' }))).toMatchObject({
			status: 400
		});
	});
});

describe('videoSize', () => {
	it('sets and refuses', async () => {
		await call(actions.videoSize, post({ shortSide: '720' }));
		expect(deviceSettings(db, 'u1').shortSide).toBe(720);
		expect(await call(actions.videoSize, post({ shortSide: '500' }))).toMatchObject({
			status: 400
		});
	});
});

describe('removing a phone and Undo', () => {
	it('puts the same phone back, once', async () => {
		const { id, token } = createDeviceToken(db, 'u1', 'Phone', T0);
		expect(await call(actions.removeDevice, post({ id: String(id) }))).toEqual({ removed: id });
		expect(userForDeviceToken(db, token, T0)).toBeNull();
		expect(await call(actions.restoreDevice, post({ id: String(id) }))).toEqual({ ok: true });
		expect(userForDeviceToken(db, token, T0)?.id).toBe('u1');
		expect(listDevices(db, 'u1')).toHaveLength(1);
		expect(await call(actions.restoreDevice, post({ id: String(id) }))).toMatchObject({
			status: 410,
			data: { message: 'Too late to undo.' }
		});
		expect(listDevices(db, 'u1')).toHaveLength(1);
	});

	it("never touches another user's phone", async () => {
		const { id, token } = createDeviceToken(db, 'u1', 'Phone', T0);
		expect(await call(actions.removeDevice, post({ id: String(id) }, OTHER))).toMatchObject({
			status: 404,
			data: { message: 'That phone is already gone.' }
		});
		expect(userForDeviceToken(db, token, T0)).not.toBeNull();

		await call(actions.removeDevice, post({ id: String(id) }));
		expect(await call(actions.restoreDevice, post({ id: String(id) }, OTHER))).toMatchObject({
			status: 410
		});
		expect(listDevices(db, 'u1')).toHaveLength(0);
		expect(listDevices(db, 'u2')).toHaveLength(0);
		expect(await call(actions.restoreDevice, post({ id: String(id) }))).toEqual({ ok: true });
		expect(userForDeviceToken(db, token, T0)?.id).toBe('u1');
	});

	it('is too late after the hold ran out', async () => {
		vi.useFakeTimers();
		const { id } = createDeviceToken(db, 'u1', 'Phone', T0);
		await call(actions.removeDevice, post({ id: String(id) }));
		vi.advanceTimersByTime(60_000);
		expect(await call(actions.restoreDevice, post({ id: String(id) }))).toMatchObject({
			status: 410
		});
		expect(listDevices(db, 'u1')).toHaveLength(0);
	});
});
