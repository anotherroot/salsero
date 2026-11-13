import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import {
	exercises,
	figureGroups,
	figures,
	figureEndPositions,
	figureStartPositions,
	lessonExercises,
	lessonPositions,
	lessons,
	lessonVideos,
	links,
	positions,
	recordings,
	routines,
	routineStepOptions,
	routineSteps,
	songs,
	spotLinks,
	spotPositionLinks,
	teamChanges,
	teamMembers,
	users,
	videoSpots
} from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import {
	addRecording,
	createFigure,
	createVariationIn,
	deleteRecording,
	listFigures,
	updateVariation
} from '../figures';
import { fromTags, shownName } from '$lib/clones/from-tag';
import { createCustomExercise } from '../exercises';
import {
	addLessonVideo,
	createLesson,
	linkExercise,
	linkFigure,
	linkPosition,
	linkRoutine,
	publishLesson
} from '../lessons';
import {
	addChildSlot,
	addFigureSlot,
	addOption,
	createRoutine,
	insertSlot,
	setSlotEnd,
	routineSlots,
	insertRoutine
} from '../routines';
import { addLesson } from '../entries';
import { addLinks } from '../links';
import { addSpot } from '../spots';
import { linkInSpace } from '../spot-links';
import { createSongFromUpload, createSongFromUrl } from '../songs';
import { insertFixturePositions } from '../test-positions';
import { setTeamLimit, usedBytesOf } from '../storage';
import { purgeTrash } from '../trash';
import { ownerValues, type Space, type Wall } from '../scope';
import { figurePositions } from '../graph';
import { crossRefs, familyIntegrity } from '../integrity';
import { linkPositionInSpace } from '../position-links';
import { T1_SALSA, T2_SALSA, U1_SALSA, U2_SALSA } from '../test-walls';
import { TRASH_MS } from '$lib/limits';
import { copiedFromPlaces, geneOf, memberIn } from './genes';
import { hashValue, pairBase } from './pairs';
import { defaultPicks, diff } from '$lib/clones/diff';
import { flatOf } from './trees';
import { cloneInto, planClone, type CloneRequest } from './clone';
import { cloneFilesIn, type CloneFileKind, type CloneFiles } from './files';
import { makeMine } from './edit';

const T = Date.UTC(2026, 10, 3, 20);
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const U3_SALSA: Wall = { userId: 'u3', dance: 'salsa' };

let db: Db;

/** A fake `CloneFiles`: a new name is `copy-<file>`, and every call is recorded. */
function fakeFiles(name = (file: string) => `copy-${file}`) {
	const linked: [CloneFileKind, string][] = [];
	const unlinked: [CloneFileKind, string][] = [];
	const files: CloneFiles = {
		async link(kind, file) {
			linked.push([kind, file]);
			return name(file);
		},
		async unlink(kind, file) {
			unlinked.push([kind, file]);
		}
	};
	return { files, linked, unlinked };
}

beforeEach(() => {
	db = openDb(':memory:');
	insertFixturePositions(db);
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana', lastName: 'Kranjc' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' },
			{ id: 'u3', email: 'u3@x.si', passwordHash: 'x', firstName: 'Maja' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
});

function figure(space: Space, move: string, name: string) {
	return createFigure(db, space, { figureName: move, name, ...shape })!;
}

function recording(figureId: number, file: string, sizeBytes = 50, by = 'u1') {
	return addRecording(
		db,
		{ figureId, file, mime: 'video/mp4', kind: 'video', sizeBytes, note: `note ${file}` },
		by
	).id;
}

/** A group figure "Enchufla · Doble" with a shape, a link and one recording, published to members. */
function groupFigure() {
	const made = figure(T1_SALSA, 'Enchufla', 'Doble');
	const id = made.figure.id;
	// The group's own positions: a group's figure is tagged only with them (ruling 15).
	insertFixturePositions(db, { teamId: 1 });
	const [open, closed] = db
		.select()
		.from(positions)
		.where(and(eq(positions.dance, 'salsa'), eq(positions.teamId, 1)))
		.all();
	db.update(figures)
		.set({ notes: 'Lead early', startCount: 3, lengthCounts: 16 })
		.where(eq(figures.id, id))
		.run();
	db.insert(figureStartPositions).values({ figureId: id, positionId: open.id }).run();
	db.insert(figureEndPositions).values({ figureId: id, positionId: closed.id }).run();
	addLinks(db, { figureId: id }, ['https://example.org/doble'], 'Doble', 'u1');
	const rec = recording(id, 'g.mp4');
	const lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: null })
		.lesson.id;
	linkFigure(db, lesson, id, 'u1');
	publishLesson(db, T1_SALSA, lesson, T);
	return { id, rec, move: made.group.id };
}

const figureRow = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;
const moveName = (id: number) =>
	db
		.select()
		.from(figureGroups)
		.where(eq(figureGroups.id, figureRow(id).groupId!))
		.get()!.name;
const recsOf = (figureId: number) =>
	db.select().from(recordings).where(eq(recordings.figureId, figureId)).all();
const without = (flat: ReturnType<typeof flatOf>, prefix: string) =>
	Object.fromEntries(Object.entries(flat).filter(([k]) => !k.startsWith(prefix)));

describe('cloneInto: figures', () => {
	it('a group figure into my app: same move by name, no recordings, family stamped', async () => {
		const src = groupFigure();
		const f = fakeFiles();
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: src.id, into: U2_SALSA, recordings: false },
			f.files,
			T
		);
		expect(r).toMatchObject({ ok: true, made: true, archived: false });
		if (!r.ok) return;
		const clone = figureRow(r.id);
		expect(clone).toMatchObject({ userId: 'u2', teamId: null, dance: 'salsa', name: 'Doble' });
		expect(moveName(r.id)).toBe('Enchufla');
		expect(
			db.select().from(figureGroups).where(eq(figureGroups.id, clone.groupId!)).get()
		).toMatchObject({ userId: 'u2', teamId: null });
		expect(recsOf(r.id)).toEqual([]);
		expect(geneOf(db, 'figure', src.id)).not.toBeNull();
		expect(geneOf(db, 'figure', r.id)).toBe(geneOf(db, 'figure', src.id));
		expect(clone.clonedFrom).toBe(src.id);
		const recGene = geneOf(db, 'recording', src.rec);
		expect(recGene).not.toBeNull();
		expect(pairBase(db, 'figure', src.id, r.id)!.skip).toEqual([`rec:${recGene}`]);
		expect(f.linked).toEqual([]);
		// Everything but the recording reads the same: notes, partner, style, timing, positions, links.
		expect(without(flatOf(db, 'figure', r.id), 'rec:')).toEqual(
			without(flatOf(db, 'figure', src.id), 'rec:')
		);
		// No exercise: practice is opt-in.
		expect(db.select().from(exercises).where(eq(exercises.figureId, r.id)).all()).toEqual([]);
	});

	it('a figure copy keeps its start set and You choose (spec 2026-11-11)', async () => {
		const src = groupFigure();
		db.update(figures).set({ startCounts: 17, lengthFree: 1 }).where(eq(figures.id, src.id)).run();
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: src.id, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!r.ok) throw new Error('expected a clone');
		expect(figureRow(r.id)).toMatchObject({ startCounts: 17, lengthFree: 1 });
		// The flat timing carries both, so Keep in step sees a later change.
		expect(flatOf(db, 'figure', r.id).timing).toEqual(flatOf(db, 'figure', src.id).timing);
		db.update(figures).set({ startCounts: null }).where(eq(figures.id, src.id)).run();
		expect(flatOf(db, 'figure', r.id).timing).not.toEqual(flatOf(db, 'figure', src.id).timing);
	});

	it('files under my live move of that name, any case', async () => {
		const src = groupFigure();
		const mine = figure(U2_SALSA, ' enchufla ', 'Basic');
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: src.id, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		expect(r.ok && figureRow(r.id).groupId).toBe(mine.group.id);
	});

	it('an archived move of the name is not revived', async () => {
		const src = groupFigure();
		const mine = figure(U2_SALSA, 'Enchufla', 'Basic');
		db.update(figureGroups).set({ archivedAt: T }).where(eq(figureGroups.id, mine.group.id)).run();
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: src.id, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(figureRow(r.id).groupId).not.toBe(mine.group.id);
		expect(moveName(r.id)).toBe('Enchufla');
	});

	it('copying again reuses the member', async () => {
		const src = groupFigure();
		const req: CloneRequest = { kind: 'figure', id: src.id, into: U2_SALSA, recordings: false };
		const first = await cloneInto(db, req, fakeFiles().files, T);
		if (!first.ok) throw new Error('expected a clone');
		const again = await cloneInto(db, req, fakeFiles().files, T);
		expect(again).toEqual({ ok: true, id: first.id, made: false, archived: false });
		expect(planClone(db, req).existing).toEqual({ id: first.id, archived: false });

		db.update(figures).set({ archivedAt: T }).where(eq(figures.id, first.id)).run();
		expect(await cloneInto(db, req, fakeFiles().files, T)).toEqual({
			ok: true,
			id: first.id,
			made: false,
			archived: true
		});
		// From the clone back to its source's place: the source is the member there.
		const back = await cloneInto(
			db,
			{ kind: 'figure', id: src.id, into: T1_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		expect(back).toEqual({ ok: true, id: src.id, made: false, archived: false });
	});

	it('into a group: recordings come, charged to the group', async () => {
		const own = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		recording(own, 'a.mp4', 100);
		recording(own, 'b.mp4', 200);
		const teamBefore = usedBytesOf(db, { teamId: 1 });
		const mineBefore = usedBytesOf(db, { userId: 'u1' });
		const changesBefore = db.select().from(teamChanges).all().length;
		const f = fakeFiles();
		const req: CloneRequest = { kind: 'figure', id: own, into: T1_SALSA, recordings: true };
		expect(planClone(db, req)).toMatchObject({ bytes: 300, existing: null });

		const r = await cloneInto(db, req, f.files, T);
		if (!r.ok) throw new Error('expected a clone');
		expect(f.linked).toEqual([
			['recording', 'a.mp4'],
			['recording', 'b.mp4']
		]);
		expect(f.unlinked).toEqual([]);
		const recs = recsOf(r.id);
		expect(recs.map((x) => [x.file, x.sizeBytes, x.note])).toEqual([
			['copy-a.mp4', 100, 'note a.mp4'],
			['copy-b.mp4', 200, 'note b.mp4']
		]);
		const srcRecs = recsOf(own);
		expect(recs.map((x) => x.geneId)).toEqual(srcRecs.map((x) => x.geneId));
		expect(recs.map((x) => x.clonedFrom)).toEqual(srcRecs.map((x) => x.id));
		expect(usedBytesOf(db, { teamId: 1 })).toBe(teamBefore + 300);
		expect(usedBytesOf(db, { userId: 'u1' })).toBe(mineBefore);
		const added = db.select().from(teamChanges).all().slice(changesBefore);
		expect(added).toHaveLength(1);
		expect(added[0]).toMatchObject({
			teamId: 1,
			rootKind: 'figure',
			rootId: figureRow(r.id).groupId,
			verb: 'add',
			actorId: 'u1'
		});
		expect(pairBase(db, 'figure', own, r.id)!.skip).toEqual([]);
		expect(flatOf(db, 'figure', r.id)).toEqual(flatOf(db, 'figure', own));
	});

	it('logs a variation when the group already has the move', async () => {
		figure(T1_SALSA, 'Enchufla', 'Basic');
		const own = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		const before = db.select().from(teamChanges).all().length;
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: own, into: T1_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!r.ok) throw new Error('expected a clone');
		const added = db.select().from(teamChanges).all().slice(before);
		expect(added).toHaveLength(1);
		expect(added[0]).toMatchObject({ verb: 'add', subject: 'variation', subjectId: r.id });
	});

	it('sections come with their recording; a link maps to the place’s member or is dropped', async () => {
		const own = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		const rec = recording(own, 'a.mp4', 100);
		const turn = addSpot(db, { recordingId: rec }, { startMs: 0, endMs: 5000, label: 'Turn' })!;
		const spin = addSpot(db, { recordingId: rec }, { startMs: 6000, endMs: 9000, label: 'Spin' })!;
		addSpot(db, { recordingId: rec }, { startMs: 9500, endMs: null, label: null });
		const kept = createCustomExercise(db, U1_SALSA, { name: 'Shines', everyDays: 3, notes: null });
		const lost = createCustomExercise(db, U1_SALSA, { name: 'Turns', everyDays: 3, notes: null });
		linkInSpace(db, U1_SALSA, turn.id, { figureId: own });
		linkInSpace(db, U1_SALSA, turn.id, { exerciseId: kept.id });
		linkInSpace(db, U1_SALSA, spin.id, { exerciseId: lost.id });
		// Archived after linking: no longer live, so it is not cloned and the link drops.
		db.update(exercises).set({ archivedAt: T }).where(eq(exercises.id, lost.id)).run();
		const keptInGroup = await cloneInto(
			db,
			{ kind: 'drill', id: kept.id, into: T1_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!keptInGroup.ok) throw new Error('expected a clone');

		const r = await cloneInto(
			db,
			{ kind: 'figure', id: own, into: T1_SALSA, recordings: true },
			fakeFiles().files,
			T
		);
		if (!r.ok) throw new Error('expected a clone');
		const [copyRec] = recsOf(r.id);
		const spots = db.select().from(videoSpots).where(eq(videoSpots.recordingId, copyRec.id)).all();
		expect(spots.map((s) => [s.startMs, s.endMs, s.label])).toEqual([
			[0, 5000, 'Turn'],
			[6000, 9000, 'Spin'],
			[9500, null, null]
		]);
		const srcSpots = db.select().from(videoSpots).where(eq(videoSpots.recordingId, rec)).all();
		expect(spots.map((s) => s.geneId)).toEqual(srcSpots.map((s) => s.geneId));
		expect(spots.map((s) => s.clonedFrom)).toEqual(srcSpots.map((s) => s.id));
		const linksOf = (spotId: number) =>
			db
				.select({ figureId: spotLinks.figureId, exerciseId: spotLinks.exerciseId })
				.from(spotLinks)
				.where(eq(spotLinks.spotId, spotId))
				.all();
		expect(linksOf(spots[0].id)).toEqual(
			expect.arrayContaining([
				{ figureId: r.id, exerciseId: null },
				{ figureId: null, exerciseId: keptInGroup.id }
			])
		);
		expect(linksOf(spots[0].id)).toHaveLength(2);
		expect(linksOf(spots[1].id)).toEqual([]);

		// The dropped link is not the copy's own change: the source holds it, and
		// a Send keeps it there.
		const diffs = diff(
			pairBase(db, 'figure', own, r.id),
			flatOf(db, 'figure', r.id),
			flatOf(db, 'figure', own),
			hashValue
		);
		const key = `rec:${copyRec.geneId}:spot:${spots[1].geneId}:links`;
		expect(diffs.find((d) => d.key === key)).toMatchObject({ side: 'theirs', removal: false });
		expect(defaultPicks(diffs, 'send')[key]).toBe('theirs');
		expect(diffs.map((d) => d.key)).toEqual([key]);
	});

	it('a taken name is kept: the copy shares it, no suffix and no refusal', async () => {
		const src = groupFigure();
		figure(U2_SALSA, 'Enchufla', 'Doble');
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: src.id, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		expect(r.ok && figureRow(r.id).name).toBe('Doble');
		expect(r.ok && moveName(r.id)).toBe('Enchufla');
	});

	it('saving other fields of a figure whose name a copy shares works; a rename onto a taken name does not', async () => {
		const src = groupFigure();
		const mine = figure(U2_SALSA, 'Enchufla', 'Doble');
		await cloneInto(
			db,
			{ kind: 'figure', id: src.id, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		expect(
			updateVariation(db, mine.figure.id, { name: 'Doble', ...shape, notes: 'n' })
		).not.toBeNull();
		const other = createVariationIn(db, mine.group.id, { name: 'Otro', ...shape }, 'u2')!;
		expect(updateVariation(db, other.id, { name: 'doble', ...shape })).toBeNull();
	});

	it('the Figures list says where a same-named copy came from, from a place the viewer reads', async () => {
		const src = groupFigure();
		figure(U2_SALSA, 'Enchufla', 'Doble');
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: src.id, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!r.ok) throw new Error('expected a copy');
		const rows = listFigures(db, U2_SALSA).flatMap((m) => m.figures);
		expect(rows.map((f) => [f.name, f.from])).toEqual([
			['Doble', null],
			['Doble', 'Salsa Tuesdays']
		]);
		const tags = fromTags(rows);
		expect(rows.map((f) => shownName(f, tags))).toEqual(['Doble', 'Doble · Salsa Tuesdays']);
		// A source in the person's own app is "Yours": never a tag.
		const own = figure(U1_SALSA, 'Setenta', 'Basic').figure.id;
		const inClub = await cloneInto(
			db,
			{ kind: 'figure', id: own, into: T1_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!inClub.ok) throw new Error('expected a copy');
		expect(copiedFromPlaces(db, 'u1', 'figure', [inClub.id]).size).toBe(0);
	});

	it('from my own app a taken name is kept too', async () => {
		const own = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		const theirs = figure(T1_SALSA, 'Enchufla', 'Doble').group.id;
		createVariationIn(db, theirs, { name: 'Doble (Ana)', ...shape }, 'u1');
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: own, into: T1_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		expect(r.ok && figureRow(r.id).name).toBe('Doble');
	});

	it('denied without read or edit', async () => {
		const src = groupFigure();
		const req = (into: Space, id = src.id): CloneRequest => ({
			kind: 'figure',
			id,
			into,
			recordings: false
		});
		// Not a member: cannot read the group's figure.
		expect(await cloneInto(db, req(U3_SALSA), fakeFiles().files, T)).toEqual({
			ok: false,
			reason: 'denied'
		});
		// A member only reads the group: no copying into it.
		const mine = figure(U2_SALSA, 'Dile', 'Basic').figure.id;
		const asMember = { teamId: 1, actorId: 'u2', dance: 'salsa' } as const;
		expect(await cloneInto(db, req(asMember, mine), fakeFiles().files, T)).toEqual({
			ok: false,
			reason: 'denied'
		});
		// Another dance, an archived source, a missing one.
		expect(
			await cloneInto(db, req({ userId: 'u1', dance: 'bachata' }), fakeFiles().files, T)
		).toEqual({ ok: false, reason: 'denied' });
		db.update(figures).set({ archivedAt: T }).where(eq(figures.id, mine)).run();
		expect(await cloneInto(db, req(U1_SALSA, mine), fakeFiles().files, T)).toEqual({
			ok: false,
			reason: 'denied'
		});
		expect(await cloneInto(db, req(U2_SALSA, 999), fakeFiles().files, T)).toEqual({
			ok: false,
			reason: 'denied'
		});
	});

	it('trusted skips the read check and takes an archived source', async () => {
		const src = groupFigure();
		db.update(figures).set({ archivedAt: T }).where(eq(figures.id, src.id)).run();
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: src.id, into: U3_SALSA, recordings: false },
			fakeFiles().files,
			T,
			undefined,
			{ trusted: true, archivedRoot: true }
		);
		expect(r).toMatchObject({ ok: true, made: true, archived: false });
		expect(r.ok && figureRow(r.id).archivedAt).toBeNull();
	});

	it('`use` copies the chosen row for that family', async () => {
		const src = groupFigure();
		const twin = figure(T1_SALSA, 'Dile', 'Doble twin').figure.id;
		const first = await cloneInto(
			db,
			{ kind: 'figure', id: src.id, into: U1_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!first.ok) throw new Error('expected a clone');
		const gene = geneOf(db, 'figure', first.id)!;
		createTeam(db, 'u1', 'salsa', 'Rueda', T);
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: first.id, into: T2_SALSA, recordings: false, use: { [gene]: twin } },
			fakeFiles().files,
			T
		);
		expect(r.ok && figureRow(r.id)).toMatchObject({ name: 'Doble twin', clonedFrom: twin });
	});
});

describe('cloneInto: refusals leave nothing behind', () => {
	it('refuses when the place is full, and leaves no files behind', async () => {
		const own = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		recording(own, 'a.mp4', 100);
		recording(own, 'b.mp4', 200);
		setTeamLimit(db, 1, 250);
		const before = db.select().from(figures).all().length;
		const f = fakeFiles();
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: own, into: T1_SALSA, recordings: true },
			f.files,
			T
		);
		expect(r).toMatchObject({ ok: false, reason: 'room' });
		expect(!r.ok && r.reason === 'room' && r.room.ok === false && r.room.message).toMatch(
			/the group uses/
		);
		expect(db.select().from(figures).all()).toHaveLength(before);
		expect(f.linked).toEqual([]);
		expect(geneOf(db, 'figure', own)).toBeNull();
		// Over the limit on purpose (a keep): it goes through.
		const forced = await cloneInto(
			db,
			{ kind: 'figure', id: own, into: T1_SALSA, recordings: true, overLimitOk: true },
			f.files,
			T
		);
		expect(forced.ok).toBe(true);
	});

	it('a copy with no files is never refused for room', async () => {
		const src = groupFigure();
		const own = figure(U2_SALSA, 'Dile', 'Basic').figure.id;
		recording(own, 'mine.mp4', 100, 'u2');
		db.update(users).set({ storageLimitBytes: 10 }).where(eq(users.id, 'u2')).run();
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: src.id, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T,
			0
		);
		expect(r).toMatchObject({ ok: true, made: true });
	});

	it('the disk floor refuses too', async () => {
		const own = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		recording(own, 'a.mp4', 100);
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: own, into: T1_SALSA, recordings: true },
			fakeFiles().files,
			T,
			0
		);
		expect(r).toMatchObject({ ok: false, reason: 'room' });
	});

	it('a throw inside the transaction unlinks every linked file and rethrows', async () => {
		const own = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		recording(own, 'a.mp4', 100);
		recording(own, 'b.mp4', 100);
		// A name another recording already holds: the insert breaks `recordings.file`'s unique.
		const other = figure(U1_SALSA, 'Dile', 'Basic').figure.id;
		recording(other, 'taken.mp4');
		let n = 0;
		const f = fakeFiles((file) => (n++ === 1 ? 'taken.mp4' : `copy-${file}`));
		await expect(
			cloneInto(db, { kind: 'figure', id: own, into: T1_SALSA, recordings: true }, f.files, T)
		).rejects.toThrow();
		expect(f.unlinked).toEqual([
			['recording', 'copy-a.mp4'],
			['recording', 'taken.mp4']
		]);
		expect(db.select().from(figures).where(eq(figures.teamId, 1)).all()).toEqual([]);
		expect(geneOf(db, 'figure', own)).toBeNull();
	});
});

describe('cloneInto: drills and songs', () => {
	it('a drill and a song', async () => {
		const drill = createCustomExercise(db, U1_SALSA, {
			name: 'Shines',
			everyDays: 2,
			notes: 'Arms'
		}).id;
		db.update(exercises)
			.set({
				practiceMode: 'count',
				countBpm: 90,
				practiceJson: '{"count":true}',
				kind: 'hearing',
				comesBack: '{"kind":"every","days":2}',
				warmup: true,
				warmupOrder: 3
			})
			.where(eq(exercises.id, drill))
			.run();
		addLinks(db, { exerciseId: drill }, ['https://example.org/shines'], null);
		const d = await cloneInto(
			db,
			{ kind: 'drill', id: drill, into: T1_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!d.ok) throw new Error('expected a clone');
		const copy = db.select().from(exercises).where(eq(exercises.id, d.id)).get()!;
		expect(copy).toMatchObject({
			name: 'Shines',
			notes: 'Arms',
			source: 'custom',
			teamId: 1,
			userId: null,
			practiceMode: 'count',
			kind: 'hearing',
			countBpm: 90,
			comesBack: '{"kind":"every","days":2}',
			warmup: false,
			warmupOrder: null,
			songId: null,
			clonedFrom: drill
		});
		expect(copy.geneId).toBe(geneOf(db, 'drill', drill));
		expect(db.select().from(links).where(eq(links.exerciseId, d.id)).all()).toHaveLength(1);
		expect(flatOf(db, 'drill', d.id)).toEqual(flatOf(db, 'drill', drill));
		expect(
			db
				.select()
				.from(teamChanges)
				.where(and(eq(teamChanges.rootKind, 'drill'), eq(teamChanges.rootId, d.id)))
				.all()
		).toMatchObject([{ verb: 'add', subject: 'drill', actorId: 'u1' }]);

		const song = createSongFromUpload(db, U1_SALSA, {
			file: 'song.mp3',
			mime: 'audio/mpeg',
			title: 'Chan Chan',
			style: 'salsa',
			sizeBytes: 1000
		}).id;
		db.update(songs)
			.set({
				status: 'ready',
				artist: 'Compay',
				durationS: 200,
				bpm: 180,
				beatsJson: '[0.5,1]',
				downbeatsJson: '[0.5]',
				anchorsJson: '[[0,1]]',
				tempoFactor: 2,
				sampleStartS: 30,
				sectionsJson: '[{"at":4,"name":"Mambo","countOff":false}]',
				startS: 3,
				startFoundS: 18,
				sourceUrl: 'https://youtu.be/x',
				audioUrl: 'https://youtu.be/a',
				fetchedUrl: 'https://youtu.be/a',
				fetchedTitle: 'The video'
			})
			.where(eq(songs.id, song))
			.run();
		const f = fakeFiles();
		const s = await cloneInto(
			db,
			{ kind: 'song', id: song, into: T1_SALSA, recordings: false },
			f.files,
			T
		);
		if (!s.ok) throw new Error('expected a clone');
		expect(f.linked).toEqual([['audio', 'song.mp3']]);
		const src = db.select().from(songs).where(eq(songs.id, song)).get()!;
		const made = db.select().from(songs).where(eq(songs.id, s.id)).get()!;
		expect(made).toMatchObject({
			teamId: 1,
			userId: null,
			sharedAt: null,
			status: 'ready',
			audioFile: 'copy-song.mp3',
			clonedFrom: song,
			geneId: src.geneId
		});
		for (const k of [
			'title',
			'artist',
			'style',
			'sourceUrl',
			'mime',
			'durationS',
			'bpm',
			'beatsJson',
			'downbeatsJson',
			'anchorsJson',
			'tempoFactor',
			'sampleStartS',
			'sectionsJson',
			'startS',
			'startFoundS',
			'sizeBytes',
			'audioUrl',
			'fetchedUrl',
			'fetchedTitle'
		] as const)
			expect(made[k]).toEqual(src[k]);

		const waiting = createSongFromUrl(db, U1_SALSA, {
			url: 'https://youtu.be/y',
			title: 'Later',
			style: 'salsa'
		}).id;
		expect(
			await cloneInto(
				db,
				{ kind: 'song', id: waiting, into: T1_SALSA, recordings: false },
				fakeFiles().files,
				T
			)
		).toEqual({ ok: false, reason: 'denied' });
	});

	it('a drill I practise through an entry is copied into my app paused', async () => {
		const lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: null })
			.lesson.id;
		const practised = createCustomExercise(db, T1_SALSA, {
			name: 'Shines',
			everyDays: 3,
			notes: null
		}).id;
		const other = createCustomExercise(db, T1_SALSA, {
			name: 'Turns',
			everyDays: 3,
			notes: null
		}).id;
		linkExercise(db, lesson, practised, 'u1');
		linkExercise(db, lesson, other, 'u1');
		publishLesson(db, T1_SALSA, lesson, T);
		db.insert(exercises)
			.values({ name: 'Shines', dance: 'salsa', userId: 'u2', source: 'added', drillId: practised })
			.run();
		const active = async (id: number) => {
			const r = await cloneInto(
				db,
				{ kind: 'drill', id, into: U2_SALSA, recordings: false },
				fakeFiles().files,
				T
			);
			if (!r.ok) throw new Error('expected a clone');
			return db.select().from(exercises).where(eq(exercises.id, r.id)).get()!.active;
		};
		expect(await active(practised)).toBe(false);
		expect(await active(other)).toBe(true);
	});

	it('an entry is not a drill', async () => {
		const own = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		const entry = db
			.insert(exercises)
			.values({ name: 'E', dance: 'salsa', userId: 'u1', source: 'figure', figureId: own })
			.returning()
			.get().id;
		expect(
			await cloneInto(
				db,
				{ kind: 'drill', id: entry, into: T1_SALSA, recordings: false },
				fakeFiles().files,
				T
			)
		).toEqual({ ok: false, reason: 'denied' });
	});
});

describe('Review Focus 5: a shared file outlives one side', () => {
	let root: string;
	afterEach(() => rmSync(root, { recursive: true, force: true }));

	it('deleting the source recording leaves the copy playable', async () => {
		root = mkdtempSync(join(tmpdir(), 'clone-spec-'));
		const dirs = {
			recording: join(root, 'recordings'),
			'lesson-video': join(root, 'lesson-videos'),
			audio: join(root, 'audio')
		};
		for (const d of Object.values(dirs)) mkdirSync(d);
		const name = `${randomUUID()}.mp4`;
		writeFileSync(join(dirs.recording, name), 'frames');
		const src = figure(T1_SALSA, 'Enchufla', 'Doble').figure.id;
		const rec = recording(src, name, 6);

		const r = await cloneInto(
			db,
			{ kind: 'figure', id: src, into: U1_SALSA, recordings: true },
			cloneFilesIn(dirs),
			T
		);
		if (!r.ok) throw new Error('expected a clone');
		const [copy] = recsOf(r.id);
		expect(copy.file).not.toBe(name);

		const gone = deleteRecording(db, rec, 'u1', T);
		expect(gone?.trashId).not.toBeNull();
		await purgeTrash(db, T + TRASH_MS + 1, {
			recordings: dirs.recording,
			lessonVideos: dirs['lesson-video'],
			audio: dirs.audio
		});
		expect(existsSync(join(dirs.recording, name))).toBe(false);
		expect(readFileSync(join(dirs.recording, copy.file), 'utf8')).toBe('frames');
		expect(recsOf(r.id)).toEqual([copy]);
	});
});

describe('cloneInto: routines and lessons', () => {
	/** A published lesson of group 1 linking these by hand, so its members read them. */
	function publishWith(link: { figures?: number[]; routines?: number[]; drills?: number[] }) {
		const lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-02', title: 'L', notes: null })
			.lesson.id;
		for (const id of link.figures ?? []) expect(linkFigure(db, lesson, id, 'u1')).toBe(true);
		for (const id of link.routines ?? []) expect(linkRoutine(db, lesson, id, 'u1')).toBe(true);
		for (const id of link.drills ?? []) expect(linkExercise(db, lesson, id, 'u1')).toBe(true);
		publishLesson(db, T1_SALSA, lesson, T);
		return lesson;
	}

	const slotsOf = (routineId: number) =>
		routineSlots(db, routineId).map((s) => [s.position, s.figureIds, s.childId, s.note]);
	const routineRow = (id: number) => db.select().from(routines).where(eq(routines.id, id)).get()!;
	const memberOf = (kind: 'figure' | 'routine' | 'drill', id: number, place: Space) =>
		memberIn(db, kind, geneOf(db, kind, id)!, place)?.id;

	it("a routine copy keeps each slot's length (spec 2026-11-11)", async () => {
		const walk = figure(T1_SALSA, 'Walk', 'Slow').figure.id;
		db.update(figures).set({ lengthFree: 1 }).where(eq(figures.id, walk)).run();
		const r = createRoutine(db, T1_SALSA, { name: 'R', notes: null }).routine.id;
		expect(insertSlot(db, r, 0, { figureId: walk, length: 12 }, 'u1')).not.toBeNull();
		publishWith({ routines: [r] });
		const res = await cloneInto(
			db,
			{ kind: 'routine', id: r, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!res.ok) throw new Error('expected a clone');
		const copy = memberOf('figure', walk, U2_SALSA)!;
		expect(routineSlots(db, res.id).map((s) => s.lengths)).toEqual([{ [copy]: 12 }]);
	});

	it('a routine copy brings a 3-level nest, sections staying sections (spec 2026-11-12)', async () => {
		const walk = figure(T1_SALSA, 'Walk', 'Slow').figure.id;
		const r = createRoutine(db, T1_SALSA, { name: 'R', notes: null }).routine.id;
		const s = insertRoutine(db, T1_SALSA, { name: 'S', notes: null, isSection: true }).routine.id;
		const u = insertRoutine(db, T1_SALSA, { name: '', notes: null, isSection: true }).routine.id;
		insertSlot(db, u, 0, { figureId: walk }, 'u1');
		insertSlot(db, s, 0, { childId: u }, 'u1');
		insertSlot(db, r, 0, { childId: s }, 'u1');
		publishWith({ routines: [r] });
		const res = await cloneInto(
			db,
			{ kind: 'routine', id: r, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!res.ok) throw new Error('expected a clone');
		const s2 = routineSlots(db, res.id)[0].childId!;
		const u2 = routineSlots(db, s2)[0].childId!;
		expect([routineRow(s2).isSection, routineRow(s2).userId]).toEqual([1, 'u2']);
		expect(routineRow(u2).isSection).toBe(1);
		expect(routineSlots(db, u2).map((x) => x.figureIds)).toEqual([
			[memberOf('figure', walk, U2_SALSA)]
		]);
	});

	it('a routine brings its figures and its embedded routine', async () => {
		const doble = figure(T1_SALSA, 'Enchufla', 'Doble');
		const basica = createVariationIn(db, doble.group.id, { name: 'Básica', ...shape }, 'u1')!.id;
		const setenta = figure(T1_SALSA, 'Setenta', 'Setenta').figure.id;
		const s = createRoutine(db, T1_SALSA, { name: 'S', notes: null }).routine.id;
		addFigureSlot(db, s, setenta, 'u1');
		const r = createRoutine(db, T1_SALSA, { name: 'R', notes: 'Twice' }).routine.id;
		const step = addFigureSlot(db, r, doble.figure.id, 'u1')!;
		expect(addOption(db, step, basica, 'u1')).toBe(true);
		expect(addChildSlot(db, r, s, 'u1')).not.toBeNull();
		publishWith({ routines: [r] });
		// u2 already has Básica's family: it is reused, not doubled.
		const mine = await cloneInto(
			db,
			{ kind: 'figure', id: basica, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!mine.ok) throw new Error('expected a clone');

		const res = await cloneInto(
			db,
			{ kind: 'routine', id: r, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!res.ok) throw new Error('expected a clone');
		expect(res.made).toBe(true);
		expect(routineRow(res.id)).toMatchObject({
			userId: 'u2',
			teamId: null,
			name: 'R',
			notes: 'Twice',
			clonedFrom: r,
			geneId: geneOf(db, 'routine', r)
		});
		const u2Figures = db.select().from(figures).where(eq(figures.userId, 'u2')).all();
		expect(u2Figures).toHaveLength(3);
		const dobleCopy = memberOf('figure', doble.figure.id, U2_SALSA)!;
		const setentaCopy = memberOf('figure', setenta, U2_SALSA)!;
		const sCopy = memberOf('routine', s, U2_SALSA)!;
		expect(slotsOf(res.id)).toEqual([
			[0, [dobleCopy, mine.id], null, null],
			[1, [], sCopy, null]
		]);
		expect(slotsOf(sCopy)).toEqual([[0, [setentaCopy], null, null]]);
		expect(routineRow(sCopy)).toMatchObject({ userId: 'u2', clonedFrom: s });
		// Each comes with the exercise a new routine of u2's gets.
		for (const id of [res.id, sCopy])
			expect(db.select().from(exercises).where(eq(exercises.routineId, id)).get()).toMatchObject({
				userId: 'u2',
				source: 'routine',
				active: true
			});
		// In step with the source: nothing differs.
		expect(
			diff(
				pairBase(db, 'routine', r, res.id),
				flatOf(db, 'routine', res.id),
				flatOf(db, 'routine', r),
				hashValue
			)
		).toEqual([]);
		// Copying again reuses it.
		expect(
			await cloneInto(
				db,
				{ kind: 'routine', id: r, into: U2_SALSA, recordings: false },
				fakeFiles().files,
				T
			)
		).toEqual({ ok: true, id: res.id, made: false, archived: false });
	});

	it('an option the actor cannot read is dropped', async () => {
		createTeam(db, 'u3', 'salsa', 'Rueda', T);
		joinTeam(db, 'u1', 2, T);
		const theirs = createFigure(
			db,
			{ teamId: 2, actorId: 'u3', dance: 'salsa' },
			{
				figureName: 'Rueda',
				name: 'Dame',
				...shape
			}
		)!.figure.id;
		const own = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		const p = createRoutine(db, U1_SALSA, { name: 'P', notes: null }).routine.id;
		const step = addFigureSlot(db, p, own, 'u1')!;
		// A person's routine may hold a group's figure they reach (ruling 2).
		db.insert(routineStepOptions).values({ stepId: step, figureId: theirs, createdAt: T }).run();
		const only = db
			.insert(routineSteps)
			.values({ routineId: p, position: 1, note: 'gone', createdAt: T })
			.returning()
			.get().id;
		db.insert(routineStepOptions).values({ stepId: only, figureId: theirs, createdAt: T }).run();
		// Out of the group straight in the table: `leaveTeam` would rescue `theirs`
		// into u1's own app first (rescue.spec.ts), and nothing would be dropped.
		db.delete(teamMembers)
			.where(and(eq(teamMembers.teamId, 2), eq(teamMembers.userId, 'u1')))
			.run();

		const res = await cloneInto(
			db,
			{ kind: 'routine', id: p, into: T1_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!res.ok) throw new Error('expected a clone');
		const ownCopy = memberOf('figure', own, T1_SALSA)!;
		expect(slotsOf(res.id)).toEqual([[0, [ownCopy], null, null]]);
		expect(db.select().from(figures).where(eq(figures.teamId, 1)).all()).toHaveLength(1);
		// What was dropped is not the copy's own change: a Send leaves it in the source.
		const diffs = diff(
			pairBase(db, 'routine', p, res.id),
			flatOf(db, 'routine', res.id),
			flatOf(db, 'routine', p),
			hashValue
		);
		expect(diffs).toMatchObject([{ key: 'slots', side: 'theirs', removal: false }]);
		expect(defaultPicks(diffs, 'send').slots).toBe('theirs');
		// Into a group: one History line per thing made (the routine, the move).
		expect(
			db
				.select({ kind: teamChanges.rootKind, verb: teamChanges.verb, at: teamChanges.at })
				.from(teamChanges)
				.where(and(eq(teamChanges.teamId, 1), eq(teamChanges.at, T)))
				.all()
				.sort((a, b) => a.kind.localeCompare(b.kind))
		).toEqual([
			{ kind: 'figure', verb: 'add', at: T },
			{ kind: 'routine', verb: 'add', at: T }
		]);
		// A group routine has no exercise.
		expect(db.select().from(exercises).where(eq(exercises.routineId, res.id)).all()).toEqual([]);
	});

	it('a lesson brings videos, sections, section links and hand links', async () => {
		const doble = figure(T1_SALSA, 'Enchufla', 'Doble').figure.id;
		const drill = createCustomExercise(db, T1_SALSA, {
			name: 'Shines',
			everyDays: 2,
			notes: null
		}).id;
		const lesson = publishWith({ drills: [drill] });
		addLinks(db, { lessonId: lesson }, ['https://example.org/class'], 'Class', 'u1');
		const video = addLessonVideo(
			db,
			{ lessonId: lesson, file: 'v.mp4', mime: 'video/mp4', sizeBytes: 70 },
			'u1'
		).id;
		const turn = addSpot(
			db,
			{ lessonVideoId: video },
			{ startMs: 0, endMs: 900, label: 'Turn' },
			'u1'
		)!;
		linkInSpace(db, T1_SALSA, turn.id, { figureId: doble });

		const plan = planClone(db, { kind: 'lesson', id: lesson, into: U2_SALSA, recordings: false });
		expect(plan.bytes).toBe(70);
		expect(plan.files).toEqual([
			{ key: 'lesson-video:v.mp4', kind: 'lesson-video', file: 'v.mp4', bytes: 70 }
		]);
		expect(plan.rows.map((r) => r.kind).sort()).toEqual(
			['drill', 'figure', 'lesson', 'spot', 'video'].sort()
		);

		const f = fakeFiles();
		const res = await cloneInto(
			db,
			{ kind: 'lesson', id: lesson, into: U2_SALSA, recordings: false },
			f.files,
			T
		);
		if (!res.ok) throw new Error('expected a clone');
		expect(f.linked).toEqual([['lesson-video', 'v.mp4']]);
		expect(db.select().from(lessons).where(eq(lessons.id, res.id)).get()).toMatchObject({
			userId: 'u2',
			teamId: null,
			title: 'L',
			lessonDay: '2026-11-02',
			publishedAt: null,
			clonedFrom: lesson
		});
		expect(db.select().from(exercises).where(eq(exercises.lessonId, res.id)).get()).toMatchObject({
			userId: 'u2',
			source: 'lesson'
		});
		expect(db.select().from(links).where(eq(links.lessonId, res.id)).all()).toMatchObject([
			{ url: 'https://example.org/class', title: 'Class' }
		]);
		const [copyVideo] = db
			.select()
			.from(lessonVideos)
			.where(eq(lessonVideos.lessonId, res.id))
			.all();
		expect(copyVideo).toMatchObject({ file: 'copy-v.mp4', sizeBytes: 70, clonedFrom: video });
		expect(copyVideo.geneId).toBe(geneOf(db, 'video', video));
		const spots = db
			.select()
			.from(videoSpots)
			.where(eq(videoSpots.lessonVideoId, copyVideo.id))
			.all();
		expect(spots.map((s) => [s.startMs, s.endMs, s.label, s.clonedFrom])).toEqual([
			[0, 900, 'Turn', turn.id]
		]);
		const dobleCopy = memberOf('figure', doble, U2_SALSA)!;
		const drillCopy = memberOf('drill', drill, U2_SALSA)!;
		expect(
			db
				.select({ figureId: spotLinks.figureId, exerciseId: spotLinks.exerciseId })
				.from(spotLinks)
				.where(eq(spotLinks.spotId, spots[0].id))
				.all()
		).toEqual([{ figureId: dobleCopy, exerciseId: null }]);
		expect(
			db.select().from(lessonExercises).where(eq(lessonExercises.lessonId, res.id)).all()
		).toMatchObject([{ exerciseId: drillCopy }]);
		expect(usedBytesOf(db, { userId: 'u2' })).toBe(70);
		expect(
			diff(
				pairBase(db, 'lesson', lesson, res.id),
				flatOf(db, 'lesson', res.id),
				flatOf(db, 'lesson', lesson),
				hashValue
			)
		).toEqual([]);
	});

	it('into a group a lesson is a draft', async () => {
		const lesson = publishWith({});
		createTeam(db, 'u1', 'salsa', 'Rueda', T);
		const res = await cloneInto(
			db,
			{ kind: 'lesson', id: lesson, into: T2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!res.ok) throw new Error('expected a clone');
		expect(db.select().from(lessons).where(eq(lessons.id, res.id)).get()).toMatchObject({
			teamId: 2,
			userId: null,
			publishedAt: null
		});
		expect(db.select().from(exercises).where(eq(exercises.lessonId, res.id)).all()).toEqual([]);
		expect(db.select().from(teamChanges).where(eq(teamChanges.teamId, 2)).all()).toMatchObject([
			{ rootKind: 'lesson', rootId: res.id, verb: 'add', actorId: 'u1' }
		]);
	});

	it('a section linking back to its own figure does not loop', async () => {
		const own = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		const rec = recording(own, 'a.mp4');
		const spot = addSpot(db, { recordingId: rec }, { startMs: 0, endMs: 900, label: 'Turn' })!;
		linkInSpace(db, U1_SALSA, spot.id, { figureId: own });
		const res = await cloneInto(
			db,
			{ kind: 'figure', id: own, into: T1_SALSA, recordings: true },
			fakeFiles().files,
			T
		);
		if (!res.ok) throw new Error('expected a clone');
		expect(db.select().from(figures).where(eq(figures.teamId, 1)).all()).toHaveLength(1);
		const [copyRec] = recsOf(res.id);
		const [copySpot] = db
			.select()
			.from(videoSpots)
			.where(eq(videoSpots.recordingId, copyRec.id))
			.all();
		expect(
			db
				.select({ f: spotLinks.figureId })
				.from(spotLinks)
				.where(eq(spotLinks.spotId, copySpot.id))
				.all()
		).toEqual([{ f: res.id }]);
	});

	it('a nested figure brings its recordings when the request does, and the plan counts them', async () => {
		const own = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		recording(own, 'a.mp4', 40);
		const p = createRoutine(db, U1_SALSA, { name: 'P', notes: null }).routine.id;
		addFigureSlot(db, p, own, 'u1');
		const req: CloneRequest = { kind: 'routine', id: p, into: T1_SALSA, recordings: true };
		expect(planClone(db, req)).toMatchObject({
			bytes: 40,
			files: [{ kind: 'recording', file: 'a.mp4', bytes: 40 }]
		});
		const res = await cloneInto(db, req, fakeFiles().files, T);
		if (!res.ok) throw new Error('expected a clone');
		const copy = memberOf('figure', own, T1_SALSA)!;
		expect(recsOf(copy).map((r) => r.file)).toEqual(['copy-a.mp4']);
		expect(usedBytesOf(db, { teamId: 1 })).toBe(40);
	});

	it('a routine or lesson I practise through an entry is copied into my app paused', async () => {
		const r = createRoutine(db, T1_SALSA, { name: 'R', notes: null }).routine.id;
		const lesson = publishWith({ routines: [r] });
		addLesson(db, 'u2', lesson, { lesson: true, routineIds: [r], drillIds: [], figureIds: [] }, T);
		const res = await cloneInto(
			db,
			{ kind: 'lesson', id: lesson, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!res.ok) throw new Error('expected a clone');
		const rCopy = memberOf('routine', r, U2_SALSA)!;
		const active = (col: typeof exercises.lessonId | typeof exercises.routineId, id: number) =>
			db
				.select({ a: exercises.active })
				.from(exercises)
				.where(
					and(
						eq(col, id),
						eq(exercises.userId, 'u2'),
						eq(exercises.source, col === exercises.lessonId ? 'lesson' : 'routine')
					)
				)
				.get()!.a;
		expect(active(exercises.lessonId, res.id)).toBe(false);
		expect(active(exercises.routineId, rCopy)).toBe(false);
	});

	it('a throw inside the transaction unlinks every linked lesson-video file', async () => {
		const lesson = publishWith({});
		addLessonVideo(db, { lessonId: lesson, file: 'a.mp4', mime: 'video/mp4', sizeBytes: 5 }, 'u1');
		addLessonVideo(db, { lessonId: lesson, file: 'b.mp4', mime: 'video/mp4', sizeBytes: 5 }, 'u1');
		// The second new name is one the first video holds: `lesson_videos.file` is unique.
		let n = 0;
		const f = fakeFiles((file) => (n++ === 1 ? 'a.mp4' : `copy-${file}`));
		await expect(
			cloneInto(db, { kind: 'lesson', id: lesson, into: U2_SALSA, recordings: false }, f.files, T)
		).rejects.toThrow();
		expect(f.unlinked).toEqual([
			['lesson-video', 'copy-a.mp4'],
			['lesson-video', 'a.mp4']
		]);
		expect(db.select().from(lessons).where(eq(lessons.userId, 'u2')).all()).toEqual([]);
		expect(geneOf(db, 'lesson', lesson)).toBeNull();
	});
});

describe('cloneInto: positions', () => {
	const HOLD = {
		styleTag: 'son',
		hands: 'two',
		crossed: true,
		facing: 'face',
		frame: 'closed',
		notes: 'Right hand high'
	};

	/** A position of `space` with the hold above (or `extra`'s), a gene when given. */
	function position(
		space: Space,
		name: string,
		extra: Partial<typeof positions.$inferInsert> = {}
	) {
		return db
			.insert(positions)
			.values({
				...ownerValues(space),
				slug: `p-${randomUUID()}`,
				name,
				...HOLD,
				...extra
			})
			.returning()
			.get();
	}

	const groupPositions = () =>
		db
			.select()
			.from(positions)
			.where(eq(positions.teamId, 1))
			.all()
			.map((p) => p.id);
	const tag = (figureId: number, side: 'start' | 'end', positionId: number) =>
		db
			.insert(side === 'start' ? figureStartPositions : figureEndPositions)
			.values({ figureId, positionId })
			.run();
	const row = (id: number) => db.select().from(positions).where(eq(positions.id, id)).get()!;

	it('a figure into a group that has the family: tagged with the group’s member, nothing new', async () => {
		const mine = position(U1_SALSA, 'Cerrada', { geneId: 'g-cerrada' });
		const theirs = position(T1_SALSA, 'Cerrada', { geneId: 'g-cerrada', hands: 'one' });
		const doble = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		tag(doble, 'start', mine.id);
		tag(doble, 'end', mine.id);
		const before = groupPositions();

		const plan = planClone(db, { kind: 'figure', id: doble, into: T1_SALSA, recordings: true });
		expect(plan.rows).toEqual([{ kind: 'figure', from: doble }]);
		expect(plan.reused).toEqual([{ kind: 'position', from: mine.id, at: theirs.id }]);

		const r = await cloneInto(
			db,
			{ kind: 'figure', id: doble, into: T1_SALSA, recordings: true },
			fakeFiles().files,
			T
		);
		if (!r.ok) throw new Error('expected a clone');
		expect(figurePositions(db, r.id)).toEqual({ startIds: [theirs.id], endIds: [theirs.id] });
		expect(groupPositions()).toEqual(before);
		// The group's own member keeps its own hold: a figure's copy never edits it.
		expect(row(theirs.id).hands).toBe('one');
		// Tags compare by family: the copy's sides read as the source's.
		const d = diff(
			pairBase(db, 'figure', doble, r.id),
			flatOf(db, 'figure', doble),
			flatOf(db, 'figure', r.id),
			hashValue
		);
		expect(d).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a figure into a group without the family: the position is copied there, the copy tagged with it', async () => {
		const cerrada = position(U1_SALSA, 'Cerrada');
		const sombra = position(U1_SALSA, 'Sombra', { styleTag: null, crossed: false });
		const doble = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		tag(doble, 'start', sombra.id);
		tag(doble, 'end', cerrada.id);
		tag(doble, 'end', sombra.id);
		const before = groupPositions();

		const plan = planClone(db, { kind: 'figure', id: doble, into: T1_SALSA, recordings: true });
		expect(plan.rows).toEqual([
			{ kind: 'figure', from: doble },
			{ kind: 'position', from: sombra.id },
			{ kind: 'position', from: cerrada.id }
		]);

		const r = await cloneInto(
			db,
			{ kind: 'figure', id: doble, into: T1_SALSA, recordings: true },
			fakeFiles().files,
			T
		);
		if (!r.ok) throw new Error('expected a clone');
		const made = groupPositions().filter((id) => !before.includes(id));
		expect(made).toHaveLength(2);
		const gc = geneOf(db, 'position', cerrada.id)!;
		const gs = geneOf(db, 'position', sombra.id)!;
		expect(gc).not.toBeNull();
		const c2 = memberIn(db, 'position', gc, T1_SALSA)!.id;
		const s2 = memberIn(db, 'position', gs, T1_SALSA)!.id;
		expect(row(c2)).toMatchObject({
			userId: null,
			teamId: 1,
			dance: 'salsa',
			name: 'Cerrada',
			styleTag: 'son',
			hands: 'two',
			crossed: true,
			facing: 'face',
			frame: 'closed',
			notes: 'Right hand high',
			pictureSpotId: null,
			archivedAt: null,
			clonedFrom: cerrada.id,
			geneId: gc
		});
		expect(row(s2)).toMatchObject({ name: 'Sombra', styleTag: null, crossed: false });
		expect(row(c2).slug).not.toBe(cerrada.slug);
		expect(figurePositions(db, r.id)).toEqual({
			startIds: [s2],
			endIds: [c2, s2].sort((a, b) => a - b)
		});
		// Each copied position is its own pair, in step, and its own History line.
		expect(pairBase(db, 'position', cerrada.id, c2)).not.toBeNull();
		expect(
			db
				.select()
				.from(teamChanges)
				.where(eq(teamChanges.rootKind, 'position'))
				.all()
				.map((c) => [c.rootId, c.verb, c.subject, c.actorId])
		).toEqual(
			expect.arrayContaining([
				[c2, 'add', 'position', 'u1'],
				[s2, 'add', 'position', 'u1']
			])
		);
		expect(crossRefs(db)).toEqual([]);
	});

	it('two rows of one family on one figure, copied into a place without it: one new position', async () => {
		// u1's own Cerrada and the group's (one family) on one figure of u1's.
		const mine = position(U1_SALSA, 'Cerrada', { geneId: 'g-cerrada' });
		const theirs = position(T1_SALSA, 'Cerrada', { geneId: 'g-cerrada' });
		const doble = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		tag(doble, 'start', mine.id);
		tag(doble, 'end', theirs.id);
		expect(crossRefs(db)).toEqual([]);
		const made = createTeam(db, 'u1', 'salsa', 'Rueda club', T);
		if (!made.ok || made.teamId !== 2) throw new Error('a second group expected');

		const r = await cloneInto(
			db,
			{ kind: 'figure', id: doble, into: T2_SALSA, recordings: true },
			fakeFiles().files,
			T
		);
		if (!r.ok) throw new Error('expected a clone');
		const inT2 = db.select().from(positions).where(eq(positions.teamId, 2)).all();
		expect(inT2.map((p) => [p.name, p.geneId])).toEqual([['Cerrada', 'g-cerrada']]);
		expect(figurePositions(db, r.id)).toEqual({ startIds: [inT2[0].id], endIds: [inT2[0].id] });
		expect(familyIntegrity(db)).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('an archived position’s tag drops; one the actor cannot read drops too', async () => {
		const gone = position(U1_SALSA, 'Gone', { archivedAt: T });
		const doble = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		tag(doble, 'start', gone.id);
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: doble, into: T1_SALSA, recordings: true },
			fakeFiles().files,
			T
		);
		if (!r.ok) throw new Error('expected a clone');
		expect(figurePositions(db, r.id)).toEqual({ startIds: [], endIds: [] });
		expect(groupPositions()).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a lesson’s hand link and a section’s link land on the group’s member', async () => {
		const cerrada = position(U1_SALSA, 'Cerrada', { geneId: 'g-cerrada' });
		const sombra = position(U1_SALSA, 'Sombra');
		const groups = position(T1_SALSA, 'Cerrada', { geneId: 'g-cerrada' });
		const lesson = createLesson(db, U1_SALSA, {
			lessonDay: '2026-11-02',
			title: 'L',
			notes: null
		}).lesson.id;
		expect(linkPosition(db, lesson, cerrada.id)).toBe(true);
		const video = addLessonVideo(db, {
			lessonId: lesson,
			file: 'v.mp4',
			mime: 'video/mp4',
			sizeBytes: 70
		}).id;
		const turn = addSpot(db, { lessonVideoId: video }, { startMs: 0, endMs: 900, label: 'Turn' })!;
		const still = addSpot(
			db,
			{ lessonVideoId: video },
			{ startMs: 400, endMs: null, label: null }
		)!;
		linkPositionInSpace(db, U1_SALSA, turn.id, cerrada.id);
		linkPositionInSpace(db, U1_SALSA, still.id, sombra.id);

		const plan = planClone(db, { kind: 'lesson', id: lesson, into: T1_SALSA, recordings: true });
		expect(plan.reused).toContainEqual({ kind: 'position', from: cerrada.id, at: groups.id });
		expect(plan.rows).toContainEqual({ kind: 'position', from: sombra.id });

		const r = await cloneInto(
			db,
			{ kind: 'lesson', id: lesson, into: T1_SALSA, recordings: true },
			fakeFiles().files,
			T
		);
		if (!r.ok) throw new Error('expected a clone');
		expect(
			db
				.select({ id: lessonPositions.positionId })
				.from(lessonPositions)
				.where(eq(lessonPositions.lessonId, r.id))
				.all()
		).toEqual([{ id: groups.id }]);
		const [copyVideo] = db.select().from(lessonVideos).where(eq(lessonVideos.lessonId, r.id)).all();
		const linked = db
			.select({ start: videoSpots.startMs, positionId: spotPositionLinks.positionId })
			.from(spotPositionLinks)
			.innerJoin(videoSpots, eq(videoSpots.id, spotPositionLinks.spotId))
			.where(eq(videoSpots.lessonVideoId, copyVideo.id))
			.orderBy(videoSpots.startMs)
			.all();
		const sombra2 = memberIn(db, 'position', geneOf(db, 'position', sombra.id)!, T1_SALSA)!.id;
		expect(linked).toEqual([
			{ start: 0, positionId: groups.id },
			{ start: 400, positionId: sombra2 }
		]);
		// In step: the hand link and the sections' links compare by family.
		expect(
			diff(
				pairBase(db, 'lesson', lesson, r.id),
				flatOf(db, 'lesson', lesson),
				flatOf(db, 'lesson', r.id),
				hashValue
			)
		).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a position on its own: copied with its fields, never its picture; again answers the copy', async () => {
		const cerrada = position(U1_SALSA, 'Cerrada', { pictureSpotId: 99 });
		const f = fakeFiles();
		const r = await cloneInto(
			db,
			{ kind: 'position', id: cerrada.id, into: T1_SALSA, recordings: true },
			f.files,
			T
		);
		expect(r).toMatchObject({ ok: true, made: true, archived: false });
		if (!r.ok) return;
		expect(f.linked).toEqual([]);
		expect(row(r.id)).toMatchObject({
			teamId: 1,
			userId: null,
			name: 'Cerrada',
			styleTag: 'son',
			crossed: true,
			notes: 'Right hand high',
			pictureSpotId: null,
			clonedFrom: cerrada.id,
			geneId: geneOf(db, 'position', cerrada.id)
		});
		expect(
			diff(
				pairBase(db, 'position', cerrada.id, r.id),
				flatOf(db, 'position', cerrada.id),
				flatOf(db, 'position', r.id),
				hashValue
			)
		).toEqual([]);
		expect(
			await cloneInto(
				db,
				{ kind: 'position', id: cerrada.id, into: T1_SALSA, recordings: true },
				f.files,
				T
			)
		).toEqual({ ok: true, id: r.id, made: false, archived: false });
		expect(crossRefs(db)).toEqual([]);
	});

	it('a taken name is kept; another person may not copy it', async () => {
		position(T1_SALSA, 'cerrada');
		const cerrada = position(U1_SALSA, 'Cerrada');
		const r = await cloneInto(
			db,
			{ kind: 'position', id: cerrada.id, into: T1_SALSA, recordings: true },
			fakeFiles().files,
			T
		);
		if (!r.ok) throw new Error('expected a clone');
		expect(row(r.id).name).toBe('Cerrada');
		// u2 reads nothing of u1's own, and edits no group.
		expect(
			await cloneInto(
				db,
				{ kind: 'position', id: cerrada.id, into: U2_SALSA, recordings: false },
				fakeFiles().files,
				T
			)
		).toEqual({ ok: false, reason: 'denied' });
	});

	it('Make it mine on a group figure brings its positions into the reader’s app', async () => {
		const src = groupFigure();
		const res = await makeMine(db, U2_SALSA, 'figure', src.id, fakeFiles().files, T, Infinity);
		if (!res.ok) throw new Error(`expected a copy: ${res.reason}`);
		const tags = figurePositions(db, res.id);
		const owners = [...tags.startIds, ...tags.endIds].map((id) => row(id).userId);
		expect(owners).toEqual(['u2', 'u2']);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a routine copy keeps its slot’s end, in the place it goes to (spec 2026-11-11, slot end)', async () => {
		const cerrada = position(U1_SALSA, 'Cerrada');
		const sombra = position(U1_SALSA, 'Sombra', { styleTag: null, crossed: false });
		const doble = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		tag(doble, 'end', cerrada.id);
		tag(doble, 'end', sombra.id);
		const r = createRoutine(db, U1_SALSA, { name: 'R', notes: null }).routine.id;
		const step = addFigureSlot(db, r, doble)!;
		expect(setSlotEnd(db, step, sombra.id)).toBe(true);

		const res = await cloneInto(
			db,
			{ kind: 'routine', id: r, into: T1_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		if (!res.ok) throw new Error('expected a clone');
		const theirs = memberIn(db, 'position', geneOf(db, 'position', sombra.id)!, T1_SALSA)!.id;
		expect(routineSlots(db, res.id).map((s) => s.end)).toEqual([theirs]);
		expect(crossRefs(db)).toEqual([]);
	});
});
