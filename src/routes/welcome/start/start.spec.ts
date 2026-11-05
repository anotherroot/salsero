import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { teamMembers, teams, users } from '$lib/server/db/schema';
import { createTeam } from '$lib/server/teams';
import { actions, load } from './+page.server';

let db: Db;
let code: string;
let teamId: number;
beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const id of ['teacher', 'ana']) {
		db.insert(users)
			.values({ id, email: `${id}@example.com`, passwordHash: 'x' })
			.run();
	}
	const made = createTeam(db, 'teacher', 'bachata', 'Bachata Tuesdays', 1);
	if (!made.ok) throw new Error('no team');
	teamId = made.teamId;
	code = db.select().from(teams).where(eq(teams.id, teamId)).get()!.code;
});

const user = (level: string | null) => ({ id: 'ana', level, firstName: 'Ana' });
const parent = async () => ({ lastDance: 'salsa' });
const run = (fn: unknown, e: unknown) => (fn as (e: unknown) => Promise<unknown>)(e);
const event = (fields: Record<string, string>, level: string | null = null, search = '') => ({
	locals: { user: user(level) },
	request: new Request('http://localhost/welcome/start', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields)
	}),
	url: new URL('http://localhost/welcome/start' + search),
	parent
});
const redirected = async (p: Promise<unknown>) => {
	try {
		await p;
	} catch (e) {
		const r = e as { status?: number; location?: string };
		if (r.status === 303) return r.location;
		throw e;
	}
	throw new Error('no redirect');
};
const levelOf = () => db.select().from(users).where(eq(users.id, 'ana')).get()!.level;

describe('the level step', () => {
	it('saves the level and goes on to the join step, keeping next', async () => {
		const to = await redirected(run(actions.level, event({ level: 'follow', next: '/salsa' })));
		expect(to).toBe('/welcome/start?step=join&next=%2Fsalsa');
		expect(levelOf()).toBe('follow');
	});
	it('refuses a level that is not one and saves nothing', async () => {
		const res = (await run(actions.level, event({ level: 'expert' }))) as { status: number };
		expect(res.status).toBe(400);
		expect(levelOf()).toBeNull();
	});
});

describe('the join step', () => {
	it('joins by a typed code and lands on the class dance Today', async () => {
		const to = await redirected(run(actions.join, event({ code: code.toLowerCase(), next: '/' })));
		expect(to).toBe('/bachata');
		expect(db.select().from(teamMembers).where(eq(teamMembers.userId, 'ana')).all()).toHaveLength(
			1
		);
	});
	it('joins by the teacher link code (teamCode) and does not return to the link', async () => {
		const to = await redirected(run(actions.join, event({ teamCode: code, next: `/g/${code}` })));
		expect(to).toBe('/bachata');
	});
	it('says so under the field for an empty or wrong code, and joins nothing', async () => {
		const wrong = (await run(actions.join, event({ code: 'ZZZZZZZZ' }))) as {
			status: number;
			data: { message: string };
		};
		expect(wrong.status).toBe(400);
		expect(wrong.data.message).toMatch(/No class has this code/);
		const empty = (await run(actions.join, event({ code: ' ' }))) as { status: number };
		expect(empty.status).toBe(400);
		expect(db.select().from(teamMembers).where(eq(teamMembers.userId, 'ana')).all()).toHaveLength(
			0
		);
	});
	it('Not now goes to next, but not back to a teacher link', async () => {
		expect(await redirected(run(actions.skip, event({ next: '/salsa/songs' })))).toBe(
			'/salsa/songs'
		);
		expect(await redirected(run(actions.skip, event({ next: `/g/${code}` })))).toBe('/');
	});
});

describe('the page', () => {
	it('sends a person who has a level on, unless it is the join step', async () => {
		const to = await redirected(
			run(load, event({}, 'own', '?next=%2Fsalsa/songs') as unknown as Record<string, unknown>)
		);
		expect(to).toBe('/salsa/songs');
		const data = (await run(load, event({}, 'own', '?step=join'))) as { step: string };
		expect(data.step).toBe('join');
	});
	it('shows the class of a teacher link in the join step', async () => {
		const data = (await run(
			load,
			event({}, 'follow', `?step=join&next=${encodeURIComponent('/g/' + code)}`)
		)) as { invite: { name: string; code: string } };
		expect(data.invite).toMatchObject({ name: 'Bachata Tuesdays', code });
	});
	it('without a level it is the slides, even on step=join', async () => {
		const data = (await run(load, event({}, null, '?step=join'))) as { step: string };
		expect(data.step).toBe('start');
	});
});
