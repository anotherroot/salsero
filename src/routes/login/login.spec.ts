import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DANCE_HOSTS: 'salsa.anotherroot.eu=salsa,bachata.anotherroot.eu=bachata' }
}));
const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { users } from '$lib/server/db/schema';
import { hashPassword } from '$lib/server/password';
import { runInLocale } from '$lib/server/i18n-request';
import { actions, load } from './+page.server';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
});
const run = (next: string) =>
	load({
		url: new URL(`http://localhost/login?next=${encodeURIComponent(next)}`),
		parent: async () => ({ appDance: 'salsa' })
	} as never) as Promise<{ noAccount: string | null }>;

describe('login', () => {
	it('says who to ask for an invite when the way back is a group link', async () => {
		db.insert(users)
			.values({
				id: 'a',
				email: 'a@x.si',
				passwordHash: 'x',
				isAdmin: true,
				firstName: 'Tilen',
				dance: 'salsa'
			})
			.run();
		expect((await run('/g/ABC')).noAccount).toBe(
			'This code only adds people who already have an account. Ask Tilen for an invite.'
		);
	});
	it('falls back to "the admin" and stays quiet for other pages', async () => {
		expect((await run('/g/ABC')).noAccount).toContain('Ask the admin for an invite');
		expect((await run('/salsa')).noAccount).toBeNull();
	});
	// Catches: the login page's line left in English, or a name declined inside the sentence.
	it('says who to ask in Slovenian, the name after a colon', async () => {
		expect((await runInLocale('sl', () => run('/g/ABC'))).noAccount).toBe(
			'Ta koda doda le tiste, ki že imajo račun. Za povabilo se obrnite na skrbnika.'
		);
		db.insert(users)
			.values({
				id: 'a',
				email: 'a@x.si',
				passwordHash: 'x',
				isAdmin: true,
				firstName: 'Tilen',
				dance: 'salsa'
			})
			.run();
		expect((await runInLocale('sl', () => run('/g/ABC'))).noAccount).toBe(
			'Ta koda doda le tiste, ki že imajo račun. Za povabilo se obrnite na skrbnika: Tilen.'
		);
	});
});

describe('signing in, per dance', () => {
	const signIn = async (host: string, password: string) => {
		const set = vi.fn();
		try {
			const r = await (actions.default as (e: unknown) => Promise<unknown>)({
				request: new Request(`https://${host}/login`, {
					method: 'POST',
					headers: { 'content-type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({ email: 'me@x.si', password, next: '/' })
				}),
				url: new URL(`https://${host}/login`),
				cookies: { set },
				getClientAddress: () => '1.2.3.4'
			});
			return { result: r, set };
		} catch (thrown) {
			return { result: thrown, set };
		}
	};

	beforeEach(async () => {
		db.insert(users)
			.values([
				{ id: 's', email: 'me@x.si', dance: 'salsa', passwordHash: await hashPassword('pw-salsa') },
				{
					id: 'b',
					email: 'me@x.si',
					dance: 'bachata',
					passwordHash: await hashPassword('pw-bachata')
				}
			])
			.run();
	});

	// Catches: the salsa account signing in on the bachata host, or a hint that it exists.
	it("refuses the other dance's password with the plain message", async () => {
		const { result, set } = await signIn('bachata.anotherroot.eu', 'pw-salsa');
		expect(result).toMatchObject({
			status: 400,
			data: { message: 'Incorrect email or password.' }
		});
		expect(set).not.toHaveBeenCalled();
	});

	// Catches: the login finding the first account with the email, whichever dance.
	it("signs in to the host's dance's account", async () => {
		const { result, set } = await signIn('bachata.anotherroot.eu', 'pw-bachata');
		expect(result).toMatchObject({ status: 303 });
		const sessionId = set.mock.calls[0][1] as string;
		const row = db.all<{ user_id: string }>(
			`select user_id from sessions where id = '${sessionId}'`
		);
		expect(row[0].user_id).toBe('b');
	});

	// Catches: the login page after signing out drawn in English for a Slovenian account.
	it("remembers the account's language in the cookie", async () => {
		db.update(users).set({ locale: 'sl' }).where(eq(users.id, 's')).run();
		const sl = await signIn('salsa.anotherroot.eu', 'pw-salsa');
		expect(sl.result).toMatchObject({ status: 303 });
		expect(sl.set).toHaveBeenCalledWith('lang', 'sl', expect.objectContaining({ path: '/' }));
		const none = await signIn('bachata.anotherroot.eu', 'pw-bachata');
		expect(none.result).toMatchObject({ status: 303 });
		expect(none.set).toHaveBeenCalledWith('lang', 'en', expect.anything());
	});

	it('refuses in Slovenian when the page is Slovenian', async () => {
		const { result } = await runInLocale('sl', () => signIn('salsa.anotherroot.eu', 'wrong'));
		expect(result).toMatchObject({ status: 400, data: { message: 'Napačna e-pošta ali geslo.' } });
	});

	it('a refused sign-in leaves the cookie alone', async () => {
		db.update(users).set({ locale: 'sl' }).where(eq(users.id, 's')).run();
		const { set } = await signIn('salsa.anotherroot.eu', 'wrong');
		expect(set).not.toHaveBeenCalled();
	});
});
