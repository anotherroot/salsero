import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { setRole } from '$lib/server/membership';
import { POST } from './+server';

function call(uid: string, fields: Record<string, string>) {
	const sets: unknown[][] = [];
	const deletes: unknown[][] = [];
	const cookies = {
		set: (...a: unknown[]) => sets.push(a),
		delete: (...a: unknown[]) => deletes.push(a),
		get: () => undefined
	};
	const event = {
		params: { dance: 'salsa' },
		locals: { user: { id: uid, isAdmin: false, timezone: 'UTC' } },
		request: new Request('http://localhost/x', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		cookies,
		url: new URL('http://localhost/salsa/group-mode')
	} as never;
	return Promise.resolve(POST(event)).then(
		() => ({ sets, deletes, status: 0, location: '' }),
		(e: { status: number; location?: string }) => ({
			sets,
			deletes,
			status: e.status,
			location: e.location ?? ''
		})
	);
}

beforeEach(() => {
	const db = openDb(':memory:');
	for (const id of ['u1', 'u2', 'u3'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Tuesdays', 1);
	joinTeam(db, 'u2', 1, 2);
	joinTeam(db, 'u3', 1, 2);
	setRole(db, 1, 'u2', 'editor');
	handle.db = db;
});

describe('POST /[dance]/group-mode', () => {
	it('an editor switches in and returns', async () => {
		const r = await call('u2', { team: '1', to: '/salsa/routines' });
		expect(r.status).toBe(303);
		expect(r.location).toBe('/salsa/routines');
		expect(r.sets[0].slice(0, 2)).toEqual(['group_salsa', '1']);
	});
	it('a member is refused', async () => {
		const r = await call('u3', { team: '1', to: '/salsa/routines' });
		expect(r.status).toBe(404);
		expect(r.sets).toHaveLength(0);
	});
	it('mine deletes the cookie', async () => {
		const r = await call('u2', { team: 'mine', to: '/salsa/lessons' });
		expect(r.status).toBe(303);
		expect(r.deletes[0][0]).toBe('group_salsa');
		expect(r.sets).toHaveLength(0);
	});
	it('an off-site return goes to Moves', async () => {
		const r = await call('u2', { team: '1', to: '//x' });
		expect(r.location).toBe('/salsa/figures');
	});
	it('junk is 404', async () => {
		expect((await call('u2', { team: 'abc' })).status).toBe(404);
	});
});
