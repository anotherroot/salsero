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
	figureStartPositions,
	links,
	positions,
	recordings,
	songs,
	spotLinks,
	teamChanges,
	users,
	videoSpots
} from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { addRecording, createFigure, createVariationIn, deleteRecording } from '../figures';
import { createCustomExercise } from '../exercises';
import { createLesson, linkFigure, publishLesson } from '../lessons';
import { addLinks } from '../links';
import { addSpot } from '../spots';
import { linkInSpace } from '../spot-links';
import { createSongFromUpload, createSongFromUrl } from '../songs';
import { seedPositions } from '../positions';
import { setTeamLimit, usedBytesOf } from '../storage';
import { purgeTrash } from '../trash';
import type { Space, Wall } from '../scope';
import { T1_SALSA, T2_SALSA, U1_SALSA, U2_SALSA } from '../test-walls';
import { TRASH_MS } from '$lib/limits';
import { geneOf } from './genes';
import { pairBase } from './pairs';
import { flatOf } from './trees';
import { cloneInto, planClone, type CloneRequest } from './clone';
import { cloneFilesIn, type CloneFileKind, type CloneFiles } from './files';

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
	seedPositions(db);
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
	const [open, closed] = db.select().from(positions).where(eq(positions.dance, 'salsa')).all();
	db.update(figures)
		.set({ notes: 'Lead early', startCount: 3, lengthCounts: 16, endPositionId: closed.id })
		.where(eq(figures.id, id))
		.run();
	db.insert(figureStartPositions).values({ figureId: id, positionId: open.id }).run();
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
	});

	it('a taken name is suffixed', async () => {
		const src = groupFigure();
		figure(U2_SALSA, 'Enchufla', 'Doble');
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: src.id, into: U2_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		expect(r.ok && figureRow(r.id).name).toBe('Doble (Salsa Tuesdays)');
		expect(r.ok && moveName(r.id)).toBe('Enchufla');
	});

	it('from my own app the suffix is my shown name, then numbered', async () => {
		const own = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		const theirs = figure(T1_SALSA, 'Enchufla', 'Doble').group.id;
		createVariationIn(db, theirs, { name: 'Doble (Ana)', ...shape }, 'u1');
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: own, into: T1_SALSA, recordings: false },
			fakeFiles().files,
			T
		);
		expect(r.ok && figureRow(r.id).name).toBe('Doble (Ana 2)');
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
			{ kind: 'figure', id: src.id, into: U3_SALSA, recordings: false, trusted: true },
			fakeFiles().files,
			T
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

	it('a name with no free suffix is refused, unlinking every linked file and writing nothing', async () => {
		const own = figure(U1_SALSA, 'Enchufla', 'Doble').figure.id;
		recording(own, 'a.mp4', 100);
		recording(own, 'b.mp4', 100);
		const theirs = figure(T1_SALSA, 'Enchufla', 'Doble').group.id;
		createVariationIn(db, theirs, { name: 'Doble (Ana)', ...shape }, 'u1');
		for (let n = 2; n <= 9; n++)
			createVariationIn(db, theirs, { name: `Doble (Ana ${n})`, ...shape }, 'u1');
		const figuresBefore = db.select().from(figures).all().length;
		const recsBefore = db.select().from(recordings).all().length;
		const changesBefore = db.select().from(teamChanges).all().length;
		const f = fakeFiles();
		const r = await cloneInto(
			db,
			{ kind: 'figure', id: own, into: T1_SALSA, recordings: true },
			f.files,
			T
		);
		expect(r).toEqual({
			ok: false,
			reason: 'name',
			message: 'Doble is taken in Enchufla; rename one first.'
		});
		expect(f.linked).toHaveLength(2);
		expect(f.unlinked).toEqual([
			['recording', 'copy-a.mp4'],
			['recording', 'copy-b.mp4']
		]);
		expect(db.select().from(figures).all()).toHaveLength(figuresBefore);
		expect(db.select().from(recordings).all()).toHaveLength(recsBefore);
		expect(db.select().from(teamChanges).all()).toHaveLength(changesBefore);
		expect(geneOf(db, 'figure', own)).toBeNull();
		expect(recsOf(own).map((x) => x.geneId)).toEqual([null, null]);
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
			.set({ practiceMode: 'count', countBpm: 90, practiceJson: '{"count":true}' })
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
			countBpm: 90,
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
				sourceUrl: 'https://youtu.be/x'
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
			'sizeBytes'
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
