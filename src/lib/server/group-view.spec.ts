import { describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { users } from './db/schema';
import { createTeam, deleteTeam, joinTeam } from './teams';
import { setRole } from './membership';
import { setLevel } from './levels';
import { createFigure } from './figures';
import { createLesson } from './lessons';
import { createCustomExercise } from './exercises';
import { createImport } from './song-imports';
import { groupModeFor, spaceOf, viewOf } from './group-mode';
import { T1_SALSA, U1_SALSA, U2_SALSA } from './test-walls';

/*
 * The group view (spec 2026-11-09): a page of one thing decides by its row, a
 * list by `in`, re-checked every time. Catches: a stale or foreign `in` putting
 * a page (or a write) into a group, a row page following `in` instead of its row,
 * and Today taking a group's view.
 */

const FIGURE = {
	figureName: 'Enchufla',
	name: 'Basic',
	partner: 'partner',
	style: 'salsa',
	notes: ''
};

function setup(): Db {
	const db = openDb(':memory:');
	const names: Record<string, [string, string]> = {
		u1: ['Ana', 'Kos'],
		u2: ['Bor', 'Lah'],
		u3: ['Cene', 'Mrak'],
		u4: ['Dora', 'Novak']
	};
	for (const [id, [firstName, lastName]] of Object.entries(names))
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName, lastName })
			.run();
	createTeam(db, 'u1', 'salsa', 'Tuesdays', 1); // 1: u1 owner, u2 editor, u3 member
	joinTeam(db, 'u2', 1, 2);
	joinTeam(db, 'u3', 1, 2);
	setRole(db, 1, 'u2', 'editor');
	createTeam(db, 'u1', 'bachata', 'Bach', 1); // 2
	createTeam(db, 'u1', 'salsa', 'Gone', 1); // 3
	deleteTeam(db, 3, 'u1', 5);
	createTeam(db, 'u1', 'salsa', 'Fridays', 1); // 4
	return db;
}

const at = (routeId: string, id: string | null, href: string) => ({
	route: { id: routeId },
	params: id === null ? { dance: 'salsa' } : { dance: 'salsa', id },
	url: new URL(`http://x${href}`)
});
const LIST = '/[dance]/(moves)/figures';
const FIG = '/[dance]/(moves)/figures/[id]';
const DRILL = '/[dance]/(today)/exercises/[id]';

describe('groupModeFor', () => {
	it('gives the group to an owner and an editor, with its people and the others’ faces', () => {
		const db = setup();
		expect(groupModeFor(db, 'u1', 'salsa', 1)).toEqual({
			teamId: 1,
			name: 'Tuesdays',
			role: 'owner',
			people: 3,
			faces: ['BL', 'CM']
		});
		expect(groupModeFor(db, 'u2', 'salsa', 1)?.faces).toEqual(['AK', 'CM']);
	});
	it('refuses a member, a deleted group, another dance, no group', () => {
		const db = setup();
		expect(groupModeFor(db, 'u3', 'salsa', 1)).toBeNull();
		expect(groupModeFor(db, 'u1', 'salsa', 3)).toBeNull();
		expect(groupModeFor(db, 'u1', 'salsa', 2)).toBeNull();
		expect(groupModeFor(db, 'u1', 'salsa', 99)).toBeNull();
		expect(groupModeFor(db, 'u1', 'salsa', null)).toBeNull();
	});
	it('is Everything’s only, the caller’s level over the stored one', () => {
		const db = setup();
		setLevel(db, 'u1', 'own');
		expect(groupModeFor(db, 'u1', 'salsa', 1)).toBeNull();
		expect(groupModeFor(db, 'u1', 'salsa', 1, 'all')?.role).toBe('owner');
		expect(groupModeFor(db, 'u1', 'salsa', 1, 'follow')).toBeNull();
	});
	it('shows no more than three faces', () => {
		const db = setup();
		joinTeam(db, 'u4', 1, 3);
		const solo = createTeam(db, 'u3', 'salsa', 'Solo', 1);
		if (!solo.ok) throw new Error('no team');
		expect(groupModeFor(db, 'u1', 'salsa', 1)?.faces).toHaveLength(3);
		expect(groupModeFor(db, 'u1', 'salsa', 1)?.people).toBe(4);
		expect(groupModeFor(db, 'u3', 'salsa', solo.teamId)).toMatchObject({ people: 1, faces: [] });
	});
});

describe('viewOf on a list', () => {
	it('follows a valid in', () => {
		const db = setup();
		expect(viewOf(db, U1_SALSA, 'all', at(LIST, null, '/salsa/figures?in=1'))?.teamId).toBe(1);
		expect(viewOf(db, U2_SALSA, 'all', at(LIST, null, '/salsa/figures?in=1'))?.role).toBe('editor');
		expect(viewOf(db, U1_SALSA, 'all', at(LIST, null, '/salsa/figures'))).toBeNull();
	});
	it('ignores a stale or foreign in', () => {
		const db = setup();
		const u3 = { userId: 'u3', dance: 'salsa' } as const;
		expect(viewOf(db, u3, 'all', at(LIST, null, '/salsa/figures?in=1'))).toBeNull();
		for (const bad of ['2', '3', 'abc', '0'])
			expect(
				viewOf(db, U1_SALSA, 'all', at(LIST, null, `/salsa/figures?in=${bad}`)),
				bad
			).toBeNull();
	});
	it('Today is never a group’s', () => {
		const db = setup();
		expect(viewOf(db, U1_SALSA, 'all', at('/[dance]/(today)', null, '/salsa?in=1'))).toBeNull();
	});
});

describe('viewOf on a page of one thing', () => {
	it('a group’s figure is in its group’s view without in', () => {
		const db = setup();
		const f = createFigure(db, T1_SALSA, FIGURE as never)!;
		const id = String(f.figure.id);
		expect(viewOf(db, U2_SALSA, 'all', at(FIG, id, `/salsa/figures/${id}`))?.teamId).toBe(1);
		// A member reads it in their own view.
		const u3 = { userId: 'u3', dance: 'salsa' } as const;
		expect(viewOf(db, u3, 'all', at(FIG, id, `/salsa/figures/${id}`))).toBeNull();
	});
	it('your own figure stays yours even with an in', () => {
		const db = setup();
		const f = createFigure(db, U1_SALSA, FIGURE as never)!;
		const id = String(f.figure.id);
		expect(viewOf(db, U1_SALSA, 'all', at(FIG, id, `/salsa/figures/${id}?in=1`))).toBeNull();
	});
	it('a group’s lesson and the group’s own page', () => {
		const db = setup();
		const l = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: '' });
		const lid = String(l.lesson.id);
		expect(
			viewOf(db, U1_SALSA, 'all', at('/[dance]/lessons/[id]', lid, `/salsa/lessons/${lid}`))?.teamId
		).toBe(1);
		expect(
			viewOf(db, U1_SALSA, 'all', at('/[dance]/groups/[id]/people', '1', '/salsa/groups/1/people'))
				?.teamId
		).toBe(1);
		const u3 = { userId: 'u3', dance: 'salsa' } as const;
		expect(viewOf(db, u3, 'all', at('/[dance]/groups/[id]', '1', '/salsa/groups/1'))).toBeNull();
	});
	it('a missing row is your own view', () => {
		const db = setup();
		expect(viewOf(db, U1_SALSA, 'all', at(FIG, '999', '/salsa/figures/999?in=1'))).toBeNull();
	});
	it('a group’s drill: the group’s view only when in names its group', () => {
		const db = setup();
		const d = String(
			createCustomExercise(db, T1_SALSA, { name: 'Shines', everyDays: 3, notes: null }).id
		);
		expect(viewOf(db, U1_SALSA, 'all', at(DRILL, d, `/salsa/exercises/${d}`))).toBeNull();
		expect(viewOf(db, U1_SALSA, 'all', at(DRILL, d, `/salsa/exercises/${d}?in=1`))?.teamId).toBe(1);
		expect(viewOf(db, U1_SALSA, 'all', at(DRILL, d, `/salsa/exercises/${d}?in=4`))).toBeNull();
	});
});

describe('viewOf on a playlist’s pick list', () => {
	it('is in the group’s view when the list is the group’s, for its editor', () => {
		const db = setup();
		const imp = createImport(
			db,
			{ dance: 'salsa', teamId: 1, actorId: 'u1' },
			{ url: 'https://www.youtube.com/playlist?list=x', kind: 'youtube-playlist' }
		).id;
		const route = '/[dance]/songs/imports/[id]';
		const href = `/salsa/songs/imports/${imp}`;
		expect(viewOf(db, U2_SALSA, 'all', at(route, String(imp), href))?.teamId).toBe(1);
		const own = createImport(db, U2_SALSA, {
			url: 'https://www.youtube.com/playlist?list=y',
			kind: 'youtube-playlist'
		}).id;
		expect(viewOf(db, U2_SALSA, 'all', at(route, String(own), `${href}?in=1`))).toBeNull();
	});
});

describe('spaceOf', () => {
	const locals = (id: string) =>
		({ user: { id, isAdmin: false, timezone: 'UTC', dance: 'salsa', level: 'all' } }) as App.Locals;
	it('is the group for a valid in, the wall for a stale one or none', () => {
		const db = setup();
		const url = (q: string) => new URL(`http://x/salsa/figures?/create${q}`);
		expect(spaceOf(db, { dance: 'salsa' }, locals('u2'), url('&in=1'))).toEqual({
			dance: 'salsa',
			teamId: 1,
			actorId: 'u2'
		});
		expect(spaceOf(db, { dance: 'salsa' }, locals('u2'), url('&in=3'))).toEqual(U2_SALSA);
		expect(spaceOf(db, { dance: 'salsa' }, locals('u3'), url('&in=1'))).toEqual({
			userId: 'u3',
			dance: 'salsa'
		});
		expect(spaceOf(db, { dance: 'salsa' }, locals('u2'), url(''))).toEqual(U2_SALSA);
	});
});
