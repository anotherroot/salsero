import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { figures, lessons, routines, songs, users } from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { archiveVariation, createFigure, listAddedFigures } from '../figures';
import { createRoutine, listAddedRoutines, listUsableRoutines } from '../routines';
import {
	createLesson,
	getLesson,
	linkFigure,
	linkRoutine,
	listLinkableFigures,
	listMyLessons
} from '../lessons';
import { addLesson } from '../entries';
import { listSharedSongs } from '../songs';
import { usableOf, usableVersions } from '../usable';
import { T1_SALSA, U2_SALSA } from '../test-walls';
import { myMembers } from './shadow';

const T = Date.UTC(2026, 10, 3, 20);
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const NONE = { lesson: true, routineIds: [], drillIds: [], figureIds: [] };
let db: Db;
let setenta: number; // the group's
let enchufla: number;
let mine: number; // u2's own Setenta
let routineG: number;
let routineMine: number;
let lessonG: number;

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
	setenta = createFigure(db, T1_SALSA, { figureName: 'Setenta', name: 'Basic', ...shape })!.figure
		.id;
	enchufla = createFigure(db, T1_SALSA, { figureName: 'Enchufla', name: 'Basic', ...shape })!.figure
		.id;
	mine = createFigure(db, U2_SALSA, { figureName: 'Setenta', name: 'Basic', ...shape })!.figure.id;
	db.update(figures).set({ geneId: 'g-set' }).where(eq(figures.id, setenta)).run();
	db.update(figures).set({ geneId: 'g-set' }).where(eq(figures.id, mine)).run();
	routineG = createRoutine(db, T1_SALSA, { name: 'Warm up', notes: null }).routine.id;
	routineMine = createRoutine(db, U2_SALSA, { name: 'Warm up', notes: null }).routine.id;
	db.update(routines).set({ geneId: 'g-r' }).where(eq(routines.id, routineG)).run();
	db.update(routines).set({ geneId: 'g-r' }).where(eq(routines.id, routineMine)).run();
	lessonG = createLesson(db, T1_SALSA, { lessonDay: '2026-11-02', title: 'Week 6', notes: null })
		.lesson.id;
	linkFigure(db, lessonG, setenta, 'u1');
	linkFigure(db, lessonG, enchufla, 'u1');
	linkRoutine(db, lessonG, routineG, 'u1');
	db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, lessonG)).run();
	expect(addLesson(db, 'u2', lessonG, NONE, 5)).toBe(true);
});

const ids = (moves: { figures: { id: number }[] }[]) =>
	moves.flatMap((m) => m.figures.map((f) => f.id));

describe('myMembers', () => {
	it('finds the live member by gene, never an archived one', () => {
		expect(myMembers(db, U2_SALSA, 'figure', ['g-set', null, 'nope'])).toEqual(
			new Map([['g-set', mine]])
		);
		archiveVariation(db, mine, 9, 'u2');
		expect(myMembers(db, U2_SALSA, 'figure', ['g-set']).size).toBe(0);
	});
});

describe('Moves group sections', () => {
	it('hide the figure you made yours, and a move that loses all its figures', () => {
		const sections = listAddedFigures(db, U2_SALSA);
		expect(ids(sections.flatMap((s) => s.moves))).toEqual([enchufla]);
	});
	it('show the group row again when your copy is archived', () => {
		archiveVariation(db, mine, 9, 'u2');
		expect(ids(listAddedFigures(db, U2_SALSA).flatMap((s) => s.moves)).sort()).toEqual(
			[setenta, enchufla].sort()
		);
	});
});

describe('Routines group sections', () => {
	it('hide the routine you made yours', () => {
		expect(listAddedRoutines(db, U2_SALSA)).toEqual([]);
	});
});

describe('the Lessons tab', () => {
	it('shows a group lesson you made yours once, as yours', () => {
		const copy = createLesson(db, U2_SALSA, {
			lessonDay: '2026-11-02',
			title: 'Week 6',
			notes: null
		}).lesson.id;
		expect(listMyLessons(db, U2_SALSA).map((l) => l.id)).toContain(lessonG);
		db.update(lessons).set({ geneId: 'g-l' }).where(eq(lessons.id, lessonG)).run();
		db.update(lessons).set({ geneId: 'g-l' }).where(eq(lessons.id, copy)).run();
		const list = listMyLessons(db, U2_SALSA).filter((l) => l.title === 'Week 6');
		expect(list.map((l) => l.id)).toEqual([copy]);
	});
});

describe('the Music tab', () => {
	it('shows a class song once, as yours', () => {
		const song = (o: object) =>
			db
				.insert(songs)
				.values({
					title: 'Oye',
					dance: 'salsa',
					status: 'ready',
					audioFile: `a${Math.random()}.mp3`,
					...o
				} as never)
				.returning()
				.get().id;
		const g = song({ teamId: 1, sharedAt: 1, geneId: 'g-s' });
		expect(listSharedSongs(db, 'u2', 'salsa')[0].songs.map((s) => s.id)).toEqual([g]);
		song({ userId: 'u2', geneId: 'g-s' });
		expect(listSharedSongs(db, 'u2', 'salsa')).toEqual([]);
	});
});

describe('the pickers', () => {
	it("offer your copy, not the group's, but usableOf keeps the group's", () => {
		expect(usableOf(db, U2_SALSA).figures.has(setenta)).toBe(true);
		const picks = usableVersions(db, U2_SALSA).map((v) => v.id);
		expect(picks).toContain(enchufla);
		expect(picks).not.toContain(setenta);
		expect(usableVersions(db, U2_SALSA, usableOf(db, U2_SALSA), 'keep').map((v) => v.id)).toContain(
			setenta
		);
		expect(listLinkableFigures(db, createOwnLesson()).map((v) => v.id)).toContain(mine);
		expect(listLinkableFigures(db, createOwnLesson()).map((v) => v.id)).not.toContain(setenta);
		expect(listUsableRoutines(db, U2_SALSA).map((r) => r.id)).not.toContain(routineG);
		expect(usableOf(db, U2_SALSA).routines.has(routineG)).toBe(true);
		expect(routineMine).toBeGreaterThan(0);
	});
	it('offer the group row again once your copy is archived', () => {
		archiveVariation(db, mine, 9, 'u2');
		expect(usableVersions(db, U2_SALSA).map((v) => v.id)).toContain(setenta);
	});
});

function createOwnLesson() {
	return createLesson(db, U2_SALSA, { lessonDay: '2026-11-03', title: 'Own', notes: null }).lesson
		.id;
}

describe('a group lesson page', () => {
	it('marks the link cards you have a copy of', () => {
		const page = getLesson(db, lessonG, 'u2')!;
		expect(page.figures.find((f) => f.id === setenta)?.mineId).toBe(mine);
		expect(page.figures.find((f) => f.id === enchufla)?.mineId).toBeNull();
		expect(page.routines.find((r) => r.id === routineG)?.mineId).toBe(routineMine);
	});
});
