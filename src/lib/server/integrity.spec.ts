/**
 * The safety nets later specs run: `crossRefs` (nobody's row points where it
 * must not) and `familyIntegrity` (one member of a family per piece parent).
 * Rows are inserted by hand: these checks exist for states the data
 * functions should never make.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import {
	exercises,
	figures,
	lessonExercises,
	lessonFigures,
	lessonRoutines,
	lessonVideos,
	recordings,
	routines,
	routineStepOptions,
	routineSteps,
	spotLinks,
	users,
	videoSpots
} from './db/schema';
import { createTeam, joinTeam } from './teams';
import { setRole } from './membership';
import { createFigure } from './figures';
import { createLesson, linkFigure, publishLesson } from './lessons';
import { crossRefs, familyIntegrity } from './integrity';
import { figureAccess, teamReader } from './access';
import { T1_SALSA, U1_SALSA, U2_SALSA } from './test-walls';
import type { Space } from './scope';

const T = 1_800_000_000_000;

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	for (const id of ['u1', 'u2', 'u3'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x' })
			.run();
	const made = createTeam(db, 'u1', 'salsa', 'Class', 1);
	if (!made.ok || made.teamId !== 1) throw new Error('setup');
});

let names = 0;
const figure = (space: Space) =>
	createFigure(db, space, {
		figureName: `F${++names}`,
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;

const routine = (owner: { userId?: string; teamId?: number }) =>
	db
		.insert(routines)
		.values({ dance: 'salsa', name: `R${++names}`, ...owner })
		.returning()
		.get().id;

/** A figure slot holding `figureId` as its one option. */
const option = (routineId: number, figureId: number, position = 0) => {
	const step = db.insert(routineSteps).values({ routineId, position }).returning().get().id;
	db.insert(routineStepOptions).values({ stepId: step, figureId }).run();
};

const drill = (owner: { userId?: string; teamId?: number }) =>
	db
		.insert(exercises)
		.values({ name: `D${++names}`, dance: 'salsa', source: 'custom', ...owner })
		.returning()
		.get().id;

const lessonOf = (space: Space) =>
	createLesson(db, space, { lessonDay: '2026-11-01', title: `L${++names}`, notes: null }).lesson.id;

describe('crossRefs', () => {
	it('is empty for a whole database', () => {
		const mine = figure(U2_SALSA);
		const R = routine({ userId: 'u2' });
		option(R, mine);
		const G = figure(T1_SALSA);
		const TR = routine({ teamId: 1 });
		option(TR, G);
		expect(crossRefs(db)).toEqual([]);
	});

	it('reports a group slot option pointing at a personal figure', () => {
		const TR = routine({ teamId: 1 });
		const mine = figure(U1_SALSA);
		option(TR, mine);
		expect(crossRefs(db)).toEqual([`routines ${TR}: option figure ${mine} is outside group 1`]);
	});

	it('reports a personal option on a group figure of a group the person is not in, and not once they read it', () => {
		const G = figure(T1_SALSA);
		const R = routine({ userId: 'u2' });
		option(R, G);
		expect(crossRefs(db)).toEqual([
			`routines ${R}: option figure ${G} is group 1's, which u2 does not read`
		]);

		// A member reads it once a published lesson holds it.
		joinTeam(db, 'u2', 1, T);
		const L = lessonOf(T1_SALSA);
		linkFigure(db, L, G, 'u1');
		expect(crossRefs(db)).toHaveLength(1);
		publishLesson(db, T1_SALSA, L, T);
		expect(crossRefs(db)).toEqual([]);
	});

	it('lets an editor point at a draft, and reports it again after a demotion', () => {
		const G = figure(T1_SALSA);
		const R = routine({ userId: 'u2' });
		option(R, G);
		joinTeam(db, 'u2', 1, T);
		setRole(db, 1, 'u2', 'editor');
		expect(crossRefs(db)).toEqual([]);
		setRole(db, 1, 'u2', 'member');
		expect(crossRefs(db)).toHaveLength(1);
	});

	it('reports a personal row pointing at another person’s', () => {
		const theirs = figure(U1_SALSA);
		const R = routine({ userId: 'u2' });
		option(R, theirs);
		expect(crossRefs(db)).toEqual([`routines ${R}: option figure ${theirs} is another person's`]);
	});

	it('covers embeds, a group lesson’s links, section links, and entries', () => {
		const G = figure(T1_SALSA);
		const mineU1 = figure(U1_SALSA);
		const groupDrill = drill({ teamId: 1 });

		// A group routine embedding u1's own.
		const TR = routine({ teamId: 1 });
		const own = routine({ userId: 'u1' });
		db.insert(routineSteps).values({ routineId: TR, position: 0, childRoutineId: own }).run();

		// A group lesson linking u1's own figure, routine and drill.
		const TL = lessonOf(T1_SALSA);
		const ownDrill = drill({ userId: 'u1' });
		db.insert(lessonFigures).values({ lessonId: TL, figureId: mineU1 }).run();
		db.insert(lessonRoutines).values({ lessonId: TL, routineId: own }).run();
		db.insert(lessonExercises).values({ lessonId: TL, exerciseId: ownDrill }).run();

		// A section of a group video linked to u1's figure.
		const V = db
			.insert(lessonVideos)
			.values({ lessonId: TL, file: 'a.mp4', mime: 'video/mp4', sizeBytes: 1 })
			.returning()
			.get().id;
		const S = db
			.insert(videoSpots)
			.values({ lessonVideoId: V, startMs: 0, endMs: 1000 })
			.returning()
			.get().id;
		const SL = db.insert(spotLinks).values({ spotId: S, figureId: mineU1 }).returning().get().id;

		// u2 (no member) with a section of their own recording linked to the group drill,
		// and an entry on the group figure; an archived entry is no pointer.
		const mineU2 = figure(U2_SALSA);
		const rec = db
			.insert(recordings)
			.values({ figureId: mineU2, file: 'b.mp4', mime: 'video/mp4', kind: 'video', sizeBytes: 1 })
			.returning()
			.get().id;
		const S2 = db
			.insert(videoSpots)
			.values({ recordingId: rec, startMs: 0, endMs: 1000 })
			.returning()
			.get().id;
		const SL2 = db
			.insert(spotLinks)
			.values({ spotId: S2, exerciseId: groupDrill })
			.returning()
			.get().id;
		const entry = db
			.insert(exercises)
			.values({ name: 'E', dance: 'salsa', source: 'figure', figureId: G, userId: 'u2' })
			.returning()
			.get().id;
		const R2 = routine({ userId: 'u2' });
		db.insert(routineSteps).values({ routineId: R2, position: 0, childRoutineId: TR }).run();
		db.insert(exercises)
			.values({
				name: 'Old',
				dance: 'salsa',
				source: 'added',
				drillId: groupDrill,
				userId: 'u2',
				archivedAt: T
			})
			.run();

		expect(crossRefs(db).sort()).toEqual(
			[
				`routines ${TR}: embedded routine ${own} is outside group 1`,
				`lessons ${TL}: linked figure ${mineU1} is outside group 1`,
				`lessons ${TL}: linked routine ${own} is outside group 1`,
				`lessons ${TL}: linked drill ${ownDrill} is outside group 1`,
				`spot_links ${SL}: linked figure ${mineU1} is outside group 1`,
				`spot_links ${SL2}: linked drill ${groupDrill} is group 1's, which u2 does not read`,
				`exercises ${entry}: entry's figure ${G} is group 1's, which u2 does not read`,
				`routines ${R2}: embedded routine ${TR} is group 1's, which u2 does not read`
			].sort()
		);
	});
});

describe('teamReader', () => {
	it('answers as figureAccess does, for the owner, a member, an editor and a stranger', () => {
		joinTeam(db, 'u2', 1, T);
		const reached = figure(T1_SALSA);
		const draft = figure(T1_SALSA);
		const L = lessonOf(T1_SALSA);
		linkFigure(db, L, reached, 'u1');
		publishLesson(db, T1_SALSA, L, T);
		const row = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;
		for (const role of ['member', 'editor'] as const) {
			setRole(db, 1, 'u2', role);
			for (const user of ['u1', 'u2', 'u3']) {
				const reader = teamReader(db, user, 1);
				for (const id of [reached, draft]) {
					expect([role, user, id, reader('figure', id)]).toEqual([
						role,
						user,
						id,
						figureAccess(db, user, row(id)) !== null
					]);
				}
			}
		}
	});
});

describe('familyIntegrity', () => {
	it('reports a piece parent holding two rows of one gene', () => {
		const F = figure(U2_SALSA);
		const rec = (file: string, geneId: string | null) =>
			db
				.insert(recordings)
				.values({ figureId: F, file, mime: 'video/mp4', kind: 'video', sizeBytes: 1, geneId })
				.returning()
				.get().id;
		rec('a.mp4', 'g1');
		rec('b.mp4', null);
		rec('c.mp4', null);
		expect(familyIntegrity(db)).toEqual([]);
		const a = rec('d.mp4', 'g2');
		const b = rec('e.mp4', 'g2');
		expect(familyIntegrity(db)).toEqual([`figures ${F}: recordings ${a}, ${b} are one family`]);

		const L = lessonOf(U2_SALSA);
		const v = (file: string) =>
			db
				.insert(lessonVideos)
				.values({ lessonId: L, file, mime: 'video/mp4', sizeBytes: 1, geneId: 'g3' })
				.returning()
				.get().id;
		const v1 = v('f.mp4');
		const v2 = v('g.mp4');
		const spot = () =>
			db
				.insert(videoSpots)
				.values({ lessonVideoId: v1, startMs: 0, endMs: 1000, geneId: 'g4' })
				.returning()
				.get().id;
		const s1 = spot();
		const s2 = spot();
		expect(familyIntegrity(db)).toEqual([
			`figures ${F}: recordings ${a}, ${b} are one family`,
			`lessons ${L}: videos ${v1}, ${v2} are one family`,
			`lesson_videos ${v1}: sections ${s1}, ${s2} are one family`
		]);
	});
});
