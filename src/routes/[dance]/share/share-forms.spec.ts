/**
 * The share page's New lesson (spec A4): made in the person's own lessons or
 * in a group they edit, never anywhere else. `getDb()` is mocked per test, as
 * in `lessons/lesson-forms.spec.ts`; nothing opens the real database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { exercises, lessons } from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { runInLocale } from '$lib/server/i18n-request';
import { actions, load } from './+page.server';

const ZONE = 'Europe/Ljubljana';
const KEY = '00000000-0000-4000-8000-000000000000';
const T = Date.UTC(2026, 10, 6, 12);

function post(fields: Record<string, string>, user = 'u1') {
	return {
		params: { dance: 'salsa' },
		url: new URL(`http://localhost/salsa/share?key=${KEY}`),
		request: new Request(`http://localhost/salsa/share?key=${KEY}`, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		cookies: { get: () => undefined, delete: () => {} },
		locals: { user: { id: user, email: `${user}@example.com`, timezone: ZONE, dance: 'salsa' } }
	};
}
type Invoke = (event: ReturnType<typeof post>) => Promise<unknown>;
const create = (fields: Record<string, string>, user?: string) =>
	(actions.create as unknown as Invoke)(post(fields, user));

const DAY = '2026-01-05';
let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
});

const team = (owner: string, name: string) => {
	const made = createTeam(db, owner, 'salsa', name, T);
	if (!made.ok) throw new Error('no team');
	return made.teamId;
};

describe('New lesson from a shared video', () => {
	it("makes the lesson in the person's own lessons", async () => {
		const result = await create({ teamId: '0', title: 'Nadaljevalna', lessonDay: DAY });
		expect(result).toMatchObject({ action: 'create', ok: true, title: 'Nadaljevalna' });
		const id = (result as { lessonId: number }).lessonId;
		const row = db.select().from(lessons).where(eq(lessons.id, id)).get()!;
		expect(row).toMatchObject({ userId: 'u1', teamId: null, lessonDay: DAY });
		expect(db.select().from(exercises).where(eq(exercises.lessonId, id)).all()).toHaveLength(1);
	});

	it('makes a draft in a group the person edits', async () => {
		const t = team('u1', 'Tuesdays');
		const result = await create({ teamId: String(t), title: 'Week 6', lessonDay: DAY });
		const id = (result as { lessonId: number }).lessonId;
		expect(db.select().from(lessons).where(eq(lessons.id, id)).get()).toMatchObject({
			teamId: t,
			userId: null,
			publishedAt: null
		});
	});

	it('refuses a group the person only reads', async () => {
		const t = team('u2', 'Wednesdays');
		joinTeam(db, 'u1', t, T);
		const result = await create({ teamId: String(t), title: 'Week 6', lessonDay: DAY });
		expect(result).toMatchObject({
			status: 400,
			data: { action: 'create', field: 'teamId', message: 'Pick where it goes.' }
		});
		expect(db.select().from(lessons).all()).toEqual([]);
	});

	it("refuses a stranger's group", async () => {
		const t = team('u2', 'Wednesdays');
		const result = await create({ teamId: String(t), title: 'Week 6', lessonDay: DAY });
		expect(result).toMatchObject({ status: 400, data: { field: 'teamId' } });
		expect(db.select().from(lessons).all()).toEqual([]);
	});

	it('hands back a blank title under Title', async () => {
		const result = await create({ teamId: '0', title: ' ', lessonDay: DAY });
		expect(result).toMatchObject({
			status: 400,
			data: { action: 'create', field: 'title', lessonDay: DAY }
		});
	});

	it('offers Mine and the groups the person edits as places', async () => {
		const own = team('u1', 'Tuesdays');
		const read = team('u2', 'Wednesdays');
		joinTeam(db, 'u1', read, T);
		const data = (await (load as unknown as Invoke)(post({}))) as {
			places: { value: number; label: string }[];
			today: string;
		};
		expect(data.places).toEqual([
			{ value: 0, label: 'Mine' },
			{ value: own, label: 'Tuesdays' }
		]);
		expect(data.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('the share page in Slovenian', () => {
	it('refuses a place it may not use, and offers »Moje«', async () => {
		const t = team('u2', 'Wednesdays');
		joinTeam(db, 'u1', t, T);
		const result = await runInLocale('sl', () =>
			create({ teamId: String(t), title: 'Week 6', lessonDay: DAY })
		);
		expect(result).toMatchObject({
			data: { field: 'teamId', message: 'Izberite, kam naj gre.' }
		});
		const data = (await runInLocale('sl', () => (load as unknown as Invoke)(post({})))) as {
			places: { value: number; label: string }[];
		};
		expect(data.places[0]).toEqual({ value: 0, label: 'Moje' });
	});
});
