/**
 * Sync (`syncView`, `syncAll`): one merge across every copy a person reads,
 * landed on every ticked copy they edit. Ana (u1) has her own Enchufla · Basic
 * (T), copied into Salsa Tuesdays (G1) and Rueda club (G2), both hers. Luka
 * (u2) is a plain member of G1, reads G1's copy through a published lesson,
 * and made it his own (F2, Make it mine). Files are fakes; the database is in
 * memory.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { clonePairs, figures, recordings, teamChanges, users } from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { addRecording, createFigure, updateVariation } from '../figures';
import { createLesson, linkFigure, publishLesson } from '../lessons';
import { addLinks } from '../links';
import { crossRefs, familyIntegrity } from '../integrity';
import type { Space } from '../scope';
import { T1_SALSA, T2_SALSA, U1_SALSA, U2_SALSA } from '../test-walls';
import type { MergeRow } from '$lib/types';
import { cloneInto } from './clone';
import { makeMine } from './edit';
import type { CloneFiles } from './files';
import { digest, hashValue, pairBase } from './pairs';
import { flatOf } from './trees';
import { readMark } from './marks';
import { setSyncSettings } from './sync-settings';
import { DEFAULT_SYNC } from '$lib/clones/sync';
import { syncAll, syncView } from './sync';

const T0 = Date.UTC(2026, 10, 7, 12);
const NOW = T0 + 1000;
const ROOMY = 1024 ** 4;
const URL_A = 'https://example.org/a';

let db: Db;
let named = 0;
const files: CloneFiles = {
	async link(_kind, file) {
		await Promise.resolve();
		return `copy-${++named}-${file}`;
	},
	async unlink() {}
};

let T: number;
let G1: number;
let G2: number;
let F2: number;

async function copy(id: number, into: Space) {
	const r = await cloneInto(db, { kind: 'figure', id, into, recordings: false }, files, T0);
	if (!r.ok) throw new Error(`copy refused: ${r.reason}`);
	return r.id;
}

beforeEach(async () => {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T0);
	createTeam(db, 'u1', 'salsa', 'Rueda club', T0);
	joinTeam(db, 'u2', 1, T0);
	T = createFigure(db, U1_SALSA, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: 'Old notes'
	})!.figure.id;
	addLinks(db, { figureId: T }, [URL_A], null);
	G1 = await copy(T, T1_SALSA);
	G2 = await copy(T, T2_SALSA);
	const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-04', title: 'Week 1', notes: null })
		.lesson.id;
	expect(linkFigure(db, L, G1, 'u1')).toBe(true);
	expect(publishLesson(db, T1_SALSA, L, T0)).toBe(true);
	const mine = await makeMine(db, U2_SALSA, 'figure', G1, files, T0, ROOMY);
	if (!mine.ok) throw new Error(`make it mine refused: ${mine.reason}`);
	F2 = mine.id;
});

const row = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;
const save = (id: number, patch: { name?: string; notes?: string | null }, by = 'u1') => {
	const r = row(id);
	expect(
		updateVariation(
			db,
			id,
			{
				name: patch.name ?? r.name,
				partner: r.partner as 'partner',
				style: r.styleTag ?? 'salsa',
				notes: patch.notes === undefined ? r.notes : patch.notes
			},
			by
		)
	).not.toBeNull();
};
const setStart = (id: number, startCount: number) =>
	db.update(figures).set({ startCount }).where(eq(figures.id, id)).run();
const flat = (id: number) => flatOf(db, 'figure', id);
const rowOf = (rows: MergeRow[], key: string) => rows.find((r) => r.key === key)!;
/** The hash of the value `holder` holds in a row: what a pick names. */
const valueOf = (r: MergeRow, holder: number) => r.values.find((v) => v.holders.includes(holder))!;
const fresh = (a: number, b: number) => {
	const fields: Record<string, string> = {};
	for (const [k, f] of Object.entries(flat(a))) fields[k] = hashValue(f.value);
	expect(pairBase(db, 'figure', a, b)?.fields).toEqual(fields);
};
const sync = (
	actor: string,
	id: number,
	picks: Record<string, string | null>,
	targets: { id: number; seen: string }[]
) => syncAll(db, actor, 'figure', id, picks, targets, files, NOW, ROOMY);
const ticked = (actor: string, id: number) =>
	syncView(db, actor, 'figure', id)!.targets.map((t) => ({ id: t.id, seen: t.seen }));
const integrity = () => {
	expect(crossRefs(db)).toEqual([]);
	expect(familyIntegrity(db)).toEqual([]);
};

describe('syncView', () => {
	it('Ana: every copy she reads, her three to sync to, the page first', () => {
		save(G1, { notes: 'Club notes' });
		const view = syncView(db, 'u1', 'figure', G1)!;
		expect(view.mode).toBe('sync');
		expect(view.title).toBe('Sync Enchufla · Basic');
		expect(view.targets.map((t) => [t.id, t.label, t.role, t.ticked])).toEqual([
			[G1, 'Salsa Tuesdays', 'this one', true],
			[T, 'Yours', '', true],
			[G2, 'Rueda club', 'owner', true]
		]);
		expect(view.targets[0].seen).toBe(digest(flat(G1)));
		expect(view.members.map((m) => m.id)).toEqual([G1, T, G2]);
		expect(view.rows.map((r) => r.key)).toEqual(['notes']);
		// Luka's own copy is never among Ana's.
		expect(view.members.map((m) => m.id)).not.toContain(F2);
	});

	it('Luka, who only reads the club’s: Update from Salsa Tuesdays, his own copy only', () => {
		const view = syncView(db, 'u2', 'figure', F2)!;
		expect(view.mode).toBe('update');
		expect(view.title).toBe('Update from Salsa Tuesdays');
		expect(view.targets.map((t) => t.id)).toEqual([F2]);
		expect(view.members.map((m) => [m.id, m.label])).toEqual([
			[F2, 'Yours'],
			[G1, 'Salsa Tuesdays']
		]);
		// From the club's page too: his own copy is the target.
		expect(syncView(db, 'u2', 'figure', G1)!.targets.map((t) => t.id)).toEqual([F2]);
	});

	it('a recording a copy was made without is no row; the Sync does not ask about it', async () => {
		const own = createFigure(db, U1_SALSA, {
			figureName: 'Dile',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		addRecording(db, {
			figureId: own,
			file: 'a.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 50,
			note: null
		});
		const club = await copy(own, T1_SALSA); // recordings: false
		save(club, { notes: 'Club notes' });
		const view = syncView(db, 'u1', 'figure', own)!;
		expect(view.rows.map((r) => r.key)).toEqual(['notes']);
		const targets = view.targets.map((t) => ({ id: t.id, seen: t.seen }));
		expect(await syncAll(db, 'u1', 'figure', own, {}, targets, files, NOW, ROOMY)).toEqual({
			ok: true,
			refused: []
		});
		expect(row(own).notes).toBe('Club notes');
		expect(db.select().from(recordings).where(eq(recordings.figureId, club)).all()).toEqual([]);
		expect(syncView(db, 'u1', 'figure', own)!.rows).toEqual([]);
		integrity();
	});

	it('null for a row the person cannot read, or one with no other copy', () => {
		expect(syncView(db, 'u2', 'figure', T)).toBeNull();
		expect(syncView(db, 'u2', 'figure', G2)).toBeNull();
		const alone = createFigure(db, U1_SALSA, {
			figureName: 'Dile',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		expect(syncView(db, 'u1', 'figure', alone)).toBeNull();
	});
});

describe('syncAll', () => {
	it('the user’s story: T’s notes, G1’s timing, all three ticked → all equal, in step', async () => {
		save(T, { notes: 'Ana notes' });
		save(G1, { notes: 'Club notes' });
		setStart(G1, 3);
		const view = syncView(db, 'u1', 'figure', T)!;
		const notes = rowOf(view.rows, 'notes');
		expect(notes.pick).toBeUndefined(); // both changed: open
		expect(rowOf(view.rows, 'timing').pick).toBe(valueOf(rowOf(view.rows, 'timing'), G1).hash);
		const before = db.select().from(teamChanges).all().length;

		const res = await sync('u1', T, { notes: valueOf(notes, T).hash }, ticked('u1', T));
		expect(res).toEqual({ ok: true, refused: [] });
		for (const id of [T, G1, G2])
			expect(row(id)).toMatchObject({ notes: 'Ana notes', startCount: 3 });
		expect(digest(flat(G1))).toBe(digest(flat(T)));
		expect(digest(flat(G2))).toBe(digest(flat(T)));
		fresh(T, G1);
		fresh(T, G2);
		fresh(G1, G2);
		expect(syncView(db, 'u1', 'figure', T)!.rows).toEqual([]);
		// One History line per group copy written; marks are what each holds now.
		expect(db.select().from(teamChanges).all().length - before).toBe(2);
		for (const id of [T, G1, G2])
			expect(readMark(db, 'figure', id)).toEqual(
				Object.fromEntries(Object.entries(flat(id)).map(([k, f]) => [k, hashValue(f.value)]))
			);
		integrity();
	});

	it('every pick yours: the others take your values (Sync pushes)', async () => {
		save(T, { notes: 'Ana notes' });
		save(G1, { notes: 'Club notes' });
		setStart(G2, 5);
		const view = syncView(db, 'u1', 'figure', T)!;
		const picks = Object.fromEntries(view.rows.map((r) => [r.key, valueOf(r, T).hash]));
		expect(Object.keys(picks).sort()).toEqual(['notes', 'timing']);
		const res = await sync('u1', T, picks, ticked('u1', T));
		expect(res).toEqual({ ok: true, refused: [] });
		for (const id of [T, G1, G2])
			expect(row(id)).toMatchObject({ notes: 'Ana notes', startCount: 1 });
		fresh(G1, G2);
		integrity();
	});

	it('an open row refuses the whole Sync, writing nothing', async () => {
		save(T, { notes: 'Ana notes' });
		save(G1, { notes: 'Club notes' });
		const res = await sync('u1', T, {}, ticked('u1', T));
		expect(res).toMatchObject({ ok: false, reason: 'pick' });
		expect(row(G2).notes).toBe('Old notes');
		expect(row(G1).notes).toBe('Club notes');
	});

	it('a stale seen on G2 refuses G2 alone; the others land', async () => {
		save(G1, { notes: 'Club notes' });
		const targets = ticked('u1', T);
		save(G2, { name: 'Basic two' }); // after the sheet opened
		const res = await sync('u1', T, {}, targets);
		expect(res).toMatchObject({ ok: true, refused: [{ id: G2 }] });
		expect(row(T)).toMatchObject({ notes: 'Club notes', name: 'Basic' }); // nothing of G2's handed on
		expect(row(G2).notes).toBe('Old notes');
		fresh(T, G1);
		integrity();
	});

	it('a target the person does not edit is denied, and nothing lands', async () => {
		save(G1, { notes: 'Club notes' });
		const res = await sync('u2', F2, {}, [{ id: G1, seen: digest(flat(G1)) }]);
		expect(res).toMatchObject({ ok: false, reason: 'denied' });
		const mixed = await sync('u2', F2, {}, [
			{ id: F2, seen: digest(flat(F2)) },
			{ id: G1, seen: digest(flat(G1)) }
		]);
		expect(mixed).toMatchObject({ ok: false, reason: 'denied' });
		expect(row(F2).notes).toBe('Old notes');
		// Another person's own copy, from anywhere: the missing row's answer.
		expect(await sync('u2', T, {}, [{ id: F2, seen: digest(flat(F2)) }])).toMatchObject({
			ok: false,
			reason: 'denied'
		});
	});

	it('Update mine: Luka takes the club’s change; his own change stays and reads as his', async () => {
		save(G1, { notes: 'Club notes' });
		setStart(G1, 3);
		setStart(F2, 5); // his own timing, and the club changed it too: open
		const view = syncView(db, 'u2', 'figure', F2)!;
		expect(rowOf(view.rows, 'notes').pick).toBe(valueOf(rowOf(view.rows, 'notes'), G1).hash);
		const timing = rowOf(view.rows, 'timing');
		expect(timing.pick).toBeUndefined();

		const res = await sync('u2', F2, { timing: valueOf(timing, F2).hash }, ticked('u2', F2));
		expect(res).toEqual({ ok: true, refused: [] });
		expect(row(F2)).toMatchObject({ notes: 'Club notes', startCount: 5 });
		expect(row(G1)).toMatchObject({ notes: 'Club notes', startCount: 3 });
		// Resolved: next time his timing is his own change, preselected, not open.
		const again = syncView(db, 'u2', 'figure', F2)!;
		expect(again.rows.map((r) => r.key)).toEqual(['timing']);
		expect(again.rows[0].pick).toBe(valueOf(again.rows[0], F2).hash);
		expect(pairBase(db, 'figure', F2, G1)!.fields.notes).toBe(hashValue('Club notes'));
		integrity();
	});

	it('an unticked add lands nothing, and the pair keeps reading it as an add', async () => {
		const rec = addRecording(db, {
			figureId: T,
			file: 'a.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 50,
			note: null
		}).id;
		save(G1, { notes: 'Club notes' });
		const view = syncView(db, 'u1', 'figure', T)!;
		const add = view.rows.find((r) => r.kind === 'add')!;
		expect(add.pick).toBeNull(); // recordings and videos: off by default
		const res = await sync('u1', T, {}, ticked('u1', T));
		expect(res).toEqual({ ok: true, refused: [] });
		expect(db.select().from(recordings).where(eq(recordings.figureId, G1)).all()).toEqual([]);
		expect(row(T).notes).toBe('Club notes');
		// Not taken from either side: still an add, its box as before.
		expect(Object.hasOwn(pairBase(db, 'figure', T, G1)!.fields, add.key)).toBe(false);
		const again = syncView(db, 'u1', 'figure', T)!;
		expect(again.rows.map((r) => [r.key, r.kind, r.pick])).toEqual([[add.key, 'add', null]]);
		expect(rec).toBeGreaterThan(0);
		integrity();
	});

	it('a ticked recording lands on both clubs, its key renamed by the first copy’s stamp', async () => {
		expect(setSyncSettings(db, 'u1', 'figure', T, { ...DEFAULT_SYNC, media: true }, T0)).toBe(true);
		addRecording(db, {
			figureId: T,
			file: 'a.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 50,
			note: 'Slow'
		});
		const view = syncView(db, 'u1', 'figure', T)!;
		const add = view.rows.find((r) => r.kind === 'add')!;
		expect(add.key).toMatch(/^rec:#\d+$/);
		expect(add.pick).toBe(valueOf(add, T).hash);
		expect(await sync('u1', T, {}, ticked('u1', T))).toEqual({ ok: true, refused: [] });
		for (const id of [G1, G2]) {
			const recs = db.select().from(recordings).where(eq(recordings.figureId, id)).all();
			expect(recs.map((r) => r.note)).toEqual(['Slow']);
		}
		fresh(T, G1);
		fresh(T, G2);
		fresh(G1, G2);
		expect(syncView(db, 'u1', 'figure', T)!.rows).toEqual([]);
		integrity();
	});

	it('an old suffixed copy: Sync offers the plain name and drops the suffix', async () => {
		db.update(figures).set({ name: 'Basic (Salsa Tuesdays)' }).where(eq(figures.id, G1)).run();
		const view = syncView(db, 'u1', 'figure', T)!;
		const name = rowOf(view.rows, 'name');
		expect(name.pick).toBe(valueOf(name, T).hash);
		expect(await sync('u1', T, {}, ticked('u1', T))).toEqual({ ok: true, refused: [] });
		expect(row(G1).name).toBe('Basic');
		fresh(T, G1);
	});

	it('unticking a copy merges without sending to it; it then reads as behind', async () => {
		save(T, { notes: 'Ana notes' });
		save(G2, { notes: 'Rueda notes' });
		const view = syncView(db, 'u1', 'figure', T)!;
		const notes = rowOf(view.rows, 'notes');
		const targets = view.targets
			.filter((t) => t.id !== G2)
			.map((t) => ({ id: t.id, seen: t.seen }));
		const res = await sync('u1', T, { notes: valueOf(notes, T).hash }, targets);
		expect(res).toEqual({ ok: true, refused: [] });
		expect(row(G1).notes).toBe('Ana notes');
		expect(row(G2).notes).toBe('Rueda notes');
		// G2 was not written; the merge chose T's: G2 is behind, not "both changed".
		const again = syncView(db, 'u1', 'figure', T)!;
		const left = rowOf(again.rows, 'notes');
		expect(left.pick).toBe(valueOf(left, T).hash);
		expect(
			db
				.select()
				.from(clonePairs)
				.where(and(eq(clonePairs.kind, 'figure'), eq(clonePairs.aId, G1), eq(clonePairs.bId, G2)))
				.get()
		).toBeUndefined();
		integrity();
	});
});
