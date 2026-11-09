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
		locals: { user: { id: uid, isAdmin: false, timezone: 'UTC', dance: 'salsa' } },
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

// The switch is kept for pages opened before the group view: it lands on the address
// in the chosen view (`?in=`) and writes no cookie.
describe('the /[dance]/group-mode action', () => {
	it('an editor switches in: the same list with in', async () => {
		const r = await call('u2', { team: '1', to: '/salsa/routines' });
		expect(r.status).toBe(303);
		expect(r.location).toBe('/salsa/routines?in=1');
		expect(r.sets).toHaveLength(0);
	});
	it('a member is refused', async () => {
		const r = await call('u3', { team: '1', to: '/salsa/routines' });
		expect(r.status).toBe(404);
	});
	it('mine drops in and keeps the rest', async () => {
		const r = await call('u2', { team: 'mine', to: '/salsa/lessons?in=1&q=x' });
		expect(r.status).toBe(303);
		expect(r.location).toBe('/salsa/lessons?q=x');
		expect(r.deletes).toHaveLength(0);
	});
	it('an off-site return goes to Moves', async () => {
		const r = await call('u2', { team: '1', to: '//x' });
		expect(r.location).toBe('/salsa/figures?in=1');
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

/** The [dance] layout reads the view from the address; it writes nothing (preload runs it too). */
function layoutAt(uid: string, path: string, routeId: string, id?: string) {
	const sets: unknown[][] = [];
	const deletes: unknown[][] = [];
	const cookies = {
		set: (...a: unknown[]) => sets.push(a),
		delete: (...a: unknown[]) => deletes.push(a),
		get: () => undefined
	};
	const data = layoutLoad({
		params: id === undefined ? { dance: 'salsa' } : { dance: 'salsa', id },
		route: { id: routeId },
		locals: { user: { id: uid, isAdmin: false, timezone: 'UTC', dance: 'salsa' } },
		cookies,
		url: new URL(`http://localhost${path}`)
	} as never) as { groupMode: { teamId: number } | null };
	return { groupMode: data.groupMode, writes: sets.length + deletes.length };
}

describe('the [dance] layout and the view', () => {
	it('a list follows its in, writing nothing', () => {
		const r = layoutAt('u2', '/salsa/figures?in=1', '/[dance]/(moves)/figures');
		expect(r.groupMode?.teamId).toBe(1);
		expect(r.writes).toBe(0);
		expect(layoutAt('u2', '/salsa/figures', '/[dance]/(moves)/figures').groupMode).toBeNull();
	});
	it('Today’s pages are never in a group’s view', () => {
		expect(layoutAt('u2', '/salsa?in=1', '/[dance]/(today)').groupMode).toBeNull();
		expect(layoutAt('u2', '/salsa/done?in=1', '/[dance]/(today)/done').groupMode).toBeNull();
	});
	it('a member’s in is no view', () => {
		expect(layoutAt('u3', '/salsa/figures?in=1', '/[dance]/(moves)/figures').groupMode).toBeNull();
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
		expect(form).toMatch(/>\{t\(\)\.shell\.mine\}</);
		// No link may lead to Today in its place.
		expect(src).not.toMatch(/href=\{resolve\('\/\[dance\]', \{ dance \}\)\}/);
	});
});
