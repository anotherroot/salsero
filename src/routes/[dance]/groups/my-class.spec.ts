/**
 * My class (levels spec): at Follow my class the Groups tab opens the one
 * class, lists two or more, and with none points to the other dance's class;
 * a member's class page is the simple one, a teacher's stays full. The
 * database is mocked, never set through `process.env` (see CLAUDE.md).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { CLASS_ED, CLASS_T, makeClass, type Class } from '$lib/server/test-class';
import { createLesson, linkExercise, publishLesson } from '$lib/server/lessons';
import { createCustomExercise } from '$lib/server/exercises';
import { addState } from '$lib/server/entries';
import { createTeam, joinTeam } from '$lib/server/teams';
import type { Level } from '$lib/levels/levels';
import { load as layoutLoad } from './+layout.server';
import { load as indexLoad } from './+page.server';
import { actions, load as pageLoad } from './[id]/+page.server';
import { actions as lessonActions } from '../lessons/[id]/+page.server';
import { load as lessonsLayoutLoad } from '../lessons/+layout.server';

let db: Db;
let c: Class;
/** An older published class Maja (u3) has not added: one drill. */
let older: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	c = makeClass(db);
	const drill = createCustomExercise(db, CLASS_ED, { name: 'Turns', everyDays: 3, notes: null }).id;
	older = createLesson(db, CLASS_ED, {
		lessonDay: '2026-10-25',
		title: 'Older',
		notes: null
	}).lesson.id;
	linkExercise(db, older, drill, 'u2');
	publishLesson(db, CLASS_ED, older, CLASS_T);
});

const user = (id: string, level: Level | null) => ({
	id,
	email: `${id}@x.si`,
	timezone: 'Europe/Ljubljana',
	level
});
const event = (id: string, level: Level | null, params: Record<string, string>) => ({
	params,
	locals: { user: user(id, level) },
	url: new URL(`http://localhost/${params.dance}/groups${params.id ? `/${params.id}` : ''}`)
});

type Layout = {
	teams: { id: number; deletedAt: number | null }[];
	myClass: {
		lastDays: Record<number, string>;
		today: string;
		other: { dance: string; line: string } | null;
	} | null;
};
const layoutAs = (id: string, level: Level | null, dance = 'salsa') =>
	(layoutLoad as unknown as (e: unknown) => Layout)(event(id, level, { dance }));

/** The groups index's load: a redirect is returned as what it threw. */
async function indexAs(id: string, level: Level | null) {
	const layout = layoutAs(id, level);
	try {
		return await (indexLoad as unknown as (e: unknown) => Promise<unknown>)({
			...event(id, level, { dance: 'salsa' }),
			parent: async () => layout
		});
	} catch (thrown) {
		return thrown;
	}
}

type ClassPage = {
	simple: boolean;
	lessons: { id: number; practise: number; add: { added: boolean } | null }[];
};
const pageAs = (id: string, level: Level | null) =>
	(pageLoad as unknown as (e: unknown) => ClassPage)(event(id, level, { dance: 'salsa', id: '1' }));

describe('the My class tab', () => {
	it('opens the one class at Follow my class', async () => {
		expect(await indexAs('u3', 'follow')).toMatchObject({
			status: 303,
			location: '/salsa/groups/1'
		});
	});

	it('is the Groups list at the other levels', async () => {
		expect(await indexAs('u3', 'own')).toEqual({});
		expect(await indexAs('u3', 'all')).toEqual({});
	});

	it('lists two classes rather than opening one', async () => {
		joinTeam(db, 'u3', 2, 3);
		expect(await indexAs('u3', 'follow')).toEqual({});
		const days = layoutAs('u3', 'follow').myClass?.lastDays;
		// Each class's last class day; the other group has no lesson yet.
		expect(days).toEqual({ 1: '2026-11-01' });
	});

	it('has no My class data at the other levels', () => {
		expect(layoutAs('u3', 'all').myClass).toBeNull();
		expect(layoutAs('u3', 'own').myClass).toBeNull();
	});

	it('points to the class in the other dance when there is none here', async () => {
		expect(await indexAs('u4', 'follow')).toEqual({});
		expect(layoutAs('u4', 'follow').myClass?.other).toBeNull();
		createTeam(db, 'u5', 'bachata', 'Bachata Thursdays', 4);
		joinTeam(db, 'u4', 3, 5);
		expect(layoutAs('u4', 'follow').myClass?.other).toEqual({
			dance: 'bachata',
			line: 'Your bachata class'
		});
		// In the dance that has it, nothing points away.
		expect(layoutAs('u4', 'follow', 'bachata').myClass?.other).toBeNull();
	});
});

describe('a lesson at Follow my class', () => {
	type Lessons = { classes: Layout | null };
	const lessonsAs = (id: string, level: Level | null) =>
		(lessonsLayoutLoad as unknown as (e: unknown) => Lessons)({
			...event(id, level, { dance: 'salsa' }),
			cookies: { get: () => undefined, delete: () => {} }
		});

	it('sits beside My class’s list, the same as the Groups layout’s', () => {
		joinTeam(db, 'u3', 2, 3);
		const { classes } = lessonsAs('u3', 'follow');
		const groups = layoutAs('u3', 'follow');
		expect(classes?.teams.map((t) => t.id)).toEqual(groups.teams.map((t) => t.id));
		expect(classes?.myClass).toEqual(groups.myClass);
	});

	it('has no list of classes at the other levels', () => {
		expect(lessonsAs('u3', 'own').classes).toBeNull();
		expect(lessonsAs('u3', 'all').classes).toBeNull();
	});
});

describe('the class page', () => {
	it('is simple for a member at Follow my class only', () => {
		expect(pageAs('u3', 'follow').simple).toBe(true);
		expect(pageAs('u3', 'own').simple).toBe(false);
		expect(pageAs('u3', 'all').simple).toBe(false);
	});

	it('stays full for a teacher at Follow my class', () => {
		expect(pageAs('u2', 'follow').simple).toBe(false);
		expect(pageAs('u1', 'follow').simple).toBe(false);
	});

	it('counts what each class puts on Today: the lesson and its drill', () => {
		const lessons = pageAs('u3', 'follow').lessons;
		expect(lessons.find((l) => l.id === older)).toMatchObject({
			practise: 2,
			add: { added: false }
		});
		expect(lessons.find((l) => l.id === c.lesson)?.practise).toBe(2);
	});
});

describe('Add and Undo on an older class', () => {
	type Act = (e: unknown) => Promise<unknown>;
	const post = async (fn: unknown, id: string, params: Record<string, string>, body: FormData) => {
		try {
			return await (fn as Act)({
				params,
				locals: { user: user(id, 'follow') },
				request: new Request('http://localhost/x', { method: 'POST', body })
			});
		} catch (thrown) {
			return thrown;
		}
	};

	it('adds at once, and the lesson’s own Remove takes it back', async () => {
		const add = new FormData();
		add.append('lessonId', String(older));
		expect(await post(actions.addNow, 'u3', { dance: 'salsa', id: '1' }, add)).toEqual({
			action: 'addNow',
			ok: true
		});
		expect(addState(db, 'u3', older)?.added).toBe(true);

		// Undo posts `stay=1`: the action answers instead of redirecting to Lessons.
		const stay = new FormData();
		stay.append('stay', '1');
		const undo = await post(
			lessonActions.remove,
			'u3',
			{ dance: 'salsa', id: String(older) },
			stay
		);
		expect(undo).toEqual({ action: 'remove', ok: true });
		expect(addState(db, 'u3', older)?.added).toBe(false);
	});

	it('the lesson’s Remove without stay still goes to Lessons', async () => {
		const add = new FormData();
		add.append('lessonId', String(older));
		await post(actions.addNow, 'u3', { dance: 'salsa', id: '1' }, add);
		const removed = await post(
			lessonActions.remove,
			'u3',
			{ dance: 'salsa', id: String(older) },
			new FormData()
		);
		expect(removed).toMatchObject({ status: 303 });
		expect(addState(db, 'u3', older)?.added).toBe(false);
	});
});
