/**
 * Twins: a person's own "these are the same" between things in their app. A
 * per-person table, read only by views; marking merges sets, separating
 * leaves no set of one, and a row the person stopped reading drops out.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { routines, twins, users } from './db/schema';
import { createTeam, joinTeam } from './teams';
import { archiveVariation, createFigure } from './figures';
import { createLesson, linkFigure, publishLesson, unlinkFigure } from './lessons';
import { createSongFromUpload } from './songs';
import { markTwins, separate, twinSets, twinsOf } from './twins';
import { T1_SALSA, U1_BACHATA, U2_SALSA } from './test-walls';
import type { Space } from './scope';

const T = 1_800_000_000_000;
const U2_BACHATA = { userId: 'u2', dance: 'bachata' } as const;

let db: Db;
let lessonId: number;

beforeEach(() => {
	db = openDb(':memory:');
	for (const id of ['u1', 'u2', 'u3'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x' })
			.run();
	const made = createTeam(db, 'u1', 'salsa', 'Class', 1);
	if (!made.ok || made.teamId !== 1) throw new Error('setup');
	joinTeam(db, 'u2', 1, 2);
	lessonId = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'Week 6', notes: null })
		.lesson.id;
	publishLesson(db, T1_SALSA, lessonId, T);
});

const figure = (space: Space, figureName: string, name = 'Basic', style = 'salsa') =>
	createFigure(db, space, { figureName, name, partner: 'partner', style, notes: null })!.figure.id;

/** A group figure u2 reads, through the published lesson. */
const groupFigure = (figureName: string) => {
	const id = figure(T1_SALSA, figureName);
	linkFigure(db, lessonId, id, 'u1');
	return id;
};

describe('markTwins', () => {
	it('marking two then a third merges into one set', () => {
		const a = figure(U2_SALSA, 'Enchufla');
		const g = groupFigure('Enchufla');
		const b = figure(U2_SALSA, 'Enchufla doble');
		expect(markTwins(db, U2_SALSA, 'figure', [a, g])).toBe(true);
		expect(markTwins(db, U2_SALSA, 'figure', [g, b])).toBe(true);
		expect(twinSets(db, U2_SALSA, 'figure')).toEqual([[a, g, b].sort((x, y) => x - y)]);
		expect(
			new Set(
				db
					.select()
					.from(twins)
					.all()
					.map((r) => r.setId)
			).size
		).toBe(1);
		expect(twinsOf(db, 'u2', 'figure', a).sort()).toEqual([g, b].sort());
	});

	it('marking across two sets merges them both', () => {
		const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((n) => figure(U2_SALSA, n));
		expect(markTwins(db, U2_SALSA, 'figure', [a, b])).toBe(true);
		expect(markTwins(db, U2_SALSA, 'figure', [c, d])).toBe(true);
		expect(twinSets(db, U2_SALSA, 'figure')).toHaveLength(2);
		expect(markTwins(db, U2_SALSA, 'figure', [b, c])).toBe(true);
		expect(twinSets(db, U2_SALSA, 'figure')).toEqual([[a, b, c, d]]);
	});

	it('is refused for fewer than two, across kinds, across dances, and for what the person does not read', () => {
		const a = figure(U2_SALSA, 'Enchufla');
		expect(markTwins(db, U2_SALSA, 'figure', [a])).toBe(false);
		expect(markTwins(db, U2_SALSA, 'figure', [a, a])).toBe(false);

		// A routine's id is not a figure: one kind per call, and every id must be of it.
		db.insert(routines).values({ id: 900, dance: 'salsa', userId: 'u2', name: 'R' }).run();
		expect(markTwins(db, U2_SALSA, 'figure', [a, 900])).toBe(false);
		expect(markTwins(db, U2_SALSA, 'routine', [900, a])).toBe(false);

		const bachata = figure(U2_BACHATA, 'Cross', 'Basic', 'dominican');
		expect(markTwins(db, U2_SALSA, 'figure', [a, bachata])).toBe(false);
		expect(markTwins(db, U2_BACHATA, 'figure', [a, bachata])).toBe(false);

		// Someone else's own figure, and a group figure in no lesson u2 reads.
		const theirs = figure(U1_BACHATA, 'Cross', 'Basic', 'dominican');
		expect(markTwins(db, U2_BACHATA, 'figure', [bachata, theirs])).toBe(false);
		const draft = figure(T1_SALSA, 'Setenta');
		expect(markTwins(db, U2_SALSA, 'figure', [a, draft])).toBe(false);

		// An archived row holds no twin.
		const b = figure(U2_SALSA, 'Dile que no');
		archiveVariation(db, b, T);
		expect(markTwins(db, U2_SALSA, 'figure', [a, b])).toBe(false);
		expect(db.select().from(twins).all()).toEqual([]);
	});

	it('works for songs, the person’s own and a group’s they read', () => {
		const s1 = createSongFromUpload(db, U2_SALSA, {
			file: 'a.mp3',
			mime: 'audio/mpeg',
			title: 'A',
			style: 'salsa'
		}).id;
		const s2 = createSongFromUpload(db, U2_SALSA, {
			file: 'b.mp3',
			mime: 'audio/mpeg',
			title: 'B',
			style: 'salsa'
		}).id;
		expect(markTwins(db, U2_SALSA, 'song', [s1, s2])).toBe(true);
		expect(twinsOf(db, 'u2', 'song', s2)).toEqual([s1]);
	});
});

describe('twinsOf and twinSets', () => {
	it('hide a row the person stopped reading, or that was archived', () => {
		const a = figure(U2_SALSA, 'Enchufla');
		const g = groupFigure('Enchufla');
		const b = figure(U2_SALSA, 'Enchufla doble');
		expect(markTwins(db, U2_SALSA, 'figure', [a, g, b])).toBe(true);

		unlinkFigure(db, lessonId, g, false, T, 'u1');
		expect(twinsOf(db, 'u2', 'figure', a)).toEqual([b]);
		expect(twinSets(db, U2_SALSA, 'figure')).toEqual([[a, b]]);

		archiveVariation(db, b, T);
		expect(twinsOf(db, 'u2', 'figure', a)).toEqual([]);
		expect(twinSets(db, U2_SALSA, 'figure')).toEqual([]);

		// The rows stay: reading it again brings it back.
		linkFigure(db, lessonId, g, 'u1');
		expect(twinsOf(db, 'u2', 'figure', a)).toEqual([g]);
	});

	it('are the person’s own: another person sees none of them', () => {
		const a = figure(U2_SALSA, 'Enchufla');
		const g = groupFigure('Enchufla');
		expect(markTwins(db, U2_SALSA, 'figure', [a, g])).toBe(true);
		expect(twinsOf(db, 'u1', 'figure', g)).toEqual([]);
		expect(twinSets(db, { userId: 'u1', dance: 'salsa' }, 'figure')).toEqual([]);
	});
});

describe('separate', () => {
	it('on a pair removes both rows', () => {
		const a = figure(U2_SALSA, 'Enchufla');
		const g = groupFigure('Enchufla');
		expect(markTwins(db, U2_SALSA, 'figure', [a, g])).toBe(true);
		expect(separate(db, U2_SALSA, 'figure', g)).toBe(true);
		expect(db.select().from(twins).all()).toEqual([]);
		expect(twinsOf(db, 'u2', 'figure', a)).toEqual([]);
		expect(separate(db, U2_SALSA, 'figure', g)).toBe(false);
	});

	it('on a set of three leaves the other two together', () => {
		const [a, b, c] = ['A', 'B', 'C'].map((n) => figure(U2_SALSA, n));
		expect(markTwins(db, U2_SALSA, 'figure', [a, b, c])).toBe(true);
		expect(separate(db, U2_SALSA, 'figure', b)).toBe(true);
		expect(twinSets(db, U2_SALSA, 'figure')).toEqual([[a, c]]);
	});
});
