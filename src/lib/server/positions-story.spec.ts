/**
 * The whole story of the positions spec, end to end through the data
 * functions: Pia builds a routine with no positions at all (no break, no gap);
 * adds the Salsa templates and tags two figures; as a co-teacher she copies
 * her Cerrada into Salsa Tuesdays, so the class's Cerrada is of her family;
 * Ana's class figure, tagged with the class's Cerrada and Setenta, comes in a
 * published lesson Pia adds; Pia's routine mixes her figures with the class's
 * (no break: positions compare by family); Make it mine on the class's
 * Setenta; and Pia leaves, keeping what her routine uses. After every step
 * every root row has one owner (`ownerIntegrity`), no parent holds two pieces
 * of one family (`familyIntegrity`) and no row points where its owner may not
 * (`crossRefs`). Files are fakes; the database is in memory.
 */
import { beforeEach, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { openDb, type Db } from './db';
import {
	figureEndPositions,
	figureStartPositions,
	figures,
	positions,
	routineStepOptions,
	routineSteps,
	users
} from './db/schema';
import { createTeam, joinTeam } from './teams';
import { leaveTeam, setRole } from './membership';
import { createFigure } from './figures';
import { canonicalOf, graphFor, setFigureShape } from './graph';
import { addTemplates, createPosition, listPositions } from './positions';
import { createLesson, linkFigure, publishLesson } from './lessons';
import { addLesson } from './entries';
import { addFigureSlot, createRoutine, routineShapes } from './routines';
import { positionAccess } from './access';
import { crossRefs, familyIntegrity, ownerIntegrity } from './integrity';
import { T1_SALSA, U2_SALSA } from './test-walls';
import type { PositionRow } from './db/schema';
import type { CloneFiles } from './clones/files';
import { geneOf } from './clones/genes';
import { copyTo } from './clones/copy-to';
import { makeMine } from './clones/edit';
import { breaks, loops } from '$lib/routines/routines';
import { deadEnds, follows, noPosition, orphans, taggedCount } from '$lib/graph/graph';

const DAY = 86_400_000;
/** Pia acting in Salsa Tuesdays, while she co-teaches it. */
const PIA_IN_CLASS = { ...T1_SALSA, actorId: 'u2' };
const T = Date.UTC(2026, 10, 4, 20);
const ROOMY = 1024 ** 4;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const tags = (startIds: number[], endIds: number[]) => ({
	startIds,
	endIds,
	startCount: 1,
	lengthCounts: 8
});

let db: Db;
const files: CloneFiles = { link: async (_k, file) => `copy-${file}`, unlink: async () => {} };

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Pia' }
		])
		.run();
});

/** One owner per root row, one member of a family per place, no reference out of reach. */
function whole(step: string) {
	expect(ownerIntegrity(db), step).toEqual([]);
	expect(familyIntegrity(db), step).toEqual([]);
	expect(crossRefs(db), step).toEqual([]);
}

const figure = (space: typeof U2_SALSA | typeof T1_SALSA, move: string, name: string) =>
	createFigure(db, space, { figureName: move, name, ...shape })!.figure.id;
const startsOf = (figureId: number) =>
	db
		.select({ id: figureStartPositions.positionId })
		.from(figureStartPositions)
		.where(eq(figureStartPositions.figureId, figureId))
		.all()
		.map((r) => r.id);
const endsOf = (figureId: number) =>
	db
		.select({ id: figureEndPositions.positionId })
		.from(figureEndPositions)
		.where(eq(figureEndPositions.figureId, figureId))
		.all()
		.map((r) => r.id);
const position = (id: number) => db.select().from(positions).where(eq(positions.id, id)).get()!;
/** The figures the routine's slots hold, in order. */
const slotsOf = (routineId: number) =>
	db
		.select({ figureId: routineStepOptions.figureId })
		.from(routineStepOptions)
		.innerJoin(routineSteps, eq(routineSteps.id, routineStepOptions.stepId))
		.where(eq(routineSteps.routineId, routineId))
		.orderBy(routineSteps.position)
		.all()
		.map((r) => r.figureId);
/** Pia's routine as the routine page reads it: her graph and its shape. */
function walk(routineId: number) {
	const g = graphFor(db, U2_SALSA);
	const s = routineShapes(db, U2_SALSA).get(routineId)!;
	return { g, breaks: breaks(g, s), loops: loops(g, s) };
}

it('Pia’s positions, from none at all through a class and back to her own', async () => {
	// 1. Pia has no positions. Her routine of two untagged figures has no
	// break and loops; her graph has no position, no gap and nothing tagged.
	expect(createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T)).toEqual({ ok: true, teamId: 1 });
	const A = figure(U2_SALSA, 'Dile que no', 'Básico');
	const B = figure(U2_SALSA, 'Vuelta', 'Derecha');
	const R = createRoutine(db, U2_SALSA, { name: 'Friday', notes: null }).routine.id;
	expect(addFigureSlot(db, R, A)).not.toBeNull();
	expect(addFigureSlot(db, R, B)).not.toBeNull();
	expect(listPositions(db, U2_SALSA)).toEqual([]);
	const bare = walk(R);
	expect(bare).toMatchObject({ breaks: [], loops: true });
	expect(bare.g.positions).toEqual([]);
	expect(taggedCount(bare.g)).toEqual({ done: 0, total: 2 });
	expect(noPosition(bare.g).none).toEqual([A, B]);
	whole('1. no positions, no break');

	// 2. She adds the Salsa templates: each with its type, its hold and its
	// description as notes. Adding them again adds nothing.
	const names = TEMPLATE_NAMES;
	const made = addTemplates(db, U2_SALSA, 'salsa', 'salsa', names, T);
	expect(made.map((p) => p.name)).toEqual(names);
	expect(addTemplates(db, U2_SALSA, 'salsa', 'salsa', names, T)).toEqual([]);
	const mine = (name: string) => made.find((p) => p.name === name)!.id;
	const cerrada = mine('Cerrada');
	const abierta = mine('Abierta (dos manos)');
	expect(position(cerrada)).toMatchObject({
		userId: 'u2',
		teamId: null,
		styleTag: 'salsa',
		hands: 'two',
		facing: 'face',
		frame: 'closed',
		notes: 'Closed, the basic frame'
	});
	whole('2. templates');

	// 3. She tags her two figures: Dile que no takes Cerrada to Abierta, the
	// Vuelta brings Abierta back to Cerrada. Still no break, still loops; a
	// figure that does not fit after itself shows the tags are read.
	expect(setFigureShape(db, A, tags([cerrada], [abierta]))).toBe(true);
	expect(setFigureShape(db, B, tags([abierta], [cerrada]))).toBe(true);
	const tagged = walk(R);
	expect(tagged).toMatchObject({ breaks: [], loops: true });
	expect(follows(tagged.g, A)).toEqual([B]);
	expect(taggedCount(tagged.g)).toEqual({ done: 2, total: 2 });
	expect(deadEnds(tagged.g, [cerrada, abierta])).toEqual([]);
	expect(orphans(tagged.g, [cerrada, abierta])).toEqual([]);
	whole('3. two figures tagged');

	// 4. Pia co-teaches Salsa Tuesdays for a week and copies her Cerrada into
	// it: the class's Cerrada is of her family. Ana adds the class's own
	// Setenta, a figure from Cerrada into Setenta, a lesson with it, and
	// publishes. Pia steps back to a member and adds the lesson.
	expect(joinTeam(db, 'u2', 1, T)).toBe('joined');
	expect(setRole(db, 1, 'u2', 'editor', T)).toBe(true);
	const copied = await copyTo(db, 'u2', 'position', cerrada, PIA_IN_CLASS, {}, files, T, ROOMY);
	if (!copied.ok) throw new Error(`copy refused: ${copied.reason}`);
	const theirCerrada = copied.id;
	expect(position(theirCerrada)).toMatchObject({
		userId: null,
		teamId: 1,
		name: 'Cerrada',
		clonedFrom: cerrada,
		hands: 'two',
		frame: 'closed'
	});
	expect(geneOf(db, 'position', theirCerrada)).toBe(geneOf(db, 'position', cerrada));
	const setenta = createPosition(
		db,
		T1_SALSA,
		{
			name: 'Setenta',
			styleTag: 'salsa',
			hold: { hands: 'one', crossed: true, facing: 'face', frame: 'open' },
			notes: 'Right hand behind her back.',
			pictureSpotId: null
		},
		T
	) as PositionRow;
	const F = figure(T1_SALSA, 'Enchufla', 'Doble');
	expect(setFigureShape(db, F, tags([theirCerrada], [setenta.id]), 'u1')).toBe(true);
	const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-04', title: 'Week 6', notes: null })
		.lesson.id;
	expect(linkFigure(db, L, F, 'u1')).toBe(true);
	expect(publishLesson(db, T1_SALSA, L, T)).toBe(true);
	expect(setRole(db, 1, 'u2', 'member', T + DAY)).toBe(true);
	expect(
		addLesson(db, 'u2', L, { lesson: false, routineIds: [], drillIds: [], figureIds: [F] }, T + DAY)
	).toBe(true);
	expect(positionAccess(db, 'u2', position(setenta.id))).toBe('read');
	whole('4. the class’s Cerrada, of Pia’s family, in a published lesson');

	// 5. Pia's routine mixes them: her Vuelta into the class's Enchufla (her
	// Cerrada and the class's are one family), and her own Setenta · Salida,
	// tagged with the class's Setenta she may use, back to her Cerrada. No
	// break, and it loops.
	const D = figure(U2_SALSA, 'Setenta', 'Salida');
	expect(setFigureShape(db, D, tags([setenta.id], [cerrada]))).toBe(true);
	expect(addFigureSlot(db, R, F)).not.toBeNull();
	expect(addFigureSlot(db, R, D)).not.toBeNull();
	expect(slotsOf(R)).toEqual([A, B, F, D]);
	const mixed = walk(R);
	expect(mixed).toMatchObject({ breaks: [], loops: true });
	expect(canonicalOf(mixed.g, theirCerrada)).toBe(cerrada);
	expect(follows(mixed.g, B)).toContain(F);
	expect(follows(mixed.g, F)).toEqual([D]);
	whole('5. Pia’s routine mixes her figures with the class’s');

	// 6. Make it mine on the class's Setenta: her copy, of its family, and her
	// Salida moves onto it; the class's figure keeps the class's. Make it mine
	// on the class's Cerrada lands on her own: she has one of its family.
	const own = await makeMine(db, U2_SALSA, 'position', setenta.id, files, T + 2 * DAY, ROOMY);
	if (!own.ok) throw new Error(`make it mine refused: ${own.reason}`);
	const mySetenta = own.id;
	expect(position(mySetenta)).toMatchObject({
		userId: 'u2',
		teamId: null,
		name: 'Setenta',
		clonedFrom: setenta.id,
		crossed: true,
		notes: 'Right hand behind her back.'
	});
	expect(geneOf(db, 'position', mySetenta)).toBe(geneOf(db, 'position', setenta.id));
	expect(startsOf(D)).toEqual([mySetenta]);
	expect(endsOf(F)).toEqual([setenta.id]);
	const back = await makeMine(db, U2_SALSA, 'position', theirCerrada, files, T + 2 * DAY, ROOMY);
	expect(back).toMatchObject({ ok: true, id: cerrada });
	expect(walk(R)).toMatchObject({ breaks: [], loops: true });
	whole('6. Make it mine');

	// 7. Pia leaves, keeping what her routine uses: the class's Enchufla is
	// copied into her app, tagged with her own members of each family (no new
	// position), and her routine moves onto the copy. Nothing of the class is
	// readable; still no break, still loops.
	const before = listPositions(db, U2_SALSA).map((p) => p.id);
	expect(await leaveTeam(db, 1, 'u2', { mode: 'used' }, files, T + 3 * DAY)).toBe('left');
	const kept = db
		.select()
		.from(figures)
		.where(
			and(
				eq(figures.userId, 'u2'),
				eq(figures.geneId, geneOf(db, 'figure', F)!),
				isNull(figures.archivedAt)
			)
		)
		.all();
	expect(kept).toHaveLength(1);
	const Fmine = kept[0].id;
	expect(slotsOf(R)).toEqual([A, B, Fmine, D]);
	expect(startsOf(Fmine)).toEqual([cerrada]);
	expect(endsOf(Fmine)).toEqual([mySetenta]);
	expect(listPositions(db, U2_SALSA).map((p) => p.id)).toEqual(before);
	expect(positionAccess(db, 'u2', position(theirCerrada))).toBeNull();
	expect(positionAccess(db, 'u2', position(setenta.id))).toBeNull();
	const left = walk(R);
	expect(left).toMatchObject({ breaks: [], loops: true });
	expect(left.g.positions.map((p) => p.id).sort((a, b) => a - b)).toEqual(
		[...before].sort((a, b) => a - b)
	);
	whole('7. Pia left with what her routine uses');
});

const TEMPLATE_NAMES = [
	'Abierta (dos manos)',
	'Abierta (una mano)',
	'Cerrada',
	'Hammerlock',
	'Cuddle',
	'Sombra'
];
