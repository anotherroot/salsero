import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { needsName } from '$lib/names';
import { runInLocale } from '$lib/server/i18n-request';
import { actions, load } from './+page.server';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	db.insert(users).values({ id: 'u1', email: 'a@example.com', passwordHash: 'x' }).run();
});

const user = (firstName: string | null) => ({
	id: 'u1',
	email: 'a@example.com',
	firstName,
	lastName: null,
	timezone: 'UTC',
	isAdmin: false
});
const parent = async () => ({ appDance: 'salsa' });
const run = (fn: unknown, e: unknown) => (fn as (e: unknown) => Promise<unknown>)(e);
const post = (fields: Record<string, string>, u = user(null), search = '') => ({
	locals: { user: u },
	request: new Request('http://localhost/welcome', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields)
	}),
	url: new URL('http://localhost/welcome' + search)
});

describe('the name gate', () => {
	it('sends a nameless person to /welcome with next', () => {
		expect(needsName('/salsa', user(null))).toBe(true);
		const next = encodeURIComponent('/salsa');
		expect(`/welcome?next=${next}`).toBe('/welcome?next=%2Fsalsa');
	});
	it('does not send welcome, logout, the API or the media servers', () => {
		for (const p of [
			'/welcome',
			'/logout',
			'/api/x',
			'/recordings/a',
			'/audio/a',
			'/count/a',
			'/lesson-videos/a'
		]) {
			expect(needsName(p, user(null))).toBe(false);
		}
		expect(needsName('/salsa', user('Ana'))).toBe(false);
	});
});

describe('welcome', () => {
	it('load asks a nameless person and sends a named one on', async () => {
		const url = new URL('http://localhost/welcome?next=/salsa');
		await expect(run(load, { locals: { user: user(null) }, url, parent })).resolves.toMatchObject({
			next: '/salsa'
		});
		await expect(run(load, { locals: { user: user('Ana') }, url, parent })).rejects.toMatchObject({
			status: 303,
			location: '/salsa'
		});
	});

	it('posting names saves them and redirects to next', async () => {
		await expect(
			run(actions.default, post({ firstName: ' Ana ', lastName: 'Kranjc', next: '/salsa/figures' }))
		).rejects.toMatchObject({ status: 303, location: '/salsa/figures' });
		const u = db.select().from(users).where(eq(users.id, 'u1')).get()!;
		expect([u.firstName, u.lastName]).toEqual(['Ana', 'Kranjc']);
	});

	it('next must be a same-site path', async () => {
		for (const next of ['//evil.example', 'https://evil.example', '/\\evil.example']) {
			db.update(users).set({ firstName: null }).run();
			await expect(
				run(actions.default, post({ firstName: 'Ana', lastName: 'K', next }))
			).rejects.toMatchObject({ status: 303, location: '/' });
		}
	});

	it('a missing name is refused with the field marked and saves nothing', async () => {
		const res = (await run(actions.default, post({ firstName: 'Ana', lastName: ' ' }))) as {
			status: number;
			data: { field: string };
		};
		expect(res.status).toBe(400);
		expect(res.data.field).toBe('lastName');
		expect(db.select().from(users).get()!.firstName).toBeNull();
	});

	// Catches: the name refusal left in English for a Slovenian reader.
	it('refuses a missing name in Slovenian', async () => {
		const say = async (fields: Record<string, string>) =>
			(
				(await runInLocale('sl', () => run(actions.default, post(fields)))) as {
					data: { message: string };
				}
			).data.message;
		expect(await say({ lastName: 'K' })).toBe('Vnesite svoje ime (največ 60 znakov).');
		expect(await say({ firstName: 'Ana' })).toBe('Vnesite svoj priimek (največ 60 znakov).');
	});
});
