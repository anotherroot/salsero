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

describe('Same as… candidates', () => {
	it('lists the group’s figures and your own, not the family of the page’s row', async () => {
		const { twinCandidates, setTwins } = await import('./twins');
		const { cloneInto } = await import('./clones/clone');
		const { NO_FILES } = await import('./test-walls');
		const basic = groupFigure('Basica');
		const doble = groupFigure('Enchufla');
		const { addLesson } = await import('./entries');
		// u2 added the class lesson: its figures are in their app
		addLesson(db, 'u2', lessonId, { lesson: true, routineIds: [], drillIds: [], figureIds: [] }, T);
		const mine = figure(U2_SALSA, 'Enchufla', 'Doble');
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: basic, into: U2_SALSA, recordings: false },
			NO_FILES,
			T
		);
		if (!r.ok) throw new Error('setup');
		const copy = { id: r.id };
		const list = twinCandidates(db, U2_SALSA, 'figure', mine);
		const ids = list.map((c) => c.id);
		expect(ids).toContain(copy.id);
		expect(ids).not.toContain(basic);
		expect(ids).toContain(doble);
		expect(list.find((c) => c.id === doble)!.place).toEqual({
			kind: 'team',
			teamId: 1,
			name: 'Class'
		});
		expect(ids).not.toContain(mine);
		// the copy's own family: the group's Basica is shown with the copy, never offered next to it
		expect(twinCandidates(db, U2_SALSA, 'figure', copy.id).map((c) => c.id)).not.toContain(basic);
		expect(twinCandidates(db, U2_SALSA, 'figure', copy.id).map((c) => c.id)).not.toContain(copy.id);
		expect(setTwins(db, U2_SALSA, 'figure', mine, [doble, copy.id])).toBe(true);
		expect(twinCandidates(db, U2_SALSA, 'figure', mine).filter((c) => c.ticked)).toHaveLength(2);
		expect(setTwins(db, U2_SALSA, 'figure', mine, [doble])).toBe(true);
		expect(twinsOf(db, 'u2', 'figure', mine)).toEqual([doble]);
		expect(setTwins(db, U2_SALSA, 'figure', mine, [])).toBe(true);
		expect(twinSets(db, U2_SALSA, 'figure')).toEqual([]);
		// not a candidate: refused, nothing changes
		expect(setTwins(db, U2_SALSA, 'figure', mine, [mine, 99999])).toBe(false);
	});

	it('separating one of three leaves a set of two; a stranger sees no twins', () => {
		const a = figure(U2_SALSA, 'A');
		const b = figure(U2_SALSA, 'B');
		const c = figure(U2_SALSA, 'C');
		markTwins(db, U2_SALSA, 'figure', [a, b, c]);
		expect(separate(db, U2_SALSA, 'figure', c)).toBe(true);
		expect(twinSets(db, U2_SALSA, 'figure')).toEqual([[a, b]]);
		const g = groupFigure('Enchufla');
		markTwins(db, U2_SALSA, 'figure', [a, g]);
		expect(twinsOf(db, 'u1', 'figure', g)).toEqual([]);
		expect(twinsOf(db, 'u3', 'figure', g)).toEqual([]);
	});
});

describe('pickers fold twins', () => {
	/** u2's Enchufla · Basic, twin of the class's Enchufla · Basic, which u2 added. */
	const setup = async () => {
		const { addLesson } = await import('./entries');
		const g = groupFigure('Enchufla');
		const other = groupFigure('Setenta');
		addLesson(db, 'u2', lessonId, { lesson: true, routineIds: [], drillIds: [], figureIds: [] }, T);
		const mine = figure(U2_SALSA, 'Enchufla');
		expect(markTwins(db, U2_SALSA, 'figure', [mine, g])).toBe(true);
		return { g, other, mine };
	};

	it('one row per set, yours used, the twin behind it named', async () => {
		const { foldVersions } = await import('./twins');
		const { listVersions } = await import('./figures');
		const { usableVersions } = await import('./usable');
		const { g, other, mine } = await setup();
		const rows = foldVersions(db, U2_SALSA, [
			...listVersions(db, U2_SALSA),
			...usableVersions(db, U2_SALSA)
		]);
		expect(rows.map((r) => r.id)).toEqual([mine, other]);
		expect(rows[0].twins).toEqual([
			{ id: g, figure: 'Enchufla', name: 'Basic', team: { id: 1, name: 'Class' } }
		]);
		expect(rows[1].twins).toBeUndefined();
		// A group's space folds nothing: groups have no twins.
		const team = { dance: 'salsa', teamId: 1, actorId: 'u2' } as const;
		expect(foldVersions(db, team, listVersions(db, team)).map((r) => r.id)).toEqual([g, other]);
	});

	it('a lesson’s Link figure picker offers the set once, linked when a twin is', async () => {
		const { listLinkableFigures } = await import('./lessons');
		const { g, other, mine } = await setup();
		const own = createLesson(db, U2_SALSA, {
			lessonDay: '2026-11-02',
			title: 'Mine',
			notes: null
		}).lesson.id;
		linkFigure(db, own, g, 'u2');
		const rows = listLinkableFigures(db, own);
		expect(rows.map((r) => [r.id, r.linked])).toEqual([
			[mine, true],
			[other, false]
		]);
		// The group's own lesson: its figures, unfolded.
		expect(listLinkableFigures(db, lessonId).map((r) => r.id)).toEqual([g, other]);
	});

	it('the Link popup on a person’s section offers the set once', async () => {
		const { linkOptions } = await import('./link-popup');
		const { addLessonVideo } = await import('./lessons');
		const { addSpot } = await import('./spots');
		const { g, mine } = await setup();
		const own = createLesson(db, U2_SALSA, {
			lessonDay: '2026-11-02',
			title: 'Mine',
			notes: null
		}).lesson.id;
		const video = addLessonVideo(db, {
			lessonId: own,
			file: 'm.mp4',
			mime: 'video/mp4',
			sizeBytes: 1
		}).id;
		const spot = addSpot(db, { lessonVideoId: video }, { startMs: 0, endMs: 2000, label: 'A' })!.id;
		const o = linkOptions(db, spot, 'salsa')!;
		const ids = [...o.near, ...o.figures].map((x) => (x.target as { figureId?: number }).figureId);
		expect(ids).toContain(mine);
		expect(ids).not.toContain(g);
		const row = [...o.near, ...o.figures].find(
			(x) => (x.target as { figureId?: number }).figureId === mine
		)!;
		expect(row.twins?.map((t) => t.id)).toEqual([g]);
	});
});

describe('Separate and the ticks act across the family', () => {
	it('a twin mark on another member of the page’s family', async () => {
		const { cloneInto } = await import('./clones/clone');
		const { NO_FILES } = await import('./test-walls');
		const { addLesson } = await import('./entries');
		const { twinCandidates, separateFamily } = await import('./twins');
		const g = groupFigure('Enchufla');
		const other = groupFigure('Setenta');
		addLesson(db, 'u2', lessonId, { lesson: true, routineIds: [], drillIds: [], figureIds: [] }, T);
		// u2's copy of the class's Enchufla: one family with it.
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: g, into: U2_SALSA, recordings: false },
			NO_FILES,
			T
		);
		if (!r.ok) throw new Error('setup');
		const mine = figure(U2_SALSA, 'Dile que no');
		// The mark sits on the class's row; the page is u2's copy.
		expect(markTwins(db, U2_SALSA, 'figure', [g, mine])).toBe(true);
		const ticks = twinCandidates(db, U2_SALSA, 'figure', r.id).filter((c) => c.ticked);
		expect(ticks.map((c) => c.id)).toEqual([mine]);
		expect(twinCandidates(db, U2_SALSA, 'figure', r.id).map((c) => c.id)).toContain(other);

		expect(separateFamily(db, U2_SALSA, 'figure', r.id)).toBe(true);
		expect(db.select().from(twins).all()).toEqual([]);
		expect(separateFamily(db, U2_SALSA, 'figure', r.id)).toBe(false);
	});

	it('leaves a set’s other twins together', async () => {
		const { separateFamily } = await import('./twins');
		const [a, b, c] = ['A', 'B', 'C'].map((n) => figure(U2_SALSA, n));
		markTwins(db, U2_SALSA, 'figure', [a, b, c]);
		expect(separateFamily(db, U2_SALSA, 'figure', a)).toBe(true);
		expect(twinSets(db, U2_SALSA, 'figure')).toEqual([[b, c]]);
	});
});
