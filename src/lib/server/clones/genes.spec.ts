import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { figures, recordings, users } from '../db/schema';
import { createTeam, deleteTeam, joinTeam } from '../teams';
import { setRole } from '../membership';
import { addFigureExercise, addRecording, createFigure } from '../figures';
import { createCustomExercise } from '../exercises';
import { createLesson, linkFigure, publishLesson } from '../lessons';
import { insertFixturePositions } from '../test-positions';
import { T1_SALSA, U1_SALSA, U2_SALSA } from '../test-walls';
import { familyRows, geneOf, memberIn, newGene, stampGene, visibleMembers } from './genes';

const T = Date.UTC(2026, 10, 3, 20);
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };

let db: Db;

function figure(space: typeof U1_SALSA | typeof T1_SALSA, move: string, name = 'Basic') {
	return createFigure(db, space, { figureName: move, name, ...shape })!.figure.id;
}

const setGene = (id: number, gene: string) =>
	db.update(figures).set({ geneId: gene }).where(eq(figures.id, id)).run();

beforeEach(() => {
	db = openDb(':memory:');
	insertFixturePositions(db);
	for (const id of ['u1', 'u2', 'u3'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
	joinTeam(db, 'u3', 1, T);
});

describe('genes', () => {
	it('newGene is a fresh uuid each time', () => {
		expect(newGene()).toMatch(/^[0-9a-f-]{36}$/);
		expect(newGene()).not.toBe(newGene());
	});

	it('stampGene sets a gene once and returns the same one after', () => {
		const id = figure(U1_SALSA, 'Enchufla');
		expect(geneOf(db, 'figure', id)).toBeNull();
		const gene = stampGene(db, 'figure', id);
		expect(stampGene(db, 'figure', id)).toBe(gene);
		expect(geneOf(db, 'figure', id)).toBe(gene);
	});

	it('stamps a piece too, and refuses a missing row', () => {
		const fig = figure(U1_SALSA, 'Enchufla');
		const rec = addRecording(db, {
			figureId: fig,
			file: 'a.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 5,
			note: null
		});
		const gene = stampGene(db, 'recording', rec.id);
		expect(db.select().from(recordings).get()!.geneId).toBe(gene);
		expect(geneOf(db, 'figure', fig)).toBeNull();
		expect(() => stampGene(db, 'figure', 999)).toThrow();
		expect(geneOf(db, 'figure', 999)).toBeNull();
	});

	it('memberIn finds the place’s member, archived included', () => {
		const mine = figure(U1_SALSA, 'Enchufla');
		const gene = stampGene(db, 'figure', mine);
		db.update(figures).set({ archivedAt: T }).where(eq(figures.id, mine)).run();
		expect(memberIn(db, 'figure', gene, U1_SALSA)).toEqual({ id: mine, archived: true });
		expect(memberIn(db, 'figure', gene, U2_SALSA)).toBeNull();
		expect(memberIn(db, 'figure', gene, T1_SALSA)).toBeNull();

		const theirs = figure(T1_SALSA, 'Enchufla');
		setGene(theirs, gene);
		expect(memberIn(db, 'figure', gene, T1_SALSA)).toEqual({ id: theirs, archived: false });
		expect(familyRows(db, 'figure', gene)).toEqual([
			{ id: mine, userId: 'u1', teamId: null, archivedAt: T, clonedFrom: null },
			{ id: theirs, userId: null, teamId: 1, archivedAt: null, clonedFrom: null }
		]);
	});
});

describe('drills are custom exercises', () => {
	it('an entry or a figure’s own exercise is no member of anything', () => {
		const fig = figure(U1_SALSA, 'Enchufla');
		const entry = addFigureExercise(db, 'u1', fig)!.id;
		expect(visibleMembers(db, 'u1', 'drill', entry)).toEqual([]);
		expect(() => stampGene(db, 'drill', entry)).toThrow();
		expect(geneOf(db, 'drill', entry)).toBeNull();

		const drill = createCustomExercise(db, U1_SALSA, {
			name: 'Shines',
			everyDays: 2,
			notes: null
		}).id;
		const gene = stampGene(db, 'drill', drill);
		expect(visibleMembers(db, 'u1', 'drill', drill).map((m) => [m.id, m.access])).toEqual([
			[drill, 'edit']
		]);
		expect(memberIn(db, 'drill', gene, U1_SALSA)).toEqual({ id: drill, archived: false });
		expect(familyRows(db, 'drill', gene).map((r) => r.id)).toEqual([drill]);
	});
});

describe('visibleMembers', () => {
	/** u1's own Enchufla and the group's, one family; the group's in a published lesson. */
	function family() {
		const group = figure(T1_SALSA, 'Enchufla');
		const lesson = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-03',
			title: 'Tue',
			notes: null
		}).lesson.id;
		linkFigure(db, lesson, group, 'u1');
		publishLesson(db, T1_SALSA, lesson, T);
		const own = figure(U1_SALSA, 'Enchufla');
		const gene = stampGene(db, 'figure', group);
		setGene(own, gene);
		db.update(figures).set({ clonedFrom: group }).where(eq(figures.id, own)).run();
		return { group, own, lesson };
	}

	it('never shows another person’s own member, nor a family through one', () => {
		const { group, own } = family();
		const team = { kind: 'team', teamId: 1, name: 'Salsa Tuesdays' };
		const theirs = [
			{ kind: 'figure', id: group, place: team, access: 'read', archived: false, clonedFrom: null }
		];
		expect(visibleMembers(db, 'u2', 'figure', own)).toEqual([]);
		expect(visibleMembers(db, 'u2', 'figure', group)).toEqual(theirs);
	});

	it('shows the owner both, editable, and an editor the group’s as edit', () => {
		const { group, own } = family();
		expect(visibleMembers(db, 'u1', 'figure', group)).toEqual([
			{
				kind: 'figure',
				id: group,
				place: { kind: 'team', teamId: 1, name: 'Salsa Tuesdays' },
				access: 'edit',
				archived: false,
				clonedFrom: null
			},
			{
				kind: 'figure',
				id: own,
				place: { kind: 'mine' },
				access: 'edit',
				archived: false,
				clonedFrom: group
			}
		]);
		setRole(db, 1, 'u3', 'editor', T);
		expect(visibleMembers(db, 'u3', 'figure', group).map((m) => [m.id, m.access])).toEqual([
			[group, 'edit']
		]);
		expect(visibleMembers(db, 'u3', 'figure', own)).toEqual([]);
	});

	it('a draft reaches no member; a deleted group only its editors, read-only', () => {
		const group = figure(T1_SALSA, 'Enchufla');
		const own = figure(U2_SALSA, 'Enchufla');
		setGene(own, stampGene(db, 'figure', group));
		expect(visibleMembers(db, 'u2', 'figure', own).map((m) => m.id)).toEqual([own]);
		deleteTeam(db, 1, 'u1', T);
		expect(visibleMembers(db, 'u1', 'figure', group).map((m) => [m.id, m.access])).toEqual([
			[group, 'read']
		]);
	});

	it('a row without a gene is a family of one', () => {
		const own = figure(U1_SALSA, 'Enchufla');
		figure(U2_SALSA, 'Enchufla');
		expect(visibleMembers(db, 'u1', 'figure', own).map((m) => m.id)).toEqual([own]);
		expect(visibleMembers(db, 'u2', 'figure', own)).toEqual([]);
		expect(visibleMembers(db, 'u1', 'figure', 999)).toEqual([]);
	});
});
