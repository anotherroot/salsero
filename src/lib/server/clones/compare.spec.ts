/**
 * Compare and Take theirs (board C2 p3): a person's copy beside the group's
 * member it came from, field by field since the pair was last in step; Take
 * brings the picked fields in place, refuses a stale or unpicked sheet, and
 * in a group logs once and reconciles members' entries after a delete.
 * Files are fakes; the database is in memory.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { figures, recordings, teamChanges, users } from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { addRecording, createFigure, updateVariation } from '../figures';
import { createLesson, linkFigure, publishLesson, unlinkFigure } from '../lessons';
import { addLesson, entryFor } from '../entries';
import { seedPositions } from '../test-positions';
import type { Space } from '../scope';
import { T1_SALSA, T2_SALSA, U1_SALSA, U2_SALSA } from '../test-walls';
import type { CloneKind, Picks } from '$lib/types';
import { diffTag } from '$lib/clones/view';
import { geneOf } from './genes';
import { pairAt } from './pairs';
import { cloneInto } from './clone';
import type { CloneFileKind, CloneFiles } from './files';
import { compareWith, takeTheirs } from './compare';

const T = Date.UTC(2026, 10, 3, 20);
const NOW = T + 1000;
const ROOMY = 1024 ** 4;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	seedPositions(db);
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' },
			{ id: 'u3', email: 'u3@x.si', passwordHash: 'x', firstName: 'Maja' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
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

const recording = (figureId: number, file: string) =>
	addRecording(
		db,
		{ figureId, file, mime: 'video/mp4', kind: 'video', sizeBytes: 50, note: null },
		'u1'
	).id;

async function copy(kind: CloneKind, id: number, into: Space) {
	const r = await cloneInto(db, { kind, id, into, recordings: false }, fakeFiles().files, T);
	if (!r.ok) throw new Error(`copy refused: ${r.reason}`);
	return r.id;
}

/** Salsa Tuesdays' Setenta · Básico (F), published, with a recording; u2's copy (C), without it. */
async function setenta() {
	const F = createFigure(db, T1_SALSA, { figureName: 'Setenta', name: 'Básico', ...shape })!.figure
		.id;
	recording(F, 'first.mp4');
	const lesson = createLesson(db, T1_SALSA, {
		lessonDay: '2026-11-01',
		title: 'Week 4',
		notes: null
	}).lesson.id;
	linkFigure(db, lesson, F, 'u1');
	publishLesson(db, T1_SALSA, lesson, T);
	addLesson(db, 'u2', lesson, { lesson: true, figureIds: [F], routineIds: [], drillIds: [] }, T);
	const C = await copy('figure', F, U2_SALSA);
	return { F, C, lesson };
}

/**
 * Board C2 p3: since u2 took it, the group moved the timing, added a
 * recording, and both sides rewrote the notes.
 */
async function boardCase() {
	const w = await setenta();
	db.update(figures).set({ startCount: 3 }).where(eq(figures.id, w.F)).run();
	db.update(figures).set({ notes: 'Lead early' }).where(eq(figures.id, w.F)).run();
	const second = recording(w.F, 'second.mp4');
	updateVariation(db, w.C, { name: 'Básico', ...shape, notes: 'Mine: slow down' });
	return { ...w, second, recKey: `rec:${geneOf(db, 'recording', second) ?? `#${second}`}` };
}

describe('compareWith', () => {
	it('the board’s case: Only theirs changed, Both changed: pick, New on theirs', async () => {
		const { F, C, recKey } = await boardCase();
		const c = compareWith(db, 'u2', 'figure', C, F)!;
		expect(c.diffs.map((d) => [d.key, diffTag(d)])).toEqual([
			['notes', 'Both changed: pick'],
			['timing', 'Only theirs changed'],
			[recKey, 'New on theirs']
		]);
		expect(c.picks).toEqual({ timing: 'theirs', [recKey]: 'theirs' });
		expect(c).toMatchObject({ synced: true, canTake: true, canSend: false });
	});

	it('is null for a row of another family, or one the person cannot read', async () => {
		const { F, C } = await setenta();
		const other = createFigure(db, T1_SALSA, { figureName: 'Dile', name: 'Que no', ...shape })!
			.figure.id;
		expect(compareWith(db, 'u2', 'figure', C, other)).toBeNull();
		expect(compareWith(db, 'u3', 'figure', C, F)).toBeNull();
		expect(compareWith(db, 'u2', 'figure', C, C)).toBeNull();
	});

	it('a pair never in step asks for every difference', async () => {
		const { F } = await setenta();
		createTeam(db, 'u1', 'salsa', 'Rueda club', T);
		const mine = await copy('figure', F, U1_SALSA);
		const rueda = await copy('figure', F, T2_SALSA);
		updateVariation(db, rueda, { name: 'Básico', ...shape, notes: 'Rueda calls' }, 'u1');
		const c = compareWith(db, 'u1', 'figure', mine, rueda)!;
		expect(c.synced).toBe(false);
		expect(c.diffs.map((d) => [d.key, d.side])).toEqual([['notes', 'both']]);
		expect(c.picks).toEqual({});
		expect(c).toMatchObject({ canTake: true, canSend: true });
		// u2 reads the group's, never another person's own copy.
		expect(compareWith(db, 'u2', 'figure', F, mine)).toBeNull();
	});
});

describe('takeTheirs', () => {
	it('notes kept, timing and the recording taken: the next compare differs only in notes, mine', async () => {
		const { F, C, recKey } = await boardCase();
		const c = compareWith(db, 'u2', 'figure', C, F)!;
		expect(c.picks[recKey]).toBe('theirs'); // the recording is taken by default
		const { files, linked } = fakeFiles();
		const res = await takeTheirs(
			db,
			'u2',
			'figure',
			C,
			F,
			{ ...c.picks, notes: 'mine' },
			c.seen,
			files,
			NOW,
			ROOMY
		);
		expect(res).toEqual({ ok: true });
		expect(linked).toEqual([['recording', 'second.mp4']]);

		const row = db.select().from(figures).where(eq(figures.id, C)).get()!;
		expect(row).toMatchObject({ startCount: 3, notes: 'Mine: slow down', userId: 'u2' });
		expect(db.select().from(recordings).where(eq(recordings.figureId, C)).all()).toHaveLength(1);
		const next = compareWith(db, 'u2', 'figure', C, F)!;
		expect(next.diffs.map((d) => [d.key, d.side])).toEqual([['notes', 'mine']]);
	});

	it('refuses a stale sheet, an unpicked both-changed field, and someone who only reads', async () => {
		const { F, C } = await boardCase();
		const c = compareWith(db, 'u2', 'figure', C, F)!;
		const { files } = fakeFiles();
		const take = (picks: Picks = { ...c.picks, notes: 'mine' }, seen = c.seen, who = 'u2') =>
			takeTheirs(db, who, 'figure', C, F, picks, seen, files, NOW, ROOMY);

		expect(await take(c.picks)).toEqual({
			ok: false,
			reason: 'pick',
			message: 'Pick yours or theirs where both changed.'
		});
		expect(await take(undefined, undefined, 'u1')).toMatchObject({ ok: false, reason: 'denied' });
		updateVariation(db, C, { name: 'Básico', ...shape, notes: 'Changed again' });
		expect(await take()).toEqual({
			ok: false,
			reason: 'stale',
			message: 'Changed since you opened this. Compare again.'
		});
		expect(db.select().from(figures).where(eq(figures.id, C)).get()!.startCount).toBe(1);
	});

	it('into a group’s member, as its editor: one `change` by u1, in place', async () => {
		const { F } = await setenta();
		const mine = await copy('figure', F, U1_SALSA);
		updateVariation(db, mine, { name: 'Básico', ...shape, notes: 'Hips first' });
		const c = compareWith(db, 'u1', 'figure', F, mine)!;
		expect(c.diffs.map((d) => [d.key, d.side])).toEqual([['notes', 'theirs']]);
		const before = db.select().from(teamChanges).all().length;

		const res = await takeTheirs(
			db,
			'u1',
			'figure',
			F,
			mine,
			c.picks,
			c.seen,
			fakeFiles().files,
			NOW,
			ROOMY
		);
		expect(res).toEqual({ ok: true });
		const lines = db.select().from(teamChanges).all().slice(before);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({ verb: 'change', actorId: 'u1', rootKind: 'figure' });
		expect(db.select().from(figures).where(eq(figures.id, F)).get()!.notes).toBe('Hips first');
	});

	it('a ticked removal on theirs’ side runs reconcileEntries: the member’s entry goes', async () => {
		const { F, lesson } = await setenta();
		expect(entryFor(db, 'u2', { figureId: F })?.archivedAt).toBeNull();
		// u1's own copy of the lesson, without Setenta: Take it into the group's.
		const mine = await copy('lesson', lesson, U1_SALSA);
		const myF = db.select({ id: figures.id }).from(figures).where(eq(figures.userId, 'u1')).get()!
			.id;
		unlinkFigure(db, mine, myF, false, T, 'u1');
		const c = compareWith(db, 'u1', 'lesson', lesson, mine)!;
		const [removal] = c.diffs;
		expect(removal).toMatchObject({ side: 'theirs', removal: true });
		expect(c.picks[removal.key]).toBe('mine'); // never preselected

		const res = await takeTheirs(
			db,
			'u1',
			'lesson',
			lesson,
			mine,
			{ ...c.picks, [removal.key]: 'theirs' },
			c.seen,
			fakeFiles().files,
			NOW,
			ROOMY
		);
		expect(res).toEqual({ ok: true });
		expect(entryFor(db, 'u2', { figureId: F })?.archivedAt).not.toBeNull();
	});

	it('a person’s deleted recording’s file is unlinked once the take lands', async () => {
		const { F, C } = await setenta();
		const own = recording(C, 'own.mp4');
		const c = compareWith(db, 'u2', 'figure', C, F)!;
		const key = `rec:#${own}`;
		expect(c.diffs.map((d) => d.key)).toEqual([key]);
		const { files, unlinked } = fakeFiles();
		const res = await takeTheirs(
			db,
			'u2',
			'figure',
			C,
			F,
			{ [key]: 'theirs' },
			c.seen,
			files,
			NOW,
			ROOMY
		);
		expect(res).toEqual({ ok: true });
		expect(unlinked).toEqual([['recording', 'own.mp4']]);
	});

	it('re-checks what you saw inside the write: a save landing while files link makes it stale', async () => {
		const { F, C, recKey } = await boardCase();
		const c = compareWith(db, 'u2', 'figure', C, F)!;
		const unlinked: [CloneFileKind, string][] = [];
		const files: CloneFiles = {
			async link(_kind, file) {
				// Another tab saves the copy meanwhile.
				db.update(figures).set({ notes: 'Saved meanwhile' }).where(eq(figures.id, C)).run();
				return `copy-${file}`;
			},
			async unlink(kind, file) {
				unlinked.push([kind, file]);
			}
		};
		const res = await takeTheirs(
			db,
			'u2',
			'figure',
			C,
			F,
			{ ...c.picks, notes: 'mine' },
			c.seen,
			files,
			NOW,
			ROOMY
		);
		expect(res).toEqual({
			ok: false,
			reason: 'stale',
			message: 'Changed since you opened this. Compare again.'
		});
		expect(c.picks[recKey]).toBe('theirs');
		expect(db.select().from(figures).where(eq(figures.id, C)).get()).toMatchObject({
			startCount: 1,
			notes: 'Saved meanwhile'
		});
		expect(db.select().from(recordings).where(eq(recordings.figureId, C)).all()).toEqual([]);
		expect(unlinked).toEqual([['recording', 'copy-second.mp4']]);
	});

	it('a take with nothing picked theirs does nothing: no History line, the snapshot as it was', async () => {
		const { F } = await setenta();
		const mine = await copy('figure', F, U1_SALSA);
		updateVariation(db, mine, { name: 'Básico', ...shape, notes: 'Hips first' });
		const c = compareWith(db, 'u1', 'figure', F, mine)!;
		const lines = db.select().from(teamChanges).all().length;
		const at = pairAt(db, 'figure', F, mine);
		const res = await takeTheirs(
			db,
			'u1',
			'figure',
			F,
			mine,
			{ notes: 'mine' },
			c.seen,
			fakeFiles().files,
			NOW,
			ROOMY
		);
		expect(res).toEqual({ ok: true });
		expect(db.select().from(teamChanges).all()).toHaveLength(lines);
		expect(pairAt(db, 'figure', F, mine)).toBe(at);
		expect(compareWith(db, 'u1', 'figure', F, mine)!.diffs.map((d) => d.side)).toEqual(['theirs']);
	});
});
