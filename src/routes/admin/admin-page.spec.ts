import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

vi.mock('$lib/server/storage', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/storage')>('$lib/server/storage');
	return { ...actual, freeDisk: async () => 8 * 1024 ** 3 };
});

import { openDb, type Db } from '$lib/server/db';
import { storageRequests, teams, users } from '$lib/server/db/schema';
import { noteAppSeen } from '$lib/server/app-seen';
import { askForMore, storageOf } from '$lib/server/storage';
import { createLesson } from '$lib/server/lessons';
import { T1_SALSA } from '$lib/server/test-walls';
import { createTeam } from '$lib/server/teams';
import { eq } from 'drizzle-orm';
import { actions, load } from './+page.server';

const GB = 1024 ** 3;
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
	db.insert(users)
		.values({
			id: 'p',
			email: 'p@example.com',
			passwordHash: 'x',
			storageLimitBytes: GB,
			dance: 'salsa'
		})
		.run();
});

type Ev = (e: unknown) => Promise<unknown>;
function ev(isAdmin: boolean, fields: Record<string, string> = {}) {
	return {
		locals: {
			user: { id: isAdmin ? 'admin' : 'p', email: 'x', timezone: 'UTC', isAdmin, dance: 'salsa' }
		},
		request: new Request('http://localhost/admin', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		url: new URL('http://localhost/admin'),
		parent: async () => ({ appDance: 'salsa' })
	};
}
const act = (
	name: 'grant' | 'decline' | 'setLimit' | 'setTeamLimit' | 'setGroupLimit',
	e: unknown
) => (actions[name] as unknown as Ev)(e);

describe('admin page', () => {
	it('load and every action are a 404 for a non-admin', async () => {
		await expect((load as unknown as Ev)(ev(false))).rejects.toMatchObject({ status: 404 });
		for (const name of ['grant', 'decline', 'setLimit'] as const) {
			await expect(act(name, ev(false, { id: '1', preset: '2' }))).rejects.toMatchObject({
				status: 404
			});
		}
		expect(storageOf(db, 'p').limitBytes).toBe(GB);
	});

	it('load lists requests and people with calendar days', async () => {
		askForMore(db, { userId: 'p' }, 'please', Date.UTC(2026, 10, 2, 12));
		const d = (await (load as unknown as Ev)(ev(true))) as {
			requests: { day: string; email: string }[];
			people: { email: string }[];
		};
		expect(d.requests).toMatchObject([{ email: 'p@example.com', day: '2026-11-02' }]);
		expect(d.people.map((p) => p.email)).toContain('a@example.com');
	});

	it('grant sets the limit from a preset or a typed GB and closes the request', async () => {
		askForMore(db, { userId: 'p' }, null, 1);
		const id = String(db.select().from(storageRequests).all()[0].id);
		expect(await act('grant', ev(true, { id, preset: '5' }))).toEqual({ ok: true });
		expect(storageOf(db, 'p').limitBytes).toBe(5 * GB);
		expect(await act('grant', ev(true, { id, gb: '8' }))).toMatchObject({ status: 404 });
		askForMore(db, { userId: 'p' }, null, 2);
		const id2 = String(db.select().from(storageRequests).all()[1].id);
		expect(await act('grant', ev(true, { id: id2, gb: '7.5' }))).toEqual({ ok: true });
		expect(storageOf(db, 'p').limitBytes).toBe(7.5 * GB);
	});

	it('grant refuses a bad number with a 400 and keeps the request open', async () => {
		askForMore(db, { userId: 'p' }, null, 1);
		const id = String(db.select().from(storageRequests).all()[0].id);
		for (const gb of ['', '0', '-2', 'abc']) {
			expect(await act('grant', ev(true, { id, gb }))).toMatchObject({ status: 400 });
		}
		expect(storageOf(db, 'p').limitBytes).toBe(GB);
	});

	it('decline closes without changing the limit', async () => {
		askForMore(db, { userId: 'p' }, null, 1);
		const id = String(db.select().from(storageRequests).all()[0].id);
		expect(await act('decline', ev(true, { id }))).toEqual({ ok: true });
		expect(storageOf(db, 'p').limitBytes).toBe(GB);
		expect(db.select().from(storageRequests).all()[0].outcome).toBe('declined');
	});

	it('setLimit takes a preset, a number, or none, and refuses the rest', async () => {
		expect(await act('setLimit', ev(true, { userId: 'p', preset: '10' }))).toEqual({ ok: true });
		expect(storageOf(db, 'p').limitBytes).toBe(10 * GB);
		expect(await act('setLimit', ev(true, { userId: 'p', none: '1' }))).toEqual({ ok: true });
		expect(storageOf(db, 'p').limitBytes).toBeNull();
		expect(await act('setLimit', ev(true, { userId: 'p', gb: '0' }))).toMatchObject({
			status: 400
		});
		expect(await act('setLimit', ev(true, { userId: 'ghost', gb: '2' }))).toMatchObject({
			status: 404
		});
	});
});

describe('admin page: apps', () => {
	it('load gives each person their app lines', async () => {
		noteAppSeen(db, 'p', { versionCode: 2, dance: 'salsa', channel: 'direct' }, Date.now());
		const d = (await (load as unknown as Ev)(ev(true))) as {
			people: { email: string; apps: string[] }[];
		};
		expect(d.people.find((x) => x.email === 'p@example.com')!.apps).toEqual([
			'Salsa app 2 · today'
		]);
	});
});

describe('admin page: preset or typed', () => {
	it('a pressed preset wins over a typed number; Enter (gb alone) uses the number', async () => {
		askForMore(db, { userId: 'p' }, null, 1);
		const id = String(db.select().from(storageRequests).all()[0].id);
		expect(await act('setLimit', ev(true, { userId: 'p', preset: '2', gb: '8' }))).toEqual({
			ok: true
		});
		expect(storageOf(db, 'p').limitBytes).toBe(2 * GB);
		expect(await act('grant', ev(true, { id, gb: '8' }))).toEqual({ ok: true });
		expect(storageOf(db, 'p').limitBytes).toBe(8 * GB);
	});
});

describe('admin page: groups', () => {
	function makeTeam() {
		const made = createTeam(db, 'p', 'salsa', 'Salsa nadaljevalna', 1);
		if (!made.ok) throw new Error('no team');
		return made.teamId;
	}

	it('the load shows group names and numbers and no lesson titles', async () => {
		const teamId = makeTeam();
		db.update(users).set({ firstName: 'Pia', lastName: 'Novak' }).where(eq(users.id, 'p')).run();
		createLesson(
			db,
			{ ...T1_SALSA, teamId, actorId: 'p' },
			{
				title: 'Secret lesson title',
				lessonDay: '2026-11-01',
				notes: null
			}
		);
		const d = (await (load as unknown as Ev)(ev(true))) as {
			groups: Record<string, unknown>[];
			limitsTotalBytes: number;
			freeBytes: number;
			people: { email: string; groupsMade: number; groupLimit: number }[];
		};
		expect(d.groups).toMatchObject([
			{ name: 'Salsa nadaljevalna', dance: 'salsa', owner: 'Pia Novak', people: 1, usedBytes: 0 }
		]);
		for (const g of d.groups) expect(g).not.toHaveProperty('title');
		expect(JSON.stringify(d)).not.toContain('Secret lesson title');
		expect(d.freeBytes).toBe(8 * GB);
		expect(d.limitsTotalBytes).toBe(GB + 200 * 1024 ** 2);
		expect(d.people.find((p) => p.email === 'p@example.com')).toMatchObject({
			groupsMade: 1,
			groupLimit: 2
		});
	});

	it('setTeamLimit takes a preset and clears with Computed; a non-admin gets a 404', async () => {
		const teamId = String(makeTeam());
		await expect(act('setTeamLimit', ev(false, { teamId, preset: '2' }))).rejects.toMatchObject({
			status: 404
		});
		expect(await act('setTeamLimit', ev(true, { teamId, preset: '2' }))).toEqual({ ok: true });
		expect(db.select().from(teams).get()!.storageLimitBytes).toBe(2 * GB);
		expect(await act('setTeamLimit', ev(true, { teamId, computed: '1' }))).toEqual({ ok: true });
		expect(db.select().from(teams).get()!.storageLimitBytes).toBeNull();
		expect(await act('setTeamLimit', ev(true, { teamId, gb: '0' }))).toMatchObject({ status: 400 });
		expect(await act('setTeamLimit', ev(true, { teamId: '99', gb: '1' }))).toMatchObject({
			status: 404
		});
	});

	it("granting a group's request sets the group's limit, not the person's", async () => {
		const teamId = makeTeam();
		askForMore(db, { userId: 'p', teamId }, 'class', 1);
		const id = String(db.select().from(storageRequests).all()[0].id);
		const d = (await (load as unknown as Ev)(ev(true))) as {
			requests: { teamName: string | null }[];
		};
		expect(d.requests[0].teamName).toBe('Salsa nadaljevalna');
		expect(await act('grant', ev(true, { id, preset: '5' }))).toEqual({ ok: true });
		expect(db.select().from(teams).get()!.storageLimitBytes).toBe(5 * GB);
		expect(storageOf(db, 'p').limitBytes).toBe(GB);
	});

	it('setGroupLimit sets, clears to the default, and refuses a bad number', async () => {
		expect(await act('setGroupLimit', ev(true, { userId: 'p', n: '5' }))).toEqual({ ok: true });
		expect(db.select().from(users).where(eq(users.id, 'p')).get()!.groupLimit).toBe(5);
		expect(await act('setGroupLimit', ev(true, { userId: 'p', default: '1' }))).toEqual({
			ok: true
		});
		expect(db.select().from(users).where(eq(users.id, 'p')).get()!.groupLimit).toBeNull();
		expect(await act('setGroupLimit', ev(true, { userId: 'p', n: '-1' }))).toMatchObject({
			status: 400
		});
		expect(await act('setGroupLimit', ev(true, { userId: 'ghost', n: '1' }))).toMatchObject({
			status: 404
		});
	});
});

describe('the admin of one dance (the dance split)', () => {
	beforeEach(() => {
		db.insert(users)
			.values({
				id: 'q',
				email: 'p@example.com',
				passwordHash: 'x',
				storageLimitBytes: GB,
				dance: 'bachata'
			})
			.run();
	});

	// Catches: the salsa admin seeing the bachata app's people and groups.
	it('lists only its own dance', async () => {
		createTeam(db, 'q', 'bachata', 'Bachata class', 1);
		askForMore(db, { userId: 'q' }, 'please', 1);
		const d = (await (load as unknown as Ev)(ev(true))) as {
			people: { id: string }[];
			groups: unknown[];
			requests: unknown[];
		};
		expect(d.people.map((p) => p.id).sort()).toEqual(['admin', 'p']);
		expect(d.groups).toEqual([]);
		expect(d.requests).toEqual([]);
	});

	// Catches: the salsa admin changing a bachata account's limits by its id.
	it("changes nothing of the other dance's accounts, groups or requests", async () => {
		const made = createTeam(db, 'q', 'bachata', 'Bachata class', 1);
		if (!made.ok) throw new Error('setup');
		askForMore(db, { userId: 'q' }, null, 1);
		const req = String(db.select().from(storageRequests).all()[0].id);
		const status = async (p: Promise<unknown>) => ((await p) as { status?: number }).status;
		expect(await status(act('setLimit', ev(true, { userId: 'q', preset: '5' })))).toBe(404);
		expect(await status(act('setGroupLimit', ev(true, { userId: 'q', n: '7' })))).toBe(404);
		expect(
			await status(act('setTeamLimit', ev(true, { teamId: String(made.teamId), preset: '5' })))
		).toBe(404);
		expect(await status(act('grant', ev(true, { id: req, preset: '5' })))).toBe(404);
		expect(await status(act('decline', ev(true, { id: req })))).toBe(404);
		const q = db.select().from(users).where(eq(users.id, 'q')).get()!;
		expect([q.storageLimitBytes, q.groupLimit]).toEqual([GB, null]);
		expect(db.select().from(teams).get()?.storageLimitBytes).toBeNull();
		expect(db.select().from(storageRequests).get()?.resolvedAt).toBeNull();
	});
});
