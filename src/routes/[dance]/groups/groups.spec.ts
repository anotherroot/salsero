/** The Groups routes: who reaches a group, what a member may not write, and Join. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { exercises, teamChanges, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createTeam, joinTeam, roleOf } from '$lib/server/teams';
import { setRole } from '$lib/server/membership';
import { requireExerciseAccess, requireTeam } from '$lib/server/scope';
import { actions as listActions } from './+page.server';
import { load as listLoad } from './+layout.server';
import { actions as pageActions, load as pageLoad } from './[id]/+page.server';
import { actions as peopleActions, load as peopleLoad } from './[id]/people/+page.server';
import { actions as joinActions, load as joinLoad } from '../../g/[code]/+page.server';
import { getTeam } from '$lib/server/teams';
import { runInLocale } from '$lib/server/i18n-request';

let db: Db;
let teamId: number;
let code: string;

const user = (id: string) => ({ id, isAdmin: false, timezone: 'UTC', dance: 'salsa' });
const ev = (uid: string | null, extra: Record<string, unknown> = {}, dance = 'salsa') =>
	({
		params: { dance, id: String(teamId), code },
		locals: { user: uid ? user(uid) : null },
		url: new URL('http://localhost/x'),
		...extra
	}) as never;
const post = (fields: Record<string, string>) =>
	new Request('http://localhost/x', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields)
	});
/** Runs a load or action and returns what it threw (status), or its value. */
async function run(fn: () => unknown) {
	try {
		return { value: await fn() };
	} catch (e) {
		const x = e as { status?: number; location?: string; body?: { message?: string } };
		return { status: x.status, location: x.location, message: x.body?.message };
	}
}

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const id of ['owner', 'member', 'outsider'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id, lastName: 'Q' })
			.run();
	const made = createTeam(db, 'owner', 'salsa', 'Class', 1);
	if (!made.ok) throw new Error('setup');
	teamId = made.teamId;
	code = getTeam(db, teamId)!.code;
	joinTeam(db, 'member', teamId, 2);
});

describe('requireTeam', () => {
	const p = (dance = 'salsa', id = String(teamId)) => ({ dance, id });
	it('lets a member read and refuses a higher need', () => {
		expect(requireTeam(db, { user: user('member') } as never, p(), 'member').role).toBe('member');
		expect(() => requireTeam(db, { user: user('member') } as never, p(), 'owner')).toThrow();
	});
	it('404s an outsider, the wrong dance, a missing and a bad id', () => {
		const out = { user: user('outsider') } as never;
		const mem = { user: user('member') } as never;
		expect(() => requireTeam(db, out, p(), 'member')).toThrow();
		expect(() => requireTeam(db, mem, p('bachata'), 'member')).toThrow();
		expect(() => requireTeam(db, mem, p('salsa', '999'), 'member')).toThrow();
		expect(() => requireTeam(db, mem, p('salsa', 'x'), 'member')).toThrow();
	});
	it('gives 401 when signed out', () => {
		expect(() => requireTeam(db, { user: null } as never, p(), 'member')).toThrow();
	});
	it('hides a deleted group from its members but not its owner', async () => {
		await run(() => pageActions.delete!(ev('owner')));
		expect(() => requireTeam(db, { user: user('member') } as never, p(), 'member')).toThrow();
		expect(requireTeam(db, { user: user('owner') } as never, p(), 'owner').role).toBe('owner');
	});
});

describe('the group page', () => {
	it('404s an outsider on the page and on People', async () => {
		expect((await run(() => pageLoad(ev('outsider')))).status).toBe(404);
		expect((await run(() => peopleLoad(ev('outsider')))).status).toBe(404);
	});
	it('shows the code to an owner, not to a member', async () => {
		const o = (await run(() => pageLoad(ev('owner')))).value as { code: unknown };
		const m = (await run(() => pageLoad(ev('member')))).value as { code: unknown };
		expect(o.code).toBeTruthy();
		expect(m.code).toBeNull();
	});
	it('an owner renames and remakes the code; a member gets 404', async () => {
		const before = code;
		const r = await run(() =>
			pageActions.rename!(ev('owner', { request: post({ name: 'Renamed' }) }))
		);
		expect(r.status).toBeUndefined();
		expect(getTeam(db, teamId)!.name).toBe('Renamed');
		await pageActions.remakeCode!(ev('owner'));
		expect(getTeam(db, teamId)!.code).not.toBe(before);
		expect((await run(() => pageActions.remakeCode!(ev('member')))).status).toBe(404);
		expect(
			(await run(() => pageActions.rename!(ev('member', { request: post({ name: 'X' }) })))).status
		).toBe(404);
		expect((await run(() => pageActions.delete!(ev('member')))).status).toBe(404);
	});
	it('leaving sends a member to the list; the owner cannot leave', async () => {
		const r = await run(() => pageActions.leave!(ev('member', { request: post({ mode: 'all' }) })));
		expect(r.location).toBe('/salsa/groups');
		expect(roleOf(db, 'member', teamId)).toBeNull();
		const o = await run(() => pageActions.leave!(ev('owner', { request: post({ mode: 'all' }) })));
		expect((o.value as { status: number }).status).toBe(400);
	});
	it('delete then restore by the owner; a deleted group takes no other action', async () => {
		const d = await run(() => pageActions.delete!(ev('owner')));
		expect(d.location).toBe('/salsa/groups');
		expect((await run(() => pageActions.remakeCode!(ev('owner')))).status).toBe(404);
		const page = (await run(() => pageLoad(ev('owner')))).value as {
			team: { deletedAt: number | null };
			code: unknown;
		};
		expect(page.team.deletedAt).not.toBeNull();
		expect(page.code).toBeNull();
		await pageActions.restore!(ev('owner'));
		expect(getTeam(db, teamId)!.deletedAt).toBeNull();
	});
});

describe('People', () => {
	it('a member reads but every write is a 404', async () => {
		expect((await run(() => peopleLoad(ev('member')))).value).toBeTruthy();
		for (const [name, fields] of [
			['role', { userId: 'member', role: 'editor' }],
			['handOver', { userId: 'member' }],
			['remove', { userId: 'member' }]
		] as const)
			expect(
				(await run(() => peopleActions[name]!(ev('member', { request: post(fields) })))).status
			).toBe(404);
		expect(roleOf(db, 'member', teamId)).toBe('member');
	});
	it('the owner sets a role, hands over, removes', async () => {
		await peopleActions.role!(ev('owner', { request: post({ userId: 'member', role: 'editor' }) }));
		expect(roleOf(db, 'member', teamId)).toBe('editor');
		await peopleActions.remove!(ev('owner', { request: post({ userId: 'member' }) }));
		expect(roleOf(db, 'member', teamId)).toBeNull();
		joinTeam(db, 'member', teamId, 3);
		await peopleActions.handOver!(ev('owner', { request: post({ userId: 'member' }) }));
		expect(roleOf(db, 'member', teamId)).toBe('owner');
		expect(roleOf(db, 'owner', teamId)).toBe('editor');
	});
	it('a person outside the group is a 404, not an action', async () => {
		const r = await run(() =>
			peopleActions.remove!(ev('owner', { request: post({ userId: 'outsider' }) }))
		);
		expect(r.status).toBe(404);
	});
	it('says so when the new owner is at their limit', async () => {
		createTeam(db, 'member', 'salsa', 'A', 3);
		createTeam(db, 'member', 'salsa', 'B', 4);
		const r = await run(() =>
			peopleActions.handOver!(ev('owner', { request: post({ userId: 'member' }) }))
		);
		expect((r.value as { status: number; data: { message: string } }).data.message).toMatch(
			/as many groups/
		);
		expect(setRole).toBeTruthy();
	});
});

describe('the list', () => {
	it('lists mine and creates; a refusal says the limit', async () => {
		const l = (await run(() => listLoad(ev('owner')))).value as { teams: { name: string }[] };
		expect(l.teams.map((t) => t.name)).toEqual(['Class']);
		const made = await run(() =>
			listActions.create!(ev('owner', { request: post({ name: 'Two' }) }))
		);
		expect(made.location).toMatch(/^\/salsa\/groups\/\d+$/);
		const over = await run(() =>
			listActions.create!(ev('owner', { request: post({ name: 'Three' }) }))
		);
		expect((over.value as { data: { message: string } }).data.message).toBe(
			'You can make 2 groups. Ask the admin for more.'
		);
	});
});

describe('Join', () => {
	it('adds a signed-in non-member and goes to the group', async () => {
		const loaded = (await run(() => joinLoad(ev('outsider')))).value as {
			name: string;
			people: number;
		};
		expect(loaded.name).toBe('Class');
		expect(loaded.people).toBe(2);
		const r = await run(() => joinActions.join!(ev('outsider')));
		expect(r.location).toBe(`/salsa/groups/${teamId}`);
		expect(roleOf(db, 'outsider', teamId)).toBe('member');
	});
	it('sends someone already in straight to the group', async () => {
		const r = await run(() => joinLoad(ev('member')));
		expect(r.location).toBe(`/salsa/groups/${teamId}`);
	});
	it('404s a stale code, also after it was remade', async () => {
		const stale = code;
		await pageActions.remakeCode!(ev('owner'));
		const e = { params: { code: stale }, locals: { user: user('outsider') } } as never;
		const r = await run(() => joinLoad(e));
		expect(r.status).toBe(404);
		expect(r.message).toBe('This code no longer works');
		expect((await run(() => joinActions.join!(e))).status).toBe(404);
		expect(roleOf(db, 'outsider', teamId)).toBeNull();
	});
	// Catches: a salsa account joining a bachata group by its link (the dance split).
	it("is a stale code to an account of another dance than the group's", async () => {
		const b = createTeam(db, 'owner', 'bachata', 'Bachata class', 5);
		if (!b.ok) throw new Error('setup');
		const c = getTeam(db, b.teamId)!.code;
		const e = { params: { dance: 'salsa', code: c }, locals: { user: user('outsider') } } as never;
		expect((await run(() => joinLoad(e))).status).toBe(404);
		expect((await run(() => joinActions.join!(e))).status).toBe(404);
		expect(roleOf(db, 'outsider', b.teamId)).toBeNull();
	});
});

// Catches: a Groups refusal composed in English (or at import time) for a
// Slovenian reader: New group, Rename, Restore, People and Join with a code.
describe('the Groups refusals in Slovenian', () => {
	const sl = <T>(fn: () => Promise<T>) => runInLocale('sl', fn);
	const dataOf = (r: { value?: unknown }) => (r.value as { data: { message: string } }).data;

	it('words New group’s and Rename’s refusals', async () => {
		createTeam(db, 'owner', 'salsa', 'Two', 3);
		const over = await sl(() =>
			run(() => listActions.create!(ev('owner', { request: post({ name: 'Three' }) })))
		);
		expect(dataOf(over).message).toBe('Ustvarite lahko 2 skupini. Za več vprašajte skrbnika.');
		const taken = await sl(() =>
			run(() => pageActions.rename!(ev('owner', { request: post({ name: 'Two' }) })))
		);
		expect(dataOf(taken).message).toBe(
			'Vnesite ime z največ 60 znaki, ki ga nima nobena vaša skupina.'
		);
	});

	it('words Restore’s refusal when a live group has the name', async () => {
		await run(() => pageActions.delete!(ev('owner')));
		createTeam(db, 'owner', 'salsa', 'Class', 4);
		const r = await sl(() => run(() => pageActions.restore!(ev('owner'))));
		expect(dataOf(r).message).toBe('Skupino s tem imenom že imate. Najprej preimenujte tisto.');
	});

	it('words People’s refusals', async () => {
		const role = await sl(() =>
			run(() =>
				peopleActions.role!(ev('owner', { request: post({ userId: 'member', role: 'x' }) }))
			)
		);
		expect(dataOf(role).message).toBe('Izberite vlogo.');
		const owner = await sl(() =>
			run(() =>
				peopleActions.role!(ev('owner', { request: post({ userId: 'owner', role: 'member' }) }))
			)
		);
		expect(dataOf(owner).message).toBe(
			'Vodja obdrži skupino. Če želite to spremeniti, jo predajte drugemu.'
		);
		const self = await sl(() =>
			run(() => peopleActions.handOver!(ev('owner', { request: post({ userId: 'owner' }) })))
		);
		expect(dataOf(self).message).toBe('Izberite nekoga drugega iz skupine.');
		const removeOwner = await sl(() =>
			run(() => peopleActions.remove!(ev('owner', { request: post({ userId: 'owner' }) })))
		);
		expect(dataOf(removeOwner).message).toBe(
			'Vodje ni mogoče odstraniti. Najprej predajte skupino.'
		);
		createTeam(db, 'member', 'salsa', 'A', 5);
		createTeam(db, 'member', 'salsa', 'B', 6);
		const limit = await sl(() =>
			run(() => peopleActions.handOver!(ev('owner', { request: post({ userId: 'member' }) })))
		);
		expect(dataOf(limit).message).toBe('Ta oseba že vodi toliko skupin, kot jih lahko ustvari.');
		const stranger = await sl(() =>
			run(() => peopleActions.remove!(ev('owner', { request: post({ userId: 'outsider' }) })))
		);
		expect(stranger).toMatchObject({ status: 404, message: 'Te osebe ni' });
	});

	it('words a join refusal and a missing group', async () => {
		const unknown = await sl(() =>
			run(() => listActions.joinCode!(ev('outsider', { request: post({ code: 'NOPE' }) })))
		);
		expect(dataOf(unknown).message).toBe(
			'Noben tečaj nima te kode. Preverite jo in poskusite znova.'
		);
		await run(() => pageActions.delete!(ev('owner')));
		const deleted = await sl(() =>
			run(() => listActions.joinCode!(ev('outsider', { request: post({ code }) })))
		);
		expect(dataOf(deleted).message).toBe(
			'Ta tečaj je bil izbrisan, zato se mu ne morete pridružiti.'
		);
		const gone = await sl(() => run(() => peopleLoad(ev('owner'))));
		expect(gone).toMatchObject({ status: 404, message: 'Te skupine ni' });
	});
});

describe('New drill on the group page', () => {
	it("makes a drill of the group's, logged, and opens it", async () => {
		const r = await run(() =>
			pageActions.createDrill!(ev('owner', { request: post({ name: 'Shines', notes: 'Slow' }) }))
		);
		const drill = db.select().from(exercises).where(eq(exercises.name, 'Shines')).get();
		expect(drill).toMatchObject({ teamId, userId: null, source: 'custom', notes: 'Slow' });
		expect(r.status).toBe(303);
		expect(r.location).toBe(`/salsa/exercises/${drill!.id}`);
		const log = db.select().from(teamChanges).where(eq(teamChanges.teamId, teamId)).all();
		expect(log.some((c) => c.rootKind === 'drill' && c.rootId === drill!.id)).toBe(true);
		// Its page opens for the group's editors before any lesson links it.
		expect(
			requireExerciseAccess(
				db,
				{ user: user('owner') } as never,
				{ dance: 'salsa' },
				drill!.id,
				'edit'
			).exercise.id
		).toBe(drill!.id);
	});
	it('refuses an empty name under the field', async () => {
		const r = await run(() =>
			pageActions.createDrill!(ev('owner', { request: post({ name: ' ' }) }))
		);
		expect((r.value as { status: number; data: { field: string } }).data.field).toBe('name');
		expect(db.select().from(exercises).all()).toHaveLength(0);
	});
	it('words its refusals and a deleted group in Slovenian', async () => {
		const sl = <T>(fn: () => Promise<T>) => runInLocale('sl', fn);
		const empty = await sl(() =>
			run(() => pageActions.createDrill!(ev('owner', { request: post({ name: ' ' }) })))
		);
		expect((empty.value as { data: { message: string } }).data.message).toBe(
			'Vnesite ime (do 200 znakov).'
		);
		const long = await sl(() =>
			run(() =>
				pageActions.createDrill!(
					ev('owner', { request: post({ name: 'X', notes: 'n'.repeat(2001) }) })
				)
			)
		);
		expect((long.value as { data: { message: string } }).data.message).toBe(
			'Opombe so lahko dolge do 2000 znakov.'
		);
		await run(() => pageActions.delete!(ev('owner')));
		const deleted = await sl(() =>
			run(() => pageActions.createDrill!(ev('owner', { request: post({ name: 'X' }) })))
		);
		expect(deleted).toMatchObject({ status: 404, message: 'Te skupine ni' });
	});
	it('404s a member and a deleted group', async () => {
		const asMember = await run(() =>
			pageActions.createDrill!(ev('member', { request: post({ name: 'X' }) }))
		);
		expect(asMember.status).toBe(404);
		await run(() => pageActions.delete!(ev('owner')));
		const deleted = await run(() =>
			pageActions.createDrill!(ev('owner', { request: post({ name: 'X' }) }))
		);
		expect(deleted.status).toBe(404);
		expect(db.select().from(exercises).all()).toHaveLength(0);
	});
});
