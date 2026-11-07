import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema';
import { createInvite } from '$lib/server/invites';
import { actions as adminActions, load as adminLoad } from '../admin/+page.server';
import { actions, load } from './+page.server';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	db.insert(users)
		.values({
			id: 'admin',
			email: 'a@example.com',
			passwordHash: 'x',
			isAdmin: true,
			dance: 'salsa'
		})
		.run();
});

const parent = async () => ({ appDance: 'salsa' });

function post(fields: Record<string, string>, cookie?: string) {
	const set = vi.fn();
	return {
		set,
		event: {
			request: new Request('http://localhost/join', {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams(fields)
			}),
			cookies: { set, get: (n: string) => (n === 'salsa_app' ? cookie : undefined) },
			getClientAddress: () => '1.2.3.4',
			url: new URL('http://localhost/join')
		}
	};
}
const run = (e: unknown) => (actions.default as (e: unknown) => Promise<unknown>)(e);

describe('join', () => {
	it('load: a dead code is invalid, a live one valid', async () => {
		const url = (c: string) => new URL(`http://localhost/join?code=${c}`);
		const dead = await (load as (e: unknown) => Promise<unknown>)({ url: url('x'), parent });
		expect(dead).toMatchObject({ valid: false });
		const { code } = createInvite(db, 'admin', 'salsa', Date.now());
		const live = await (load as (e: unknown) => Promise<unknown>)({ url: url(code), parent });
		expect(live).toMatchObject({ valid: true });
	});

	it('the action signs the new person in and redirects to /app', async () => {
		const { code } = createInvite(db, 'admin', 'salsa', Date.now());
		const { event, set } = post({
			code,
			email: 'New@Example.com',
			firstName: 'Ana',
			lastName: 'Kranjc',
			password: 'Correct-Horse-9',
			timezone: 'UTC'
		});
		await expect(run(event)).rejects.toMatchObject({ status: 303, location: '/app' });
		expect(set).toHaveBeenCalledWith('salsa_session', expect.any(String), expect.anything());
		expect(db.select().from(sessions).all()).toHaveLength(1);
	});

	it('no first or last name fails with the field marked and makes no user', async () => {
		const { code } = createInvite(db, 'admin', 'salsa', Date.now());
		const base = { code, email: 'n@example.com', password: 'Correct-Horse-9' };
		const noFirst = (await run(post({ ...base, lastName: 'K' }).event)) as {
			status: number;
			data: { field: string };
		};
		expect(noFirst.status).toBe(400);
		expect(noFirst.data.field).toBe('firstName');
		const noLast = (await run(post({ ...base, firstName: 'Ana' }).event)) as {
			data: { field: string };
		};
		expect(noLast.data.field).toBe('lastName');
		expect(db.select().from(users).all()).toHaveLength(1);
	});

	it('inside the app the new person goes on to /', async () => {
		const { code } = createInvite(db, 'admin', 'salsa', Date.now());
		const { event } = post(
			{
				code,
				email: 'in@example.com',
				firstName: 'Ana',
				lastName: 'Kranjc',
				password: 'Correct-Horse-9',
				timezone: 'UTC'
			},
			'android'
		);
		await expect(run(event)).rejects.toMatchObject({ status: 303, location: '/' });
	});

	it('a dead code gets the refusal and no account', async () => {
		const { event } = post({
			code: 'nope',
			firstName: 'Ana',
			lastName: 'K',
			email: 'n@example.com',
			password: 'Correct-Horse-9'
		});
		const res = (await run(event)) as { status: number; data: { message: string } };
		expect(res.status).toBe(400);
		expect(res.data.message).toBe('This invite no longer works. Ask for a new one.');
		expect(db.select().from(users).all()).toHaveLength(1);
	});

	// Catches: Join on one dance's host redeeming the other dance's invite.
	it("refuses another dance's invite and makes no account", async () => {
		const { code } = createInvite(db, 'admin', 'bachata', Date.now());
		const { event } = post({
			code,
			firstName: 'Ana',
			lastName: 'K',
			email: 'n@example.com',
			password: 'Correct-Horse-9'
		});
		const res = (await run(event)) as { status: number; data: { message: string } };
		expect(res.data.message).toBe('This invite no longer works. Ask for a new one.');
		expect(db.select().from(users).all()).toHaveLength(1);
	});
});

describe('admin', () => {
	const as = (isAdmin: boolean) => ({
		locals: {
			user: { id: 'admin', email: 'a@example.com', timezone: 'UTC', isAdmin, dance: 'salsa' }
		},
		url: new URL('http://localhost/admin'),
		parent
	});
	it('load is a 404 for a non-admin', async () => {
		await expect((adminLoad as (e: unknown) => Promise<unknown>)(as(false))).rejects.toMatchObject({
			status: 404
		});
	});
	it('the invite action is a 404 for a non-admin and gives the admin a link and a QR', async () => {
		const inv = adminActions.invite as (e: unknown) => Promise<unknown>;
		await expect(inv(as(false))).rejects.toMatchObject({ status: 404 });
		const r = (await inv(as(true))) as { url: string; qr: { size: number } };
		expect(r.url).toMatch(/^http:\/\/localhost\/join\?code=[\w-]{43}&dance=salsa$/);
		expect(r.qr.size).toBeGreaterThan(20);
	});

	it('the login rate limit applies to Join too', async () => {
		for (let i = 0; i < 12; i++) {
			const { event } = post({
				code: 'nope',
				firstName: 'Ana',
				lastName: 'K',
				email: 'r@example.com',
				password: 'Correct-Horse-9'
			});
			await run(event);
		}
		const { event } = post({
			code: 'nope',
			firstName: 'Ana',
			lastName: 'K',
			email: 'r@example.com',
			password: 'Correct-Horse-9'
		});
		expect(await run(event)).toMatchObject({ status: 429 });
	});
});
