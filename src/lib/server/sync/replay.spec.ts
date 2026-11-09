import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '../db';
import { SLOT_SIZE } from '../db/ids';
import { logSet } from '../exercises';
import { getLessonRow } from '../lessons';
import { lessonSeen } from '../clash';
import { slotFor } from './slots';
import { WriteGate } from './gate';
import { makeWorld, type World } from './test-world';
import { actionRunner } from './test-replay';
import { push, type Runner } from './replay';
import { PAGE_EPOCH } from '$lib/page-epoch';
import { base64Of, type WireEntry } from '$lib/sync/outbox';
import * as todayPage from '../../../routes/[dance]/(today)/+page.server';
import * as exercisePage from '../../../routes/[dance]/(today)/exercises/[id]/+page.server';
import * as figuresPage from '../../../routes/[dance]/(moves)/figures/+page.server';
import * as lessonsPage from '../../../routes/[dance]/lessons/+page.server';
import * as lessonPage from '../../../routes/[dance]/lessons/[id]/+page.server';

const ROUTES = [
	{ id: '/[dance]/(today)', module: todayPage },
	{ id: '/[dance]/(today)/exercises/[id]', module: exercisePage },
	{ id: '/[dance]/(moves)/figures', module: figuresPage },
	{ id: '/[dance]/lessons', module: lessonsPage },
	{ id: '/[dance]/lessons/[id]', module: lessonPage }
];
const U1 = {
	id: 'u1',
	email: 'u1@x.si',
	firstName: 'Ana',
	lastName: null,
	timezone: 'UTC',
	isAdmin: false,
	level: 'all' as const,
	dance: 'salsa' as const,
	locale: 'en' as const
};

let db: Db;
let w: World;
let run: Runner;
let slot: number;
let seq = 0;
const NOW = Date.now();

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	w = makeWorld(db);
	run = actionRunner(U1, ROUTES);
	slot = slotFor(db, 'u1', 'dev-test-1', NOW);
	seq = 0;
});

const S = () => slot * SLOT_SIZE;
const opts = (over: Partial<Parameters<typeof push>[4]> = {}) => ({
	now: NOW,
	origin: 'https://salsa.test',
	...over
});

function entry(
	url: string,
	fields: Record<string, string>,
	over: Partial<WireEntry> & { cookie?: string } = {}
): WireEntry {
	const { cookie, ...rest } = over;
	const headers: [string, string][] = [
		['content-type', 'application/x-www-form-urlencoded'],
		['accept', 'application/json'],
		['x-sveltekit-action', 'true']
	];
	if (cookie) headers.push(['cookie', cookie]);
	return {
		id: `entry-${String(++seq).padStart(4, '0')}`,
		madeAt: NOW - 3600_000,
		epoch: PAGE_EPOCH,
		url,
		method: 'POST',
		headers,
		body: base64Of(new TextEncoder().encode(new URLSearchParams(fields).toString())),
		minted: {},
		rows: [],
		...rest
	};
}

const pushAll = (entries: WireEntry[], o = opts()) =>
	push(db, run, 'u1', { device: 'dev-test-1', user: 'u1', entries }, o);

const done = (exerciseId: number, over: Partial<WireEntry> = {}) =>
	entry(
		`/salsa/exercises/${exerciseId}?/done`,
		{ exerciseId: String(exerciseId), durationS: '60', rating: '3', note: 'offline' },
		over
	);

const setRow = (id: number) =>
	db.get<{ id: number; done_at: number } | undefined>(
		sql`SELECT id, done_at FROM sets WHERE id = ${id}`
	);
const count = (table: string) =>
	db.get<{ n: number }>(sql`SELECT count(*) AS n FROM ${sql.identifier(table)}`).n;

describe('push', () => {
	it("lands a log made offline, dated when it was made, with the device's id", async () => {
		const id = S() + 1;
		const e = done(w.own.u1.exercise, { minted: { sets: [id] } });
		const out = await pushAll([e]);
		expect(out.slot).toBe(slot);
		expect(out.results).toEqual([{ id: e.id, state: 'landed' }]);
		expect(setRow(id)).toEqual({ id, done_at: e.madeAt });
	});

	it('answers landed for a resent entry without running it', async () => {
		const e = done(w.own.u1.exercise, { minted: { sets: [S() + 1] } });
		const before = count('sets');
		await pushAll([e]);
		const again = await pushAll([e]);
		expect(again.results).toEqual([{ id: e.id, state: 'landed' }]);
		expect(count('sets')).toBe(before + 1);
	});

	it("mints a later entry's ids after an earlier one was refused", async () => {
		const a = done(w.own.u1.exercise, { epoch: PAGE_EPOCH - 1, minted: { sets: [S() + 1] } });
		const b = done(w.own.u1.exercise, { minted: { sets: [S() + 2] } });
		const out = await pushAll([a, b]);
		expect(out.results.map((r) => r.state)).toEqual(['refused', 'landed']);
		expect(setRow(S() + 1)).toBeUndefined();
		expect(setRow(S() + 2)?.id).toBe(S() + 2);
	});

	it('holds an entry that uses a row a refused one made', async () => {
		const drill = S() + 1;
		const a = entry(
			'/salsa?/createExercise',
			{ name: 'Offline drill', notes: '' },
			{
				epoch: PAGE_EPOCH - 1,
				minted: { exercises: [drill] },
				rows: [
					{ tbl: 'exercises', key: String(drill), op: 'i', before: null, after: { id: drill } }
				]
			}
		);
		const b = done(drill, { minted: { sets: [S() + 2] } });
		const out = await pushAll([a, b]);
		expect(out.results[1]).toEqual({ id: b.id, state: 'held', heldBy: a.id });
		expect(setRow(S() + 2)).toBeUndefined();
	});

	it('refuses another epoch as stale', async () => {
		const out = await pushAll([done(w.own.u1.exercise, { epoch: PAGE_EPOCH + 1 })]);
		expect(out.results[0]).toMatchObject({ state: 'refused', reason: 'stale' });
	});

	it('refuses a network-only action and ids outside the slot', async () => {
		const copy = entry(`/salsa/lessons/${w.own.u1.lesson}?/copyTo`, { to: 'x' });
		const foreign = done(w.own.u1.exercise, { minted: { sets: [(slot + 1) * SLOT_SIZE + 1] } });
		const out = await pushAll([copy, foreign]);
		expect(out.results[0]).toMatchObject({ state: 'refused', reason: 'not-allowed' });
		expect(out.results[1]).toMatchObject({ state: 'refused', reason: 'bad-ids' });
	});

	it("keeps the server's newer notes on an own lesson and takes the entry's title", async () => {
		const id = w.own.u1.lesson;
		const before = getLessonRow(db, id)!;
		const deviceBefore = db.get<Record<string, string | number | null>>(
			sql`SELECT * FROM lessons WHERE id = ${id}`
		);
		// on the PC, after the offline change was made: new notes
		db.run(sql`UPDATE lessons SET notes = 'from the PC' WHERE id = ${id}`);
		const e = entry(
			`/salsa/lessons/${id}?/update`,
			{ title: 'Renamed offline', lessonDay: before.lessonDay, notes: before.notes ?? '' },
			{
				madeAt: NOW - 3600_000,
				rows: [
					{
						tbl: 'lessons',
						key: String(id),
						op: 'u',
						before: deviceBefore,
						after: { ...deviceBefore, title: 'Renamed offline' }
					}
				]
			}
		);
		const out = await pushAll([e]);
		expect(out.results[0]).toEqual({ id: e.id, state: 'landed' });
		expect(getLessonRow(db, id)).toMatchObject({ title: 'Renamed offline', notes: 'from the PC' });
	});

	it("refuses a group's lesson changed meanwhile as a clash, and the next entry carries on", async () => {
		const id = w.group.published;
		const lesson = getLessonRow(db, id)!;
		const stale = { ...lessonSeen(lesson), title: 'An older title' };
		const clash = entry(`/salsa/lessons/${id}?/update`, {
			title: 'Mine',
			lessonDay: lesson.lessonDay,
			notes: lesson.notes ?? '',
			seen: JSON.stringify(stale)
		});
		const next = done(w.own.u1.exercise, { minted: { sets: [S() + 1] } });
		const out = await pushAll([clash, next]);
		expect(out.results[0]).toMatchObject({ state: 'refused', reason: 'clash' });
		expect(out.results[1]).toEqual({ id: next.id, state: 'landed' });
		expect(getLessonRow(db, id)!.title).toBe(lesson.title);
	});

	it('logs a replayed group change with the real actor at the made-at time', async () => {
		const id = w.group.published;
		const lesson = getLessonRow(db, id)!;
		const e = entry(`/salsa/lessons/${id}?/update`, {
			title: 'Edited offline',
			lessonDay: lesson.lessonDay,
			notes: lesson.notes ?? '',
			seen: JSON.stringify(lessonSeen(lesson))
		});
		const out = await pushAll([e]);
		expect(out.results[0]).toEqual({ id: e.id, state: 'landed' });
		const change = db.get<{ actor_id: string; at: number }>(
			sql`SELECT actor_id, at FROM team_changes ORDER BY id DESC LIMIT 1`
		);
		expect(change).toEqual({ actor_id: 'u1', at: e.madeAt });
	});

	it('suffixes a move name another device took first', async () => {
		const fields = {
			figureName: 'Offline move',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: ''
		};
		const out = await pushAll([
			entry('/salsa/figures?/create', fields),
			entry('/salsa/figures?/create', fields)
		]);
		expect(out.results.map((r) => r.state)).toEqual(['landed', 'landed']);
		const names = db
			.all<{ name: string }>(
				sql`SELECT name FROM figure_groups WHERE name LIKE 'Offline move%' ORDER BY id`
			)
			.map((r) => r.name);
		expect(names).toEqual(['Offline move', 'Offline move (2)']);
	});

	it("clamps a made-at from the future to the push's time", async () => {
		const id = S() + 1;
		await pushAll([done(w.own.u1.exercise, { madeAt: NOW + 3600_000, minted: { sets: [id] } })]);
		expect(setRow(id)?.done_at).toBe(NOW);
	});

	it("replays with the entry's group-mode cookie, not the push's", async () => {
		const e = entry(
			'/salsa/lessons?/create',
			{ title: 'For the class', lessonDay: '2026-11-08', notes: '' },
			{
				cookie: 'group_salsa=1',
				minted: { lessons: [S() + 1] }
			}
		);
		const out = await pushAll([e]);
		expect(out.results[0]).toEqual({ id: e.id, state: 'landed' });
		const row = db.get<{ team_id: number | null }>(
			sql`SELECT team_id FROM lessons WHERE id = ${S() + 1}`
		);
		expect(row.team_id).toBe(1);
	});

	it('leaves no row behind when an entry throws', async () => {
		const ex = w.own.u1.exercise;
		const throwing: Runner = async () => {
			logSet(db, {
				exerciseId: ex,
				doneAt: 1,
				durationS: null,
				reps: null,
				rating: 3,
				note: null,
				playerJson: null
			});
			throw new Error('boom');
		};
		const before = count('sets');
		const out = await push(
			db,
			throwing,
			'u1',
			{ device: 'dev-test-1', user: 'u1', entries: [done(ex)] },
			opts()
		);
		expect(out.results[0]).toMatchObject({ state: 'refused', reason: 'error' });
		expect(count('sets')).toBe(before);
	});

	it('defers the rest when the gate is busy', async () => {
		const gate = new WriteGate();
		let release!: () => void;
		void gate.shared(() => new Promise<void>((r) => (release = r)));
		const out = await pushAll(
			[done(w.own.u1.exercise), done(w.own.u1.exercise)],
			opts({ gate, waitMs: 10 })
		);
		expect(out.results.map((r) => r.state)).toEqual(['deferred', 'deferred']);
		release();
	});
});

describe('push, after the Part A review', () => {
	it('answers landed for a landed entry resent after a deploy, before any other check', async () => {
		const e = done(w.own.u1.exercise, { minted: { sets: [S() + 1] } });
		await pushAll([e]);
		const again = await pushAll([{ ...e, epoch: PAGE_EPOCH + 1 }]);
		expect(again.results).toEqual([{ id: e.id, state: 'landed' }]);
	});

	it('refuses one malformed entry and carries on with the rest', async () => {
		const bad = { ...done(w.own.u1.exercise), body: '%%% not base64 %%%' };
		const good = done(w.own.u1.exercise, { minted: { sets: [S() + 1] } });
		const out = await pushAll([bad, good]);
		expect(out.results[0]).toMatchObject({ state: 'refused', reason: 'error' });
		expect(out.results[1]).toEqual({ id: good.id, state: 'landed' });
	});

	it('reads a redirect to sign in as refused, not landed', async () => {
		const toLogin: Runner = async () =>
			Response.json({ type: 'redirect', status: 303, location: '/login?next=%2Fsalsa' });
		const out = await push(
			db,
			toLogin,
			'u1',
			{ device: 'dev-test-1', user: 'u1', entries: [done(w.own.u1.exercise)] },
			opts()
		);
		expect(out.results[0]).toMatchObject({ state: 'refused', reason: 'access' });
	});

	it("replays with only the entry's cookies and the push's session, never the push's group mode", async () => {
		let seen = '';
		const spy: Runner = async (r) => {
			seen = r.headers.get('cookie') ?? '';
			return run(r);
		};
		const e = entry(
			'/salsa/lessons?/create',
			{ title: 'Mine', lessonDay: '2026-11-08', notes: '' },
			{
				cookie: 'salsa_session=old-session; theme=dark',
				minted: { lessons: [S() + 1] }
			}
		);
		await push(
			db,
			spy,
			'u1',
			{ device: 'dev-test-1', user: 'u1', entries: [e] },
			opts({ session: 'salsa_session=push-session' })
		);
		expect(seen.split('; ').sort()).toEqual(['salsa_session=push-session', 'theme=dark']);
		const row = db.get<{ team_id: number | null }>(
			sql`SELECT team_id FROM lessons WHERE id = ${S() + 1}`
		);
		expect(row.team_id).toBeNull();
	});

	it("takes the device's slot under the gate, never inside another replay's transaction", async () => {
		const gate = new WriteGate();
		let release!: () => void;
		void gate.exclusive(() => new Promise<void>((r) => (release = r)));
		const pending = push(db, run, 'u1', { device: 'dev-test-9', user: 'u1', entries: [] }, opts({ gate }));
		await new Promise((r) => setTimeout(r, 5));
		expect(
			db.get<{ n: number }>(
				sql`SELECT count(*) AS n FROM device_slots WHERE device_key = 'dev-test-9'`
			).n
		).toBe(0);
		release();
		expect((await pending).slot).toBeGreaterThan(0);
	});
});
