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

// Screenshots go to a temporary folder, never $DATA_DIR.
const shots = vi.hoisted(() => ({ dir: '' }));
vi.mock('$lib/server/files', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/files')>('$lib/server/files');
	return { ...actual, feedbackDir: () => shots.dir };
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
import { createHash } from 'node:crypto';
import { approve, exchangeCode, listGrants } from '$lib/server/oauth/store';
import { serverNow } from '$lib/server/server-clock';
import { feedbackFor } from '$lib/server/feedback';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

describe('Connected AI apps', () => {
	const connect = (userId = 'u1') => {
		const verifier = 'v'.repeat(50);
		const code = approve(
			db,
			{
				userId,
				clientId: 'https://claude.ai/meta',
				clientName: 'Claude',
				redirectUri: 'https://claude.ai/cb',
				codeChallenge: createHash('sha256').update(verifier).digest('base64url')
			},
			serverNow()
		);
		const r = exchangeCode(
			db,
			{ code, verifier, redirectUri: 'https://claude.ai/cb', clientId: 'https://claude.ai/meta' },
			serverNow()
		);
		if ('error' in r) throw new Error(r.description);
		return listGrants(db, userId, serverNow())[0].id;
	};
	const apps = async () =>
		(
			(await (load as (e: unknown) => unknown)(post({}))) as {
				apps: { id: number; host: string }[];
			}
		).apps;

	it('lists a connected app by its host', async () => {
		const id = connect();
		expect(await apps()).toEqual([expect.objectContaining({ id, host: 'claude.ai' })]);
	});

	it('disconnects, and Undo brings it back', async () => {
		const id = connect();
		expect(await call(actions.disconnectApp, post({ id: String(id) }))).toEqual({ removed: id });
		expect(await apps()).toEqual([]);
		expect(await call(actions.reconnectApp, post({ id: String(id) }))).toEqual({ ok: true });
		expect((await apps()).map((a) => a.id)).toEqual([id]);
	});

	it("never touches another person's app", async () => {
		const id = connect();
		expect(await call(actions.disconnectApp, post({ id: String(id) }, OTHER))).toMatchObject({
			status: 404
		});
		expect((await apps()).map((a) => a.id)).toEqual([id]);
	});
});

describe('feedback', () => {
	it('keeps the message with the app and browser of the request, in the account’s dance', async () => {
		const e = post({
			message: 'The count stops',
			page: '/bachata/moves/3',
			trail: JSON.stringify(['/bachata/moves/3', '/bachata/groups']),
			version: '1762770000000',
			viewport: '390×844'
		});
		const ua =
			'Mozilla/5.0 (Linux; Android 14; wv) Chrome/131.0 Mobile SalsaApp/9 (bachata; direct)';
		const event = {
			...e,
			request: new Request(e.request, {
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					'user-agent': ua
				}
			})
		};
		expect(await call(actions.feedback, event)).toEqual({ sent: true });
		const [row] = feedbackFor(db, 'bachata').open;
		expect(row).toMatchObject({
			email: 'u1@example.com',
			message: 'The count stops',
			page: '/bachata/moves/3',
			appVersion: 9,
			appChannel: 'direct',
			userAgent: ua,
			viewport: '390×844'
		});
	});

	it('refuses an empty message, in the person’s language', async () => {
		const r = (await runInLocale('sl', () => call(actions.feedback, post({ message: ' ' })))) as {
			status: number;
			data: { message: string };
		};
		expect(r.status).toBe(400);
		expect(r.data.message).toBe('Najprej kaj napišite.');
		expect(feedbackFor(db, 'bachata').open).toEqual([]);
	});
});

describe('feedback with a screenshot', () => {
	it('keeps the screenshot beside the message', async () => {
		shots.dir = mkdtempSync(join(tmpdir(), 'shots-'));
		try {
			const body = new FormData();
			body.set('message', 'Look at this');
			body.set('shot', new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1])], { type: 'image/jpeg' }));
			const e = post({});
			const event = { ...e, request: new Request('http://localhost/', { method: 'POST', body }) };
			expect(await call(actions.feedback, event)).toEqual({ sent: true });
			const [row] = feedbackFor(db, 'bachata').open;
			expect(row.shot).toBe(`${row.id}.jpg`);
			expect(readdirSync(shots.dir)).toEqual([`${row.id}.jpg`]);
		} finally {
			rmSync(shots.dir, { recursive: true, force: true });
		}
	});

	it('keeps the message and leaves out a screenshot that is not one', async () => {
		const body = new FormData();
		body.set('message', 'No picture');
		body.set('shot', new Blob(['not a jpeg'], { type: 'image/jpeg' }));
		const e = post({});
		const event = { ...e, request: new Request('http://localhost/', { method: 'POST', body }) };
		expect(await call(actions.feedback, event)).toEqual({ sent: true });
		expect(feedbackFor(db, 'bachata').open[0].shot).toBeNull();
	});
});
