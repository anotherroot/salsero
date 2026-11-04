/**
 * Positions through every clone flow (Task 11): Make it mine, Drop my copy,
 * Detach, Copy to…, the rescue, Keep and `repoint` itself. A person's own
 * rows that point at a position are their figures' start and end tags, their
 * lessons' hand links and the links on their own sections and points; each
 * flow moves exactly those, and `crossRefs` stays `[]`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import {
	figureEndPositions,
	figureStartPositions,
	lessonPositions,
	positions,
	spotPositionLinks,
	teamChanges,
	twins,
	users
} from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { addRecording, createFigure } from '../figures';
import { createLesson, linkFigure, linkPosition, publishLesson } from '../lessons';
import { addLesson } from '../entries';
import { addSpot } from '../spots';
import { linkPositionInSpace } from '../position-links';
import { archivePosition, createPosition } from '../positions';
import { leaveTeam } from '../membership';
import { usablePositions } from '../usable';
import { crossRefs } from '../integrity';
import { setFigureShape } from '../graph';
import type { Space } from '../scope';
import { T1_SALSA, U2_SALSA } from '../test-walls';
import type { PositionRow } from '../db/schema';
import type { CloneFiles } from './files';
import { geneOf } from './genes';
import { makeMine, makeMinePreview } from './edit';
import { dropCopy, dropOptions } from './drop';
import { detach } from './detach';
import { copyPlan, copyTo, restoreMember } from './copy-to';
import { keepPreview } from './keep';
import { repoint, repointPreview } from './repoint';

const T = Date.UTC(2026, 10, 4, 20);
const NOW = T + 1000;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const files: CloneFiles = { link: async (_k, file) => `copy-${file}`, unlink: async () => {} };
const NONE = { lesson: true, routineIds: [], drillIds: [], figureIds: [] };

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

const figure = (space: Space, move: string, name: string) =>
	createFigure(db, space, { figureName: move, name, ...shape })!.figure.id;
const position = (space: Space, name: string) =>
	(
		createPosition(
			db,
			space,
			{
				name,
				styleTag: 'salsa',
				hold: { hands: 'one', crossed: true, facing: 'face', frame: 'open' },
				notes: 'Right hand behind her back.',
				pictureSpotId: null
			},
			T
		) as PositionRow
	).id;
const tag = (figureId: number, side: 'start' | 'end', positionId: number) =>
	db
		.insert(side === 'start' ? figureStartPositions : figureEndPositions)
		.values({ figureId, positionId })
		.run();
const startsOf = (figureId: number) =>
	db
		.select({ id: figureStartPositions.positionId })
		.from(figureStartPositions)
		.where(eq(figureStartPositions.figureId, figureId))
		.all()
		.map((r) => r.id)
		.sort((a, b) => a - b);
const endsOf = (figureId: number) =>
	db
		.select({ id: figureEndPositions.positionId })
		.from(figureEndPositions)
		.where(eq(figureEndPositions.figureId, figureId))
		.all()
		.map((r) => r.id)
		.sort((a, b) => a - b);
const handLinksOf = (lessonId: number) =>
	db
		.select({ id: lessonPositions.positionId })
		.from(lessonPositions)
		.where(eq(lessonPositions.lessonId, lessonId))
		.all()
		.map((r) => r.id);
const spotLinksOf = (spotId: number) =>
	db
		.select({ id: spotPositionLinks.positionId })
		.from(spotPositionLinks)
		.where(eq(spotPositionLinks.spotId, spotId))
		.all()
		.map((r) => r.id);
const row = (id: number) => db.select().from(positions).where(eq(positions.id, id)).get()!;
const u2Positions = () =>
	db
		.select()
		.from(positions)
		.where(eq(positions.userId, 'u2'))
		.all()
		.sort((a, b) => a.id - b.id);

/**
 * Salsa Tuesdays' position Setenta (P) and figure Enchufla · Doble (F)
 * starting in it, in a published lesson L that u2 added. u2's own rows use
 * P: their figure Setenta · Con giro (G) starts in it, Vuelta · Simple (G2)
 * ends in it, their lesson Mi clase (L2) links it by hand, and a section on
 * G's recording links it.
 */
function story() {
	const P = position(T1_SALSA, 'Setenta');
	const F = figure(T1_SALSA, 'Enchufla', 'Doble');
	tag(F, 'start', P);
	const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'Week 6', notes: null })
		.lesson.id;
	linkFigure(db, L, F, 'u1');
	publishLesson(db, T1_SALSA, L, T);
	addLesson(db, 'u2', L, NONE, T);

	const G = figure(U2_SALSA, 'Setenta', 'Con giro');
	tag(G, 'start', P);
	const G2 = figure(U2_SALSA, 'Vuelta', 'Simple');
	tag(G2, 'end', P);
	const L2 = createLesson(db, U2_SALSA, { lessonDay: '2026-11-02', title: 'Mi clase', notes: null })
		.lesson.id;
	expect(linkPosition(db, L2, P)).toBe(true);
	const rec = addRecording(
		db,
		{ figureId: G, file: 'g.mp4', mime: 'video/mp4', kind: 'video', sizeBytes: 10, note: null },
		'u2'
	).id;
	const spot = addSpot(db, { recordingId: rec }, { startMs: 0, endMs: 1000, label: 'Hold' })!.id;
	linkPositionInSpace(db, U2_SALSA, spot, P, T);
	expect(crossRefs(db)).toEqual([]);
	return { P, F, L, G, G2, L2, spot };
}

describe('repoint: positions', () => {
	it('moves the person’s own tags, hand links and section links; the group’s stay', () => {
		const { P, F, G, G2, L2, spot } = story();
		const C = position(U2_SALSA, 'Mi setenta');
		const preview = repointPreview(db, 'u2', 'salsa', 'position', P);
		expect(preview.figures).toEqual([
			{ id: G, label: 'Setenta · Con giro' },
			{ id: G2, label: 'Vuelta · Simple' }
		]);
		expect(preview.lessons).toEqual([{ id: L2, title: 'Mi clase' }]);
		expect(preview.sections).toBe(1);

		const report = db.transaction((tx) =>
			repoint(tx as unknown as Db, 'u2', 'salsa', 'position', P, C, { entries: true }, NOW)
		);
		expect(report).toEqual(preview);
		expect(startsOf(G)).toEqual([C]);
		expect(endsOf(G2)).toEqual([C]);
		expect(handLinksOf(L2)).toEqual([C]);
		expect(spotLinksOf(spot)).toEqual([C]);
		expect(startsOf(F)).toEqual([P]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('merges a tag or link already on the target', () => {
		const { P, G, L2, spot } = story();
		const C = position(U2_SALSA, 'Mi setenta');
		tag(G, 'start', C);
		db.insert(lessonPositions).values({ lessonId: L2, positionId: C }).run();
		db.insert(spotPositionLinks).values({ spotId: spot, positionId: C }).run();
		db.transaction((tx) =>
			repoint(tx as unknown as Db, 'u2', 'salsa', 'position', P, C, { entries: true }, NOW)
		);
		expect(startsOf(G)).toEqual([C]);
		expect(handLinksOf(L2)).toEqual([C]);
		expect(spotLinksOf(spot)).toEqual([C]);
	});

	it('never touches another person’s rows', () => {
		const { P, F } = story();
		const C = position(T1_SALSA, 'Otra');
		db.transaction((tx) =>
			repoint(tx as unknown as Db, 'u1', 'salsa', 'position', P, C, { entries: true }, NOW)
		);
		// u1's own space has no rows on P; the group's F and u2's rows stay.
		expect(startsOf(F)).toEqual([P]);
		expect(crossRefs(db)).toEqual([]);
	});
});

describe('Make it mine on a group position', () => {
	it('the preview lists the figures, the lesson and the section that switch', () => {
		const { P, L2 } = story();
		const p = makeMinePreview(db, U2_SALSA, 'position', P)!;
		expect(p.title).toBe('Setenta');
		expect(p.repoint.figures.map((f) => f.label)).toEqual([
			'Setenta · Con giro',
			'Vuelta · Simple'
		]);
		expect(p.repoint.lessons).toEqual([{ id: L2, title: 'Mi clase' }]);
		expect(p.repoint.sections).toBe(1);
		expect(p.practised).toBe(false);
		expect(p.existing).toBeNull();
	});

	it('copies it with gene and cloned_from; their tags and links move; the group’s stays', async () => {
		const { P, F, G, G2, L2, spot } = story();
		const res = await makeMine(db, U2_SALSA, 'position', P, files, NOW, Infinity);
		expect(res).toMatchObject({ ok: true, made: true });
		const C = (res as { id: number }).id;
		expect(row(C)).toMatchObject({
			userId: 'u2',
			teamId: null,
			name: 'Setenta',
			styleTag: 'salsa',
			hands: 'one',
			crossed: true,
			facing: 'face',
			frame: 'open',
			notes: 'Right hand behind her back.',
			geneId: geneOf(db, 'position', P),
			clonedFrom: P,
			archivedAt: null
		});
		expect(geneOf(db, 'position', P)).not.toBeNull();
		expect(startsOf(G)).toEqual([C]);
		expect(endsOf(G2)).toEqual([C]);
		expect(handLinksOf(L2)).toEqual([C]);
		expect(spotLinksOf(spot)).toEqual([C]);
		expect(startsOf(F)).toEqual([P]);
		expect(row(P).archivedAt).toBeNull();
		// Their copy hides the group's in what they may use.
		expect(usablePositions(db, U2_SALSA).map((p) => p.id)).not.toContain(P);
		expect(usablePositions(db, U2_SALSA, undefined, 'keep').map((p) => p.id)).toContain(P);
		expect(crossRefs(db)).toEqual([]);
	});

	it('brings back their archived copy', async () => {
		const { P, G } = story();
		const first = await makeMine(db, U2_SALSA, 'position', P, files, NOW, Infinity);
		const C = (first as { id: number }).id;
		db.update(positions).set({ archivedAt: NOW }).where(eq(positions.id, C)).run();
		db.update(figureStartPositions)
			.set({ positionId: P })
			.where(eq(figureStartPositions.figureId, G))
			.run();
		expect(makeMinePreview(db, U2_SALSA, 'position', P)!.existing).toEqual({
			id: C,
			archived: true
		});
		const again = await makeMine(db, U2_SALSA, 'position', P, files, NOW + 1, Infinity);
		expect(again).toMatchObject({ ok: true, id: C, archived: true });
		expect(row(C).archivedAt).toBeNull();
		expect(startsOf(G)).toEqual([C]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('an editor gets no Make it mine', () => {
		const { P } = story();
		expect(makeMinePreview(db, { userId: 'u1', dance: 'salsa' }, 'position', P)).toBeNull();
	});
});

describe('Drop my copy of a position', () => {
	it('brings the tags and links back to the group’s and archives the copy', async () => {
		const { P, G, G2, L2, spot } = story();
		const C = (
			(await makeMine(db, U2_SALSA, 'position', P, files, NOW, Infinity)) as { id: number }
		).id;
		const opts = dropOptions(db, U2_SALSA, 'position', C)!;
		expect(opts.choices.map((c) => c.id)).toEqual([P]);
		expect(opts.choices[0]).toMatchObject({ practiceFollows: true, addLesson: null });
		expect(dropCopy(db, U2_SALSA, 'position', C, P, {}, NOW + 1)).toEqual({ ok: true, toId: P });
		expect(startsOf(G)).toEqual([P]);
		expect(endsOf(G2)).toEqual([P]);
		expect(handLinksOf(L2)).toEqual([P]);
		expect(spotLinksOf(spot)).toEqual([P]);
		expect(row(C).archivedAt).toBe(NOW + 1);
		expect(crossRefs(db)).toEqual([]);
	});
});

describe('Detach a position', () => {
	it('leaves the family and becomes a twin of the group’s', async () => {
		const { P } = story();
		const C = (
			(await makeMine(db, U2_SALSA, 'position', P, files, NOW, Infinity)) as { id: number }
		).id;
		expect(detach(db, 'u2', 'position', C, NOW + 1)).toBe(true);
		expect(row(C)).toMatchObject({ geneId: null, clonedFrom: null });
		const set = db
			.select({ item: twins.itemId })
			.from(twins)
			.where(and(eq(twins.userId, 'u2'), eq(twins.kind, 'position')))
			.all()
			.map((r) => r.item)
			.sort((a, b) => a - b);
		expect(set).toEqual([P, C].sort((a, b) => a - b));
		expect(crossRefs(db)).toEqual([]);
	});
});

describe('Copy to… a group', () => {
	it('copies the position into another group, logged; a copy there is reused', async () => {
		const { P } = story();
		createTeam(db, 'u1', 'salsa', 'Rueda club', T);
		const T2 = { dance: 'salsa' as const, teamId: 2, actorId: 'u1' };
		expect(copyPlan(db, 'u1', 'position', P, T2).goes).toBe('Notes');
		const res = await copyTo(db, 'u1', 'position', P, T2, {}, files, NOW, Infinity);
		expect(res).toMatchObject({ ok: true, made: true });
		const C = (res as { id: number }).id;
		expect(row(C)).toMatchObject({
			teamId: 2,
			userId: null,
			name: 'Setenta',
			crossed: true,
			geneId: geneOf(db, 'position', P),
			clonedFrom: P
		});
		expect(
			db
				.select()
				.from(teamChanges)
				.where(and(eq(teamChanges.teamId, 2), eq(teamChanges.rootKind, 'position')))
				.all()
				.map((c) => c.verb)
		).toEqual(['add']);
		expect(await copyTo(db, 'u1', 'position', P, T2, {}, files, NOW, Infinity)).toMatchObject({
			ok: true,
			made: false,
			id: C
		});
		expect(crossRefs(db)).toEqual([]);
	});

	it('what goes counts the positions a figure brings', () => {
		const { F } = story();
		createTeam(db, 'u1', 'salsa', 'Rueda club', T);
		const T2 = { dance: 'salsa' as const, teamId: 2, actorId: 'u1' };
		tag(F, 'end', position(T1_SALSA, 'Cerrada'));
		expect(copyPlan(db, 'u1', 'figure', F, T2).goes).toBe('2 positions');
	});

	it('restores the person’s archived copy in their own app', async () => {
		const { P } = story();
		const C = (
			(await makeMine(db, U2_SALSA, 'position', P, files, NOW, Infinity)) as { id: number }
		).id;
		db.update(positions).set({ archivedAt: NOW }).where(eq(positions.id, C)).run();
		expect(restoreMember(db, 'u2', 'position', P, U2_SALSA, C, NOW + 1)).toEqual({ ok: true });
		expect(row(C).archivedAt).toBeNull();
	});

	it('restoring a copy whose name was taken since says so', async () => {
		const { P } = story();
		const C = (
			(await makeMine(db, U2_SALSA, 'position', P, files, NOW, Infinity)) as { id: number }
		).id;
		db.update(positions).set({ archivedAt: NOW }).where(eq(positions.id, C)).run();
		position(U2_SALSA, 'Setenta');
		expect(restoreMember(db, 'u2', 'position', P, U2_SALSA, C, NOW + 1)).toEqual({
			ok: false,
			message: 'You already have a position called Setenta.'
		});
		expect(row(C).archivedAt).toBe(NOW);
	});
});

describe('the rescue', () => {
	it('an editor archives a group position a member’s figure uses: they get a copy', () => {
		const { P, F, G, G2, L2, spot } = story();
		expect(archivePosition(db, P, NOW, { actorId: 'u1' })).toBe(true);
		const mine = u2Positions();
		expect(mine).toHaveLength(1);
		const C = mine[0].id;
		expect(mine[0]).toMatchObject({
			name: 'Setenta',
			crossed: true,
			archivedAt: null,
			geneId: geneOf(db, 'position', P),
			clonedFrom: P
		});
		expect(startsOf(G)).toEqual([C]);
		expect(endsOf(G2)).toEqual([C]);
		expect(handLinksOf(L2)).toEqual([C]);
		expect(spotLinksOf(spot)).toEqual([C]);
		// The group's own figure keeps its (archived) tag.
		expect(startsOf(F)).toEqual([P]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('an editor takes the tag off the group’s figure: the position leaves reach, and is rescued', () => {
		const { P, F, G } = story();
		expect(
			setFigureShape(db, F, { startIds: [], endIds: [], startCount: 1, lengthCounts: 8 }, 'u1')
		).toBe(true);
		const mine = u2Positions();
		expect(mine).toHaveLength(1);
		expect(mine[0]).toMatchObject({ name: 'Setenta', clonedFrom: P });
		expect(startsOf(G)).toEqual([mine[0].id]);
		expect(startsOf(F)).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a position the member still reads is left alone', () => {
		const { P, G } = story();
		const other = position(T1_SALSA, 'Cerrada');
		expect(archivePosition(db, other, NOW, { actorId: 'u1' })).toBe(true);
		expect(u2Positions()).toEqual([]);
		expect(startsOf(G)).toEqual([P]);
		expect(crossRefs(db)).toEqual([]);
	});
});

describe('Keep, on leaving', () => {
	it('the preview lists the position with what of theirs uses it', () => {
		const { P } = story();
		const p = keepPreview(db, 'u2', 1);
		expect(p.positions).toEqual([
			expect.objectContaining({
				kind: 'position',
				id: P,
				name: 'Setenta',
				used: 'Mi clase',
				usedBy: 'lesson'
			})
		]);
		expect(p.usedNames).toContain('Setenta');
	});

	it('Keep only what my routines use: their figures’ tags move onto their copy', async () => {
		const { P, G, G2, L2, spot } = story();
		expect(await leaveTeam(db, 1, 'u2', { mode: 'used' }, files, NOW)).toBe('left');
		const mine = u2Positions();
		expect(mine).toHaveLength(1);
		const C = mine[0].id;
		expect(mine[0]).toMatchObject({ name: 'Setenta', clonedFrom: P, hands: 'one' });
		expect(startsOf(G)).toEqual([C]);
		expect(endsOf(G2)).toEqual([C]);
		expect(handLinksOf(L2)).toEqual([C]);
		expect(spotLinksOf(spot)).toEqual([C]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('Keep everything: the kept figure and their own figures share one copy', async () => {
		const { P, G } = story();
		expect(await leaveTeam(db, 1, 'u2', { mode: 'all' }, files, NOW)).toBe('left');
		const mine = u2Positions();
		expect(mine).toHaveLength(1);
		const C = mine[0].id;
		expect(startsOf(G)).toEqual([C]);
		const keptF = db
			.select({ figureId: figureStartPositions.figureId })
			.from(figureStartPositions)
			.where(eq(figureStartPositions.positionId, C))
			.all()
			.map((r) => r.figureId)
			.filter((id) => id !== G);
		expect(keptF).toHaveLength(1);
		expect(crossRefs(db)).toEqual([]);
		expect(row(P).archivedAt).toBeNull();
	});
});
