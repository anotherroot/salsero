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

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
	createDeviceToken,
	deviceSettings,
	listDevices,
	userForDeviceToken
} from '$lib/server/devices';
import { defaultStylesFor } from '$lib/server/default-styles';
import { dailyCountOf } from '$lib/server/today-picks';
import { levelOf } from '$lib/server/levels';
import { localeOf } from '$lib/server/locale';
import { withLocale } from '$lib/i18n/current';
import { runInLocale } from '$lib/server/i18n-request';
import { t } from '$lib/i18n/catalog';
import { actions, load } from './+page.server';

const USER = {
	id: 'u1',
	email: 'u1@example.com',
	timezone: 'Europe/Ljubljana',
	dance: 'bachata' as const
};
const OTHER = { ...USER, id: 'u2', email: 'u2@example.com' };
const T0 = 1_760_000_000_000;

const jar = new Map<string, string>();

function post(fields: Record<string, string>, user = USER, cookie: string | undefined = 'bachata') {
	return {
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		locals: { user },
		cookies: { get: () => cookie, set: (n: string, v: string) => void jar.set(n, v) },
		parent: async () => ({ appDance: user.dance })
	};
}
type Event = ReturnType<typeof post>;
const call = (action: unknown, event: Event) => (action as (e: Event) => Promise<unknown>)(event);

let db: Db;

beforeEach(() => {
	jar.clear();
	db = openDb(':memory:');
	handle.db = db;
	for (const u of [USER, OTHER]) {
		db.insert(users)
			.values({ id: u.id, email: u.email, passwordHash: 'x', timezone: u.timezone, dance: 'salsa' })
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
	// Catches: the form's dance writing a row in a dance the account is not of.
	it("saves the account's own dance, whatever the form says", async () => {
		const before = defaultStylesFor(db, 'u1');
		await call(actions.style, post({ dance: 'salsa', style: 'traditional' }));
		const after = defaultStylesFor(db, 'u1');
		expect(after.bachata).toBe('traditional');
		expect(after.salsa).toBe(before.salsa);
	});
	it('refuses a style the dance does not have', async () => {
		expect(await call(actions.style, post({ style: 'son' }))).toMatchObject({
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

describe('dailyCount', () => {
	it('stores a number in range and refuses the rest', async () => {
		expect(await call(actions.dailyCount, post({ count: '8' }))).toEqual({ ok: true });
		expect(dailyCountOf(db, 'u1')).toBe(8);
		const data = (await (load as (e: unknown) => unknown)(post({}))) as { dailyCount: number };
		expect(data.dailyCount).toBe(8);
		for (const count of ['0', '31', 'abc', '', '2.5']) {
			expect(await call(actions.dailyCount, post({ count }))).toMatchObject({ status: 400 });
		}
		expect(dailyCountOf(db, 'u1')).toBe(8);
		expect(dailyCountOf(db, 'u2')).toBe(5);
	});
});

describe('level', () => {
	it('stores one of the three and rejects junk', async () => {
		expect(await call(actions.level, post({ level: 'follow' }))).toEqual({ ok: true });
		expect(levelOf(db, 'u1')).toBe('follow');
		const data = (await (load as (e: unknown) => unknown)(post({}))) as { level: unknown };
		expect(data.level).toBe('follow');
		for (const level of ['x', '', 'ALL', 'follow ']) {
			expect(await call(actions.level, post({ level }))).toMatchObject({ status: 400 });
		}
		expect(await call(actions.level, post({}))).toMatchObject({ status: 400 });
		expect(levelOf(db, 'u1')).toBe('follow');
		expect(levelOf(db, 'u2')).toBeNull();
	});
});

describe('language', () => {
	it('stores a known language on the account and in the cookie', async () => {
		expect(await call(actions.language, post({ locale: 'sl' }))).toEqual({ ok: true });
		expect(localeOf(db, 'u1')).toBe('sl');
		expect(jar.get('lang')).toBe('sl');
		expect(localeOf(db, 'u2')).toBeNull();
	});

	it('rejects junk and changes nothing', async () => {
		for (const locale of ['xx', '', 'slovenian', 'en-GB']) {
			expect(await call(actions.language, post({ locale }))).toMatchObject({ status: 400 });
		}
		expect(await call(actions.language, post({}))).toMatchObject({ status: 400 });
		expect(localeOf(db, 'u1')).toBeNull();
		expect(jar.size).toBe(0);
	});

	it('says the refusal in the current language', () => {
		expect(t().settings.badLanguage).toBe('Pick a language.');
		expect(withLocale('sl', () => t().settings.badLanguage)).toBe('Izberite jezik.');
		expect(withLocale('sl', () => t().settings.language)).toBe('Jezik');
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

describe('ask for more', () => {
	it('opens one request per person and says when one is waiting', async () => {
		db.update(users).set({ storageLimitBytes: 1000 }).where(eq(users.id, 'u1')).run();
		expect(await call(actions.ask, post({ note: 'hi' }))).toMatchObject({ asked: true });
		expect(await call(actions.ask, post({ note: 'again' }))).toMatchObject({ asked: false });
		const data = (await (load as (e: unknown) => unknown)(post({}))) as {
			asked: string;
			storage: unknown;
		};
		expect(data.asked).toMatch(/waiting$/);
		expect(data.storage as object).toMatchObject({ limitBytes: 1000 });
	});
});

describe('ask for more with no limit', () => {
	it('is refused, opening nothing', async () => {
		const res = (await call(actions.ask, post({ note: 'hi' }))) as { status?: number };
		// u1 in this spec has no limit set
		expect(res.status).toBe(400);
		const data = (await (load as (e: unknown) => unknown)(post({}))) as { asked: string | null };
		expect(data.asked).toBeNull();
	});
});

describe('refusals in Slovenian', () => {
	const sl = (fn: () => Promise<unknown>) => runInLocale('sl', fn);

	it('words each refusal in the person’s language', async () => {
		expect(
			await sl(() => call(actions.name, post({ firstName: '', lastName: 'B' })))
		).toMatchObject({ status: 400, data: { message: 'Vnesite svoje ime (največ 60 znakov).' } });
		expect(await sl(() => call(actions.theme, post({ theme: 'pink' })))).toMatchObject({
			data: { message: 'Izberite eno od tem.' }
		});
		expect(await sl(() => call(actions.style, post({ style: 'x' })))).toMatchObject({
			data: { message: 'Izberite enega od slogov.' }
		});
		expect(await sl(() => call(actions.reminder, post({ reminder: 'x' })))).toMatchObject({
			data: { message: 'Izberite uro ali opomnik izklopite.' }
		});
		expect(await sl(() => call(actions.videoSize, post({ shortSide: '1' })))).toMatchObject({
			data: { message: 'Izberite eno od velikosti.' }
		});
		expect(await sl(() => call(actions.level, post({ level: 'x' })))).toMatchObject({
			data: { message: 'Izberite eno od treh možnosti.' }
		});
		expect(await sl(() => call(actions.dailyCount, post({ count: '99' })))).toMatchObject({
			data: { message: 'Izberite število od 1 do 30.' }
		});
		expect(await sl(() => call(actions.removeDevice, post({ id: '999' })))).toMatchObject({
			data: { message: 'Ta telefon je že odstranjen.' }
		});
		expect(await sl(() => call(actions.restoreDevice, post({ id: '999' })))).toMatchObject({
			data: { message: 'Prepozno za razveljavitev.' }
		});
		expect(await sl(() => call(actions.ask, post({})))).toMatchObject({
			data: { message: 'Nimate omejitve, zato vam ni treba prositi za več.' }
		});
	});

	it('words the load’s lines', async () => {
		const data = (await sl(async () => (load as (e: unknown) => unknown)(post({})))) as {
			ownVoice: string;
		};
		expect(data.ownVoice).toBe('0 od 21 tempov z vašim glasom');
	});
});
