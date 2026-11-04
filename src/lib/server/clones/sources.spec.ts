/**
 * A tab per source: every member of a family a person reads, and their
 * twins, with where each stands against the page's row; and Take, which
 * brings one of a source's recordings into the person's own copy. Files are
 * fakes; the database is in memory.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { figures, recordings, spotLinks, users, videoSpots } from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { addRecording, createFigure } from '../figures';
import { createLesson, linkFigure, publishLesson } from '../lessons';
import { addSpot } from '../spots';
import { linkInSpace } from '../spot-links';
import { setStorageLimit, usedBytesOf } from '../storage';
import { markTwins } from '../twins';
import { crossRefs } from '../integrity';
import type { Space, Wall } from '../scope';
import { T1_SALSA, T2_SALSA, U2_SALSA } from '../test-walls';
import type { CloneFileKind, CloneFiles } from './files';
import { cloneInto } from './clone';
import { geneOf } from './genes';
import { pairBase } from './pairs';
import { cloneLineOf, sourcesOf, sourcesView, takeRecording } from './sources';

const T = Date.UTC(2026, 10, 3, 20);
const NOW = T + 1000;
const ROOMY = 1024 ** 4;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const U3_SALSA: Wall = { userId: 'u3', dance: 'salsa' };

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' },
			{ id: 'u3', email: 'u3@x.si', passwordHash: 'x', firstName: 'Maja' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	createTeam(db, 'u1', 'salsa', 'Rueda club', T);
	joinTeam(db, 'u2', 1, T);
	joinTeam(db, 'u3', 1, T);
});

function fakeFiles() {
	const linked: [CloneFileKind, string][] = [];
	const unlinked: [CloneFileKind, string][] = [];
	const files: CloneFiles = {
		async link(kind, file) {
			linked.push([kind, file]);
			return `copy-${file}`;
		},
		async unlink(kind, file) {
			unlinked.push([kind, file]);
		}
	};
	return { files, linked, unlinked };
}

const figure = (space: Space, move: string, name = 'Básico') =>
	createFigure(db, space, { figureName: move, name, ...shape })!.figure.id;
const recording = (figureId: number, file: string, sizeBytes = 50) =>
	addRecording(
		db,
		{ figureId, file, mime: 'video/mp4', kind: 'video', sizeBytes, note: null },
		'u1'
	).id;
const recsOf = (figureId: number) =>
	db.select().from(recordings).where(eq(recordings.figureId, figureId)).all();
function publishedWith(space: typeof T1_SALSA, figureId: number) {
	const lesson = createLesson(db, space, { lessonDay: '2026-11-01', title: 'Week 4', notes: null })
		.lesson.id;
	linkFigure(db, lesson, figureId, 'u1');
	expect(publishLesson(db, space, lesson, T)).toBe(true);
	return lesson;
}
/** A copy into `wall` the way Edit makes one: no recordings. */
async function copyOf(id: number, wall: Space) {
	const r = await cloneInto(
		db,
		{ kind: 'figure', id, into: wall, recordings: false },
		fakeFiles().files,
		T
	);
	if (!r.ok) throw new Error(`copy refused: ${r.reason}`);
	return r.id;
}

/** Salsa Tuesdays' Setenta · Básico (F), published, with one recording; u2's copy of it (C). */
async function setenta() {
	const F = figure(T1_SALSA, 'Setenta');
	const first = recording(F, 'first.mp4');
	publishedWith(T1_SALSA, F);
	const C = await copyOf(F, U2_SALSA);
	return { F, C, first };
}

describe('sourcesOf', () => {
	it('your copy: Yours, then the group’s, newer by its timing and a recording', async () => {
		const { F, C } = await setenta();
		db.update(figures).set({ startCount: 3 }).where(eq(figures.id, F)).run();
		recording(F, 'second.mp4');

		expect(sourcesOf(db, 'u2', 'figure', C)).toEqual([
			{
				id: C,
				label: 'Yours',
				relation: 'self',
				access: 'edit',
				status: null,
				changed: []
			},
			{
				id: F,
				label: 'Salsa Tuesdays',
				relation: 'clone',
				access: 'read',
				status: 'newer',
				changed: ['Timing', '1 recording']
			}
		]);
	});

	it('the group’s page: the same tabs, the copy behind it; in step is same', async () => {
		const { F, C } = await setenta();
		expect(sourcesOf(db, 'u2', 'figure', F).map((s) => [s.id, s.relation, s.status])).toEqual([
			[C, 'clone', 'same'],
			[F, 'self', null]
		]);
		db.update(figures).set({ notes: 'Turn on 5' }).where(eq(figures.id, F)).run();
		const theirs = sourcesOf(db, 'u2', 'figure', F).find((s) => s.id === C)!;
		expect(theirs).toMatchObject({ status: 'behind', changed: ['Notes'] });
		db.update(figures).set({ name: 'Mine' }).where(eq(figures.id, C)).run();
		expect(sourcesOf(db, 'u2', 'figure', F).find((s) => s.id === C)!.status).toBe('differs');
	});

	it('a lone row has no tabs', () => {
		const own = figure(U2_SALSA, 'Enchufla');
		expect(sourcesOf(db, 'u2', 'figure', own)).toEqual([]);
		const F = figure(T1_SALSA, 'Setenta');
		publishedWith(T1_SALSA, F);
		expect(sourcesOf(db, 'u2', 'figure', F)).toEqual([]);
	});

	it('another person’s private copy never shows (Review Focus 1)', async () => {
		const { F, C } = await setenta();
		const u3s = await copyOf(F, U3_SALSA);
		expect(sourcesOf(db, 'u2', 'figure', C).map((s) => s.id)).toEqual([C, F]);
		expect(sourcesOf(db, 'u2', 'figure', F).map((s) => s.id)).toEqual([C, F]);
		// Nor is it a way in: u2 asking about u3's copy learns nothing.
		expect(sourcesOf(db, 'u2', 'figure', u3s)).toEqual([]);
	});

	it('other groups by name, then twins; an archived copy is no tab', async () => {
		joinTeam(db, 'u2', 2, T);
		const { F, C } = await setenta();
		const rueda = await copyOf(F, T2_SALSA);
		publishedWith(T2_SALSA, rueda);
		const twin = figure(U2_SALSA, 'Enchufla', 'Doble');
		expect(markTwins(db, U2_SALSA, 'figure', [C, twin])).toBe(true);

		const tabs = sourcesOf(db, 'u2', 'figure', C);
		expect(tabs.map((s) => [s.label, s.relation])).toEqual([
			['Yours', 'self'],
			['Rueda club', 'clone'],
			['Salsa Tuesdays', 'clone'],
			['Yours 2', 'twin']
		]);
		expect(tabs[3]).toMatchObject({ id: twin, status: null, changed: [] });
		expect(cloneLineOf(db, 'u2', 'figure', C)).toEqual({
			kind: 'figure',
			self: { kind: 'mine' },
			clonedFrom: 'Salsa Tuesdays',
			groups: 2,
			twins: 1
		});

		db.update(figures).set({ archivedAt: T }).where(eq(figures.id, rueda)).run();
		expect(sourcesOf(db, 'u2', 'figure', C).map((s) => s.label)).not.toContain('Rueda club');
	});

	it('vs: only the person’s own member of the family, on a page that is not theirs', async () => {
		const { F, C } = await setenta();
		expect(sourcesView(db, 'u2', 'figure', F, String(C)).vs).toBe(C);
		expect(sourcesView(db, 'u2', 'figure', F, String(F)).vs).toBeNull();
		expect(sourcesView(db, 'u2', 'figure', F, 'junk').vs).toBeNull();
		expect(sourcesView(db, 'u2', 'figure', F, null).vs).toBeNull();
		expect(sourcesView(db, 'u2', 'figure', C, String(C)).vs).toBeNull();
		expect(sourcesView(db, 'u2', 'figure', F, String(C)).mineId).toBe(C);
	});

	it('vs: never on a group’s tab its editor opens (it is no read-only source to them)', async () => {
		const { F } = await setenta();
		const mine = await copyOf(F, { userId: 'u1', dance: 'salsa' });
		expect(sourcesView(db, 'u1', 'figure', F, String(mine)).vs).toBeNull();
	});

	it('compare: the banner on your copy once its group’s source moved, never on the source', async () => {
		const { F, C } = await setenta();
		expect(sourcesView(db, 'u2', 'figure', C).compare).toBeNull();
		db.update(figures).set({ startCount: 3 }).where(eq(figures.id, F)).run();
		recording(F, 'second.mp4');
		expect(sourcesView(db, 'u2', 'figure', C).compare).toEqual({
			id: F,
			place: 'Salsa Tuesdays',
			changed: ['Timing', '1 recording']
		});
		// The group's page (u2 only reads it), and a copy only yours changed, get none.
		expect(sourcesView(db, 'u2', 'figure', F).compare).toBeNull();
		db.update(figures).set({ startCount: 1 }).where(eq(figures.id, F)).run();
		db.delete(recordings).where(eq(recordings.figureId, F)).run();
		db.update(figures).set({ notes: 'mine' }).where(eq(figures.id, C)).run();
		expect(sourcesView(db, 'u2', 'figure', C).compare).toBeNull();
	});
});

describe('takeRecording', () => {
	it('copies one recording into your figure, once, charged to you', async () => {
		const { F, C } = await setenta();
		const second = recording(F, 'second.mp4', 70);
		const before = usedBytesOf(db, { userId: 'u2' });
		const f = fakeFiles();

		const r = await takeRecording(db, U2_SALSA, C, second, f.files, NOW, ROOMY);
		expect(r).toMatchObject({ ok: true, id: C });
		expect(f.linked).toEqual([['recording', 'second.mp4']]);
		expect(f.unlinked).toEqual([]);
		const mine = recsOf(C);
		expect(mine).toHaveLength(1);
		expect(mine[0]).toMatchObject({ file: 'copy-second.mp4', clonedFrom: second, sizeBytes: 70 });
		expect(mine[0].geneId).toBe(geneOf(db, 'recording', second));
		expect(usedBytesOf(db, { userId: 'u2' })).toBe(before + 70);
		// Now in step: the group's tab no longer counts it.
		expect(sourcesOf(db, 'u2', 'figure', C)[1]).toMatchObject({ status: 'same', changed: [] });

		const again = fakeFiles();
		const twice = await takeRecording(db, U2_SALSA, C, second, again.files, NOW, ROOMY);
		expect(twice).toMatchObject({ ok: false, reason: 'held' });
		expect(again.linked).toEqual([]);
		expect(recsOf(C)).toHaveLength(1);
	});

	it('a recording left behind at copy time leaves the pair’s skip when taken', async () => {
		const { F, C, first } = await setenta();
		const piece = `rec:${geneOf(db, 'recording', first)}`;
		expect(pairBase(db, 'figure', F, C)!.skip).toEqual([piece]);
		const r = await takeRecording(db, U2_SALSA, C, first, fakeFiles().files, NOW, ROOMY);
		expect(r.ok).toBe(true);
		const base = pairBase(db, 'figure', F, C)!;
		expect(base.skip).toEqual([]);
		expect(Object.keys(base.fields)).toContain(piece);
	});

	it('brings its sections and their links, mapped to your side', async () => {
		const { F, C } = await setenta();
		const rec = recording(F, 'second.mp4');
		const spot = addSpot(
			db,
			{ recordingId: rec },
			{ startMs: 0, endMs: 4000, label: 'Turn' },
			'u1'
		)!;
		linkInSpace(db, T1_SALSA, spot.id, { figureId: F });

		const r = await takeRecording(db, U2_SALSA, C, rec, fakeFiles().files, NOW, ROOMY);
		expect(r.ok).toBe(true);
		const mine = recsOf(C)[0];
		const spots = db.select().from(videoSpots).where(eq(videoSpots.recordingId, mine.id)).all();
		expect(spots).toHaveLength(1);
		// The section linked the group's figure: on your side it links your copy.
		expect(
			db.select().from(spotLinks).where(eq(spotLinks.spotId, spots[0].id)).all()
		).toMatchObject([{ figureId: C }]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('refused for room, linking nothing', async () => {
		const { F, C } = await setenta();
		const rec = recording(F, 'big.mp4', 5000);
		setStorageLimit(db, 'u2', 1000);
		const f = fakeFiles();
		const r = await takeRecording(db, U2_SALSA, C, rec, f.files, NOW, ROOMY);
		expect(r).toMatchObject({ ok: false, reason: 'room' });
		expect(f.linked).toEqual([]);
		expect(recsOf(C)).toEqual([]);
	});

	it('denied: not your figure, not its family, a recording you cannot read', async () => {
		const { F, C } = await setenta();
		const rec = recording(F, 'second.mp4');
		const other = figure(U2_SALSA, 'Enchufla');
		const files = fakeFiles().files;
		// Into a figure of yours of another family.
		expect(await takeRecording(db, U2_SALSA, other, rec, files, NOW, ROOMY)).toEqual({
			ok: false,
			reason: 'denied'
		});
		// Into someone else's copy.
		const u3s = await copyOf(F, U3_SALSA);
		expect((await takeRecording(db, U2_SALSA, u3s, rec, files, NOW, ROOMY)).ok).toBe(false);
		// From a group figure u2 does not read.
		const hidden = figure(T2_SALSA, 'Setenta');
		const hiddenRec = recording(hidden, 'hidden.mp4');
		expect((await takeRecording(db, U2_SALSA, C, hiddenRec, files, NOW, ROOMY)).ok).toBe(false);
		// A missing recording.
		expect((await takeRecording(db, U2_SALSA, C, 9999, files, NOW, ROOMY)).ok).toBe(false);
		expect(recsOf(C)).toEqual([]);
	});
});
