/**
 * The whole story of the clones and twins spec, end to end through the data
 * functions: Ana's Enchufla · Doble copied into her two groups, a co-teacher's
 * timing in one, a member using the class's figure in her own routine, one
 * Sync from Ana's own copy as the hub, Make it mine, Drop my copy,
 * leaving with what her routines use, and rejoining. After every step no
 * person's own row points at what they cannot read (`crossRefs`) and no
 * parent holds two pieces of one family (`familyIntegrity`). Files are fakes;
 * the database is in memory.
 */
import { beforeEach, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import {
	exercises,
	figures,
	lessonFigures,
	lessons,
	routineStepOptions,
	routineSteps,
	users
} from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { leaveTeam, setRole } from '../membership';
import { createFigure, updateVariation } from '../figures';
import { graphFor, setFigureShape } from '../graph';
import { createLesson, linkFigure, publishLesson } from '../lessons';
import { addFigureSlot, createRoutine } from '../routines';
import { addLesson } from '../entries';
import { figureAccess, lessonAccess } from '../access';
import { crossRefs, familyIntegrity } from '../integrity';
import { T1_SALSA, T2_SALSA, U1_SALSA, U2_SALSA } from '../test-walls';
import type { CloneFiles } from './files';
import { accessTo, geneOf } from './genes';
import { copyTo } from './copy-to';
import { stepStatus } from './step';
import { syncAll, syncView } from './sync';
import { makeMine } from './edit';
import { dropCopy, dropOptions } from './drop';
import { sourcesView } from './sources';

const DAY = 86_400_000;
const T = Date.UTC(2026, 10, 3, 20);
const ROOMY = 1024 ** 4;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const timing = (startCount: number, lengthCounts = 8) => ({
	startIds: [],
	endIds: [],
	startCount,
	lengthCounts
});

let db: Db;
let named = 0;
const files: CloneFiles = {
	link: async (_kind, file) => `copy-${++named}-${file}`,
	unlink: async () => {}
};

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Pia' },
			{ id: 'u4', email: 'u4@x.si', passwordHash: 'x', firstName: 'Marko' }
		])
		.run();
});

/** Nothing of a person's points where they cannot read, and no parent holds two of one family. */
function whole(step: string) {
	expect(crossRefs(db), step).toEqual([]);
	expect(familyIntegrity(db), step).toEqual([]);
}

const row = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;
const start = (id: number) => row(id).startCount;
/** The figures Pia's routine's slots hold. */
const slotsOf = (routineId: number) =>
	db
		.select({ figureId: routineStepOptions.figureId })
		.from(routineStepOptions)
		.innerJoin(routineSteps, eq(routineSteps.id, routineStepOptions.stepId))
		.where(eq(routineSteps.routineId, routineId))
		.all()
		.map((r) => r.figureId);
/** Pia's own figures of Doble's family, live or archived. */
const piasCopies = (gene: string) =>
	db
		.select()
		.from(figures)
		.where(and(eq(figures.userId, 'u2'), eq(figures.geneId, gene)))
		.all();
/** Pia's live practice entries on a figure. */
const practiceOn = (figureId: number) =>
	db
		.select()
		.from(exercises)
		.where(
			and(
				eq(exercises.userId, 'u2'),
				eq(exercises.figureId, figureId),
				isNull(exercises.archivedAt)
			)
		)
		.all();

it('Ana’s Enchufla, from her app through two groups to Pia and back', async () => {
	// 1. Ana's own Enchufla · Doble, copied into Salsa Tuesdays and Rueda club;
	// her own lesson linking it copied into Salsa Tuesdays (a draft there,
	// linking the group's Doble), then published.
	expect(createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T)).toEqual({ ok: true, teamId: 1 });
	expect(createTeam(db, 'u1', 'salsa', 'Rueda club', T)).toEqual({ ok: true, teamId: 2 });
	const H = createFigure(db, U1_SALSA, { figureName: 'Enchufla', name: 'Doble', ...shape })!.figure
		.id;
	const copied = async (kind: 'figure' | 'lesson', id: number, into: typeof T1_SALSA) => {
		const r = await copyTo(db, 'u1', kind, id, into, {}, files, T, ROOMY);
		if (!r.ok) throw new Error(`copy refused: ${r.reason}`);
		return r.id;
	};
	const T1f = await copied('figure', H, T1_SALSA);
	const T2f = await copied('figure', H, T2_SALSA);
	const own = createLesson(db, U1_SALSA, { lessonDay: '2026-11-03', title: 'Week 1', notes: null })
		.lesson.id;
	expect(linkFigure(db, own, H)).toBe(true);
	const L = await copied('lesson', own, T1_SALSA);
	const lesson = () => db.select().from(lessons).where(eq(lessons.id, L)).get()!;
	expect(lesson().publishedAt).toBeNull();
	expect(
		db
			.select()
			.from(lessonFigures)
			.where(eq(lessonFigures.lessonId, L))
			.all()
			.map((r) => r.figureId)
	).toEqual([T1f]);
	expect(publishLesson(db, T1_SALSA, L, T)).toBe(true);
	const gene = geneOf(db, 'figure', H)!;
	expect([geneOf(db, 'figure', T1f), geneOf(db, 'figure', T2f)]).toEqual([gene, gene]);
	whole('1. copied into both groups');

	// 2. Marko, an editor of Rueda club, moves its timing to the 3.
	joinTeam(db, 'u4', 2, T);
	setRole(db, 2, 'u4', 'editor', T);
	expect(setFigureShape(db, T2f, timing(3), 'u4')).toBe(true);
	expect([start(H), start(T1f), start(T2f)]).toEqual([1, 1, 3]);
	whole('2. Marko’s timing');

	// 3. Pia joins Salsa Tuesdays, adds Week 1 with the figure, and uses the
	// class's Doble in her own routine: no copy.
	expect(joinTeam(db, 'u2', 1, T + 1)).toBe('joined');
	expect(
		addLesson(db, 'u2', L, { lesson: false, routineIds: [], drillIds: [], figureIds: [T1f] }, T + 1)
	).toBe(true);
	const P = createRoutine(db, U2_SALSA, { name: 'My loop', notes: null }).routine.id;
	expect(addFigureSlot(db, P, T1f, 'u2')).not.toBeNull();
	expect(slotsOf(P)).toEqual([T1f]);
	expect(piasCopies(gene)).toEqual([]);
	expect(practiceOn(T1f)).toHaveLength(1);
	whole('3. Pia uses the class’s Doble');

	// 4. Ana writes notes on hers and opens Sync: her notes and Rueda club's
	// timing are each preselected (only one copy changed each), and one Sync
	// lands both on all three.
	expect(updateVariation(db, H, { name: 'Doble', ...shape, notes: 'Hips first' })).not.toBeNull();
	const view4 = syncView(db, 'u1', 'figure', H)!;
	expect(view4.targets.map((t) => t.id)).toEqual([H, T2f, T1f]);
	const synced = await syncAll(
		db,
		'u1',
		'figure',
		H,
		{},
		view4.targets,
		view4.members,
		files,
		T + 2 * DAY,
		ROOMY
	);
	expect(synced).toEqual({ ok: true, refused: [] });
	expect([row(H).notes, row(T1f).notes, row(T2f).notes]).toEqual([
		'Hips first',
		'Hips first',
		'Hips first'
	]);
	expect([start(H), start(T1f), start(T2f)]).toEqual([3, 3, 3]);
	expect(stepStatus(db, 'u1', 'figure', H)).toEqual({ lines: [], sending: 0 });
	whole('4. one Sync: notes from hers, timing from Rueda club');

	// 6. Pia's routine plays Salsa Tuesdays' Doble, on the new timing.
	expect(slotsOf(P)).toEqual([T1f]);
	expect(graphFor(db, U2_SALSA).figures.find((f) => f.id === T1f)?.start).toBe(3);
	whole('6. Pia’s routine on the new timing');

	// 7. Pia makes it hers: her routine and her practice move onto her copy.
	const made = await makeMine(db, U2_SALSA, 'figure', T1f, files, T + 4 * DAY, ROOMY);
	if (!made.ok) throw new Error(`make it mine refused: ${made.reason}`);
	const mine = made.id;
	expect(row(mine)).toMatchObject({ userId: 'u2', teamId: null, clonedFrom: T1f, startCount: 3 });
	expect(row(mine).notes).toBe('Hips first');
	expect(slotsOf(P)).toEqual([mine]);
	expect(practiceOn(T1f)).toEqual([]);
	expect(practiceOn(mine)).toHaveLength(1);
	whole('7. Pia’s copy');

	// 8. Pia drops her copy: back on Salsa Tuesdays' Doble, the only version
	// she reads, with her routine and her practice; her copy archived.
	const drop = dropOptions(db, U2_SALSA, 'figure', mine)!;
	expect(drop.choices.map((c) => c.id)).toEqual([T1f]);
	expect(dropCopy(db, U2_SALSA, 'figure', mine, T1f, {}, T + 5 * DAY)).toEqual({
		ok: true,
		toId: T1f
	});
	expect(slotsOf(P)).toEqual([T1f]);
	expect(row(mine).archivedAt).toBe(T + 5 * DAY);
	expect(practiceOn(T1f)).toHaveLength(1);
	whole('8. dropped back to the class’s');

	// 9. Pia leaves, keeping only what her routines use: one copy (hers, back
	// from the archive), her routine on it, and nothing of the group readable.
	expect(await leaveTeam(db, 1, 'u2', { mode: 'used' }, files, T + 6 * DAY)).toBe('left');
	const copies = piasCopies(gene);
	expect(copies.map((c) => [c.id, c.archivedAt])).toEqual([[mine, null]]);
	expect(slotsOf(P)).toEqual([mine]);
	expect(practiceOn(mine)).toHaveLength(1);
	expect(accessTo(db, 'u2', 'figure', T1f)).toBeNull();
	expect(figureAccess(db, 'u2', row(T1f))).toBeNull();
	expect(lessonAccess(db, 'u2', lesson())).toBeNull();
	whole('9. Pia left with what her routine uses');

	// While she is away, Ana rewrites the class's notes.
	expect(
		updateVariation(
			db,
			T1f,
			{ name: 'Doble', ...shape, notes: 'Hips first, then the arm' },
			'u1',
			T + 7 * DAY
		)
	).not.toBeNull();
	whole('Ana edits the class’s notes');

	// 10. Pia rejoins: her copy shows Salsa Tuesdays again, and the notice says
	// what changed while she was away.
	expect(joinTeam(db, 'u2', 1, T + 8 * DAY)).toBe('joined');
	expect(accessTo(db, 'u2', 'figure', T1f)).toBe('read');
	const view = sourcesView(db, 'u2', 'figure', mine);
	expect(view.sources.map((s) => [s.id, s.relation])).toEqual([
		[mine, 'self'],
		[T1f, 'clone']
	]);
	expect(view.sources.find((s) => s.id === T1f)?.rejoined).toBe(true);
	expect(stepStatus(db, 'u2', 'figure', mine)).toEqual({
		lines: [{ id: T1f, place: 'Salsa Tuesdays', state: 'changed', fields: ['Notes'] }],
		sending: 0
	});
	whole('10. rejoined');
});
