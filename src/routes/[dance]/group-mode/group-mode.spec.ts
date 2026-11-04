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
import { readFileSync } from 'node:fs';
import { actions, load } from './+page.server';
import { load as layoutLoad } from '../+layout.server';

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
	return Promise.resolve(actions.default(event)).then(
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

describe('the /[dance]/group-mode action', () => {
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

describe('GET /[dance]/group-mode', () => {
	it('is no page: it lands on Moves', () => {
		let thrown: { status?: number; location?: string } = {};
		try {
			load({ params: { dance: 'salsa' } } as never);
		} catch (e) {
			thrown = e as typeof thrown;
		}
		expect(thrown).toMatchObject({ status: 303, location: '/salsa/figures' });
	});
});

/** The [dance] layout reads group mode; it never switches it (preload runs it too). */
function layoutAt(uid: string, path: string, cookie: string | undefined) {
	const sets: unknown[][] = [];
	const deletes: unknown[][] = [];
	const cookies = {
		set: (...a: unknown[]) => sets.push(a),
		delete: (...a: unknown[]) => deletes.push(a),
		get: (name: string) => (name === 'group_salsa' ? cookie : undefined)
	};
	const data = layoutLoad({
		params: { dance: 'salsa' },
		locals: { user: { id: uid, isAdmin: false, timezone: 'UTC' } },
		cookies,
		url: new URL(`http://localhost${path}`)
	} as never) as { groupMode: { teamId: number } | null };
	return {
		groupMode: data.groupMode,
		deletes,
		groupSets: sets.filter((a) => a[0] === 'group_salsa')
	};
}

describe('the [dance] layout and the group cookie', () => {
	it('outside Today it reads group mode and leaves the cookie alone', () => {
		const r = layoutAt('u2', '/salsa/figures', '1');
		expect(r.groupMode?.teamId).toBe(1);
		expect(r.deletes).toEqual([]);
		expect(r.groupSets).toEqual([]);
	});
	it('on Today’s pages it shows no group mode and does NOT delete the cookie', () => {
		for (const path of ['/salsa', '/salsa/exercises/3']) {
			const r = layoutAt('u2', path, '1');
			expect(r.groupMode).toBeNull();
			expect(r.deletes).toEqual([]);
			expect(r.groupSets).toEqual([]);
		}
	});
	it('an invalid cookie is dropped (a validity check, not navigation)', () => {
		const r = layoutAt('u3', '/salsa/figures', '1');
		expect(r.groupMode).toBeNull();
		expect(r.deletes.map((d) => d[0])).toEqual(['group_salsa']);
	});
});

describe('Mine in the tab bar', () => {
	it('posts team=mine to the switch action, back to the same tab’s own list', () => {
		const src = readFileSync('src/lib/components/shell/BottomNav.svelte', 'utf8');
		const form = /<form[\s\S]*?action="\/\{dance\}\/group-mode"[\s\S]*?<\/form>/.exec(src)?.[0];
		expect(form).toBeDefined();
		expect(form).toMatch(/method="POST"/);
		expect(form).toMatch(/name="team" value="mine"/);
		expect(form).toMatch(/name="to" value=\{minePath\(path, dance\)\}/);
		expect(form).toMatch(/>Mine</);
		// No link may lead to Today in its place.
		expect(src).not.toMatch(/href=\{resolve\('\/\[dance\]', \{ dance \}\)\}/);
	});
});
