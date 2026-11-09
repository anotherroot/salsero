/** The Suggestions page through its load and actions, on an in-memory db. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { routines } from '$lib/server/db/schema';
import { makeWorld, type World } from '$lib/server/sync/test-world';
import { propose } from '$lib/server/ai-queue/store';
import { tabDot } from '$lib/nav/tabs';
import { actions, load } from './+page.server';

const T = 1_800_000_000_000;
let db: Db;
let w: World;
beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	w = makeWorld(db);
});

const USER = (id: string) => ({ id, dance: 'salsa', timezone: 'Europe/Ljubljana', locale: 'en' });
const ev = (fields: Record<string, string>, userId = 'u1') =>
	({
		params: { dance: 'salsa' },
		locals: { user: USER(userId), locale: 'en' },
		request: new Request('http://localhost/salsa/suggestions', {
			method: 'POST',
			body: new URLSearchParams(fields)
		})
	}) as never;
const call = async (action: unknown, e: unknown) => {
	try {
		return await (action as (x: unknown) => Promise<unknown>)(e);
	} catch (x) {
		return x;
	}
};
function add(lines: Record<string, unknown>[]) {
	const r = propose(
		db,
		{ userId: 'u1', dance: 'salsa', grantId: null },
		{ group: { title: 'G' }, title: 'T', lines: lines as never },
		T
	);
	if (!r.ok) throw new Error(r.message);
	return r.actionId;
}
const view = async () =>
	(
		(await (load as (e: unknown) => unknown)(ev({}))) as {
			view: { groups: { actions: { id: number; version: number; state: string }[] }[] };
		}
	).view;

describe('the Suggestions page', () => {
	it('loads the person`s queue', async () => {
		add([{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'x' }]);
		expect((await view()).groups[0].actions[0].state).toBe('pending');
	});

	it('run writes, with the versions the page showed', async () => {
		const a = add([{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'run me' }]);
		const r = await call(
			actions.run,
			ev({ ids: JSON.stringify([a]), versions: JSON.stringify({ [a]: 1 }) })
		);
		expect(r).toMatchObject({ done: [expect.any(Number)], refused: 0 });
		expect(db.select().from(routines).where(eq(routines.id, w.own.u1.routine)).get()!.notes).toBe(
			'run me'
		);
	});

	it('run with a stale version refuses it and writes nothing', async () => {
		const a = add([{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'no' }]);
		const r = await call(
			actions.run,
			ev({ ids: JSON.stringify([a]), versions: JSON.stringify({ [a]: 0 }) })
		);
		expect(r).toMatchObject({ done: [], refused: 1 });
		expect(
			db.select().from(routines).where(eq(routines.id, w.own.u1.routine)).get()!.notes
		).toBeNull();
	});

	it('drop with dependents and no answer yet names them', async () => {
		const sec = add([
			{ kind: 'add_section', lesson_video_id: w.own.u1.video, start_ms: 0, end_ms: 1000 }
		]);
		const link = add([
			{ kind: 'link_section', section_id: { ref: sec }, figure_id: w.own.u1.figure }
		]);
		expect(await call(actions.drop, ev({ id: String(sec) }))).toMatchObject({ dependents: [2] });
		expect(await call(actions.drop, ev({ id: String(sec), withDependents: '1' }))).toMatchObject({
			dropped: 2
		});
		expect(link).toBeGreaterThan(0);
	});

	it('another person`s action is not there (404)', async () => {
		const a = add([{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'x' }]);
		expect(
			await call(actions.run, ev({ ids: JSON.stringify([a]), versions: '{}' }, 'u4'))
		).toMatchObject({ status: 404 });
		expect(await call(actions.drop, ev({ id: String(a) }, 'u4'))).toMatchObject({ status: 404 });
	});

	it('undo takes back what a run did', async () => {
		const a = add([{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'x' }]);
		const r = (await call(
			actions.run,
			ev({ ids: JSON.stringify([a]), versions: JSON.stringify({ [a]: 1 }) })
		)) as { done: number[] };
		expect(await call(actions.undo, ev({ lineIds: JSON.stringify(r.done) }))).toMatchObject({
			done: r.done
		});
		expect(
			db.select().from(routines).where(eq(routines.id, w.own.u1.routine)).get()!.notes
		).toBeNull();
	});

	it('the You tab shows a dot while something waits', () => {
		expect(tabDot('you', { aiPending: 2 })).toBe(true);
		expect(tabDot('you', { aiPending: 0 })).toBe(false);
	});
});

describe('a refused undo says why', () => {
	it('answers the reason, worded for the person', async () => {
		const a = add([{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'x' }]);
		const r = (await call(
			actions.run,
			ev({ ids: JSON.stringify([a]), versions: JSON.stringify({ [a]: 1 }) })
		)) as { done: number[] };
		db.update(routines)
			.set({ notes: 'changed by hand' })
			.where(eq(routines.id, w.own.u1.routine))
			.run();
		expect(await call(actions.undo, ev({ lineIds: JSON.stringify(r.done) }))).toMatchObject({
			done: [],
			refused: 1,
			reasons: [expect.stringMatching(/^Changed since/)]
		});
	});
});
