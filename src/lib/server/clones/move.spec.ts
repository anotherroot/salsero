/**
 * Move to… a group (board C4 p3, spec point 8): Ana's (u1) own lesson goes to
 * Salsa Tuesdays (T1, hers) as a draft and leaves her lessons. For each
 * figure, routine and drill it brings she keeps hers as well, or uses the
 * group's from now on (hers dropped, her other lessons and routines
 * re-pointed). Luka (u2) is a member of T1. Files are fakes; the database is
 * in memory.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import {
	exercises,
	figures,
	lessonExercises,
	lessonFigures,
	lessons,
	routineStepOptions,
	routineSteps,
	routines,
	sets,
	teamChanges,
	users
} from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { addFigureExercise, createFigure } from '../figures';
import { createLesson, linkExercise, linkFigure, linkRoutine } from '../lessons';
import { archiveRoutine, createRoutine } from '../routines';
import { figureAccess, lessonAccess } from '../access';
import { crossRefs } from '../integrity';
import type { Space } from '../scope';
import { NO_FILES, T1_SALSA, U1_SALSA } from '../test-walls';
import { cloneInto } from './clone';
import { geneOf, memberIn } from './genes';
import { moveLesson, moveOffer, movePreview } from './move';

const T = Date.UTC(2026, 10, 3, 20);
const NOW = T + 1000;
const ROOMY = 1024 ** 4;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };

let db: Db;

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
});

const figure = (space: Space, move: string, name = 'Básico') =>
	createFigure(db, space, { figureName: move, name, ...shape })!.figure.id;
const lesson = (title: string) =>
	createLesson(db, U1_SALSA, { lessonDay: '2026-11-01', title, notes: null }).lesson.id;
const routine = (name: string, figureIds: number[]) => {
	const id = createRoutine(db, U1_SALSA, { name, notes: null }).routine.id;
	figureIds.forEach((figureId, i) => {
		const step = db
			.insert(routineSteps)
			.values({ routineId: id, position: i })
			.returning()
			.get().id;
		db.insert(routineStepOptions).values({ stepId: step, figureId }).run();
	});
	return id;
};
const optionsOf = (routineId: number) =>
	db
		.select({ f: routineStepOptions.figureId })
		.from(routineStepOptions)
		.innerJoin(routineSteps, eq(routineSteps.id, routineStepOptions.stepId))
		.where(eq(routineSteps.routineId, routineId))
		.all()
		.map((r) => r.f);
const linkedIn = (lessonId: number) =>
	db
		.select({ f: lessonFigures.figureId })
		.from(lessonFigures)
		.where(eq(lessonFigures.lessonId, lessonId))
		.all()
		.map((r) => r.f)
		.sort((a, b) => a - b);
const fig = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;
const groupCopy = (id: number) => memberIn(db, 'figure', geneOf(db, 'figure', id)!, T1_SALSA)!.id;

/**
 * Week 3 brings Enchufla (also in Week 1 and Week 2), Setenta (only Week 3)
 * and Dile que no (in Ana's Week 4 loop).
 */
function week3() {
	const enchufla = figure(U1_SALSA, 'Enchufla');
	const setenta = figure(U1_SALSA, 'Setenta');
	const dile = figure(U1_SALSA, 'Dile que no');
	const L = lesson('Week 3');
	for (const f of [enchufla, setenta, dile]) linkFigure(db, L, f);
	linkFigure(db, lesson('Week 1'), enchufla);
	linkFigure(db, lesson('Week 2'), enchufla);
	const loop = routine('Week 4 loop', [dile]);
	return { L, enchufla, setenta, dile, loop };
}

const defaults = (p: NonNullable<ReturnType<typeof movePreview>>) =>
	Object.fromEntries(
		p.items.map((i) => [`${i.kind}:${i.id}`, i.keepByDefault ? 'keep' : 'group'] as const)
	);

describe('what the Move sheet shows (movePreview)', () => {
	it('names why each thing it brings is kept, and uses the group’s only for “Only this lesson”', () => {
		const { L, enchufla, setenta, dile } = week3();
		const p = movePreview(db, U1_SALSA, L, 1)!;
		expect(p.items.map((i) => [i.id, i.label, i.why, i.keepByDefault])).toEqual([
			[enchufla, 'Enchufla · Básico', 'Used by 2 other lessons', true],
			[setenta, 'Setenta · Básico', 'Only this lesson', false],
			[dile, 'Dile que no · Básico', 'Used by Week 4 loop', true]
		]);
		expect(p.goes).toBe('3 figures');
	});

	it('keeps what you practise, and what a routine it keeps uses', () => {
		const L = lesson('Week 3');
		const practised = figure(U1_SALSA, 'Setenta');
		addFigureExercise(db, 'u1', practised);
		const inLoop = figure(U1_SALSA, 'Enchufla');
		const onlyLoop = figure(U1_SALSA, 'Dile que no');
		// A routine only this lesson uses: its figures are this lesson's too.
		const own = routine('Week 3 loop', [onlyLoop]);
		db.update(exercises).set({ active: false }).where(eq(exercises.routineId, own)).run();
		// A routine Week 3 brings that another lesson also links: kept, so its figures are.
		const shared = routine('Shared loop', [inLoop]);
		db.update(exercises).set({ active: false }).where(eq(exercises.routineId, shared)).run();
		linkFigure(db, L, practised);
		linkRoutine(db, L, own);
		linkRoutine(db, L, shared);
		linkRoutine(db, lesson('Week 5'), shared);

		const why = Object.fromEntries(
			movePreview(db, U1_SALSA, L, 1)!.items.map((i) => [`${i.kind}:${i.id}`, i])
		);
		expect(why[`figure:${practised}`]).toMatchObject({
			why: 'You practise it',
			keepByDefault: true,
			practised: true
		});
		expect(why[`routine:${own}`]).toMatchObject({ why: 'Only this lesson', keepByDefault: false });
		expect(why[`figure:${onlyLoop}`]).toMatchObject({
			why: 'Only this lesson',
			keepByDefault: false
		});
		expect(why[`routine:${shared}`]).toMatchObject({ why: 'Used by 1 other lesson' });
		expect(why[`figure:${inLoop}`]).toMatchObject({
			why: 'Used by Shared loop',
			keepByDefault: true
		});
	});

	it('lists only what is yours, and is offered only where the lesson is not already', async () => {
		const L = lesson('Week 3');
		const groups = figure(T1_SALSA, 'Enchufla');
		linkFigure(db, L, figure(U1_SALSA, 'Setenta'));
		// Ana's lesson may link T1's figure she edits (ruling 2): it is T1's already.
		linkFigure(db, L, groups);
		expect(movePreview(db, U1_SALSA, L, 1)!.items.map((i) => i.label)).toEqual([
			'Setenta · Básico'
		]);
		expect(moveOffer(db, U1_SALSA, L)?.targets.map((t) => t.place)).toEqual([
			{ kind: 'team', teamId: 1, name: 'Salsa Tuesdays' }
		]);
		// Copied there already: Copy to… compares; Move is not offered.
		await cloneInto(db, { kind: 'lesson', id: L, into: T1_SALSA, recordings: true }, NO_FILES, T);
		expect(moveOffer(db, U1_SALSA, L)).toBeNull();
		expect(movePreview(db, U1_SALSA, L, 1)).toBeNull();
		// Never a group's lesson, never someone else's.
		const tl = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: null })
			.lesson.id;
		expect(moveOffer(db, U1_SALSA, tl)).toBeNull();
		expect(moveOffer(db, { userId: 'u2', dance: 'salsa' }, L)).toBeNull();
	});
});

describe('moving (moveLesson)', () => {
	it('with the defaults: a draft in T1, yours archived, Setenta dropped, the rest still yours', async () => {
		const { L, enchufla, setenta, dile, loop } = week3();
		const p = movePreview(db, U1_SALSA, L, 1)!;
		const res = await moveLesson(db, U1_SALSA, L, 1, defaults(p), {}, NO_FILES, NOW, ROOMY);
		if (!res.ok || !res.made) throw new Error('move refused');

		expect(db.select().from(lessons).where(eq(lessons.id, res.id)).get()).toMatchObject({
			teamId: 1,
			userId: null,
			publishedAt: null,
			title: 'Week 3'
		});
		expect(db.select().from(lessons).where(eq(lessons.id, L)).get()!.archivedAt).toBe(NOW);
		expect(fig(setenta).archivedAt).toBe(NOW);
		expect(fig(enchufla)).toMatchObject({ userId: 'u1', archivedAt: null });
		expect(fig(dile)).toMatchObject({ userId: 'u1', archivedAt: null });
		expect(optionsOf(loop)).toEqual([dile]);
		// The group's lesson links the group's copies.
		expect(linkedIn(res.id)).toEqual(
			[groupCopy(enchufla), groupCopy(setenta), groupCopy(dile)].sort((a, b) => a - b)
		);
		// Your archived lesson keeps what it linked: restoring it brings back yours.
		expect(linkedIn(L)).toEqual([enchufla, setenta, dile].sort((a, b) => a - b));

		// T1's History: the copy's adds (the lesson and the figures it brought), nothing else.
		const lines = db.select().from(teamChanges).where(eq(teamChanges.teamId, 1)).all();
		expect(lines.map((l) => [l.verb, l.rootKind]).sort()).toEqual([
			['add', 'figure'],
			['add', 'figure'],
			['add', 'figure'],
			['add', 'lesson']
		]);

		expect(crossRefs(db)).toEqual([]);
		const copy = db.select().from(lessons).where(eq(lessons.id, res.id)).get()!;
		expect(lessonAccess(db, 'u1', copy)).toBe('edit');
		expect(lessonAccess(db, 'u2', copy)).toBeNull();
		expect(figureAccess(db, 'u2', fig(groupCopy(setenta)))).toBeNull();
		expect(figureAccess(db, 'u1', fig(groupCopy(setenta)))).toBe('edit');
	});

	it('“Use the group’s” re-points your other lessons and routines; practice stays with yours', async () => {
		const { L, setenta } = week3();
		const other = routine('Saturday loop', [setenta]);
		const old = routine('Old loop', [setenta]);
		archiveRoutine(db, old, T);
		const week5 = lesson('Week 5');
		linkFigure(db, week5, setenta);
		const entry = addFigureExercise(db, 'u1', setenta)!;
		db.insert(sets).values({ exerciseId: entry.id, doneAt: T }).run();

		const p = movePreview(db, U1_SALSA, L, 1)!;
		const item = p.items.find((i) => i.id === setenta)!;
		expect(item).toMatchObject({ why: 'Used by 1 other lesson', keepByDefault: true });
		const choices = { ...defaults(p), [`figure:${setenta}`]: 'group' as const };
		const res = await moveLesson(db, U1_SALSA, L, 1, choices, {}, NO_FILES, NOW, ROOMY);
		if (!res.ok || !res.made) throw new Error('move refused');

		const theirs = groupCopy(setenta);
		expect(fig(setenta).archivedAt).toBe(NOW);
		expect(optionsOf(other)).toEqual([theirs]);
		expect(optionsOf(old)).toEqual([theirs]);
		expect(linkedIn(week5)).toEqual([theirs]);
		// Practice can't follow a draft: the entry stays on yours, archived with it, sets kept.
		const after = db.select().from(exercises).where(eq(exercises.id, entry.id)).get()!;
		expect(after).toMatchObject({ figureId: setenta, archivedAt: NOW });
		expect(db.select().from(sets).where(eq(sets.exerciseId, entry.id)).all()).toHaveLength(1);
		expect(
			db
				.select()
				.from(exercises)
				.where(and(eq(exercises.userId, 'u1'), eq(exercises.figureId, theirs)))
				.all()
		).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a routine and a drill used by the group: dropped, embeds and links re-pointed', async () => {
		const L = lesson('Week 3');
		const f = figure(U1_SALSA, 'Enchufla');
		const r = routine('Week 3 loop', [f]);
		const drill = db
			.insert(exercises)
			.values({ name: 'Spins', dance: 'salsa', source: 'custom', userId: 'u1' })
			.returning()
			.get().id;
		linkRoutine(db, L, r);
		linkExercise(db, L, drill);
		const parent = createRoutine(db, U1_SALSA, { name: 'Big loop', notes: null }).routine.id;
		const embed = db
			.insert(routineSteps)
			.values({ routineId: parent, position: 0, childRoutineId: r })
			.returning()
			.get().id;
		const week5 = lesson('Week 5');
		linkExercise(db, week5, drill);

		const p = movePreview(db, U1_SALSA, L, 1)!;
		const choices = Object.fromEntries(p.items.map((i) => [`${i.kind}:${i.id}`, 'group' as const]));
		const res = await moveLesson(db, U1_SALSA, L, 1, choices, {}, NO_FILES, NOW, ROOMY);
		if (!res.ok || !res.made) throw new Error('move refused');

		const theirR = memberIn(db, 'routine', geneOf(db, 'routine', r)!, T1_SALSA)!.id;
		const theirD = memberIn(db, 'drill', geneOf(db, 'drill', drill)!, T1_SALSA)!.id;
		expect(db.select().from(routineSteps).where(eq(routineSteps.id, embed)).get()!).toMatchObject({
			childRoutineId: theirR
		});
		expect(db.select().from(routines).where(eq(routines.id, r)).get()!.archivedAt).toBe(NOW);
		expect(db.select().from(exercises).where(eq(exercises.id, drill)).get()!.archivedAt).toBe(NOW);
		expect(fig(f).archivedAt).toBe(NOW);
		expect(
			db
				.select({ e: lessonExercises.exerciseId })
				.from(lessonExercises)
				.where(eq(lessonExercises.lessonId, week5))
				.all()
		).toEqual([{ e: theirD }]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('refuses a choice it did not offer, another group, or someone else, writing nothing', async () => {
		const { L, setenta } = week3();
		const before = db.select().from(lessons).all().length;
		const bad = { [`figure:${setenta + 100}`]: 'group' as const };
		expect(await moveLesson(db, U1_SALSA, L, 1, bad, {}, NO_FILES, NOW, ROOMY)).toEqual({
			ok: false,
			reason: 'denied'
		});
		expect(await moveLesson(db, U1_SALSA, L, 9, {}, {}, NO_FILES, NOW, ROOMY)).toMatchObject({
			ok: false
		});
		expect(
			await moveLesson(db, { userId: 'u2', dance: 'salsa' }, L, 1, {}, {}, NO_FILES, NOW, ROOMY)
		).toMatchObject({ ok: false });
		expect(db.select().from(lessons).all()).toHaveLength(before);
		expect(db.select().from(lessons).where(eq(lessons.id, L)).get()!.archivedAt).toBeNull();
	});
});
