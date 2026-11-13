/**
 * Where copies stand (`stepStatus`, `outOfStep`, `copyCounts`). Ana (u1) has her own
 * Enchufla · Basic (T), copied into Salsa Tuesdays (G1) and Rueda club (G2),
 * both hers. Luka (u2) is a plain member of G1 and made it his own (F2).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { figures, links, users } from '../db/schema';
import { addLinks, deleteLink } from '../links';
import { createTeam, joinTeam } from '../teams';
import { addRecording, createFigure, updateVariation } from '../figures';
import { createLesson, linkFigure, publishLesson } from '../lessons';
import type { Space } from '../scope';
import { T1_SALSA, T2_SALSA, U1_SALSA, U2_SALSA } from '../test-walls';
import { cloneInto } from './clone';
import { makeMine } from './edit';
import type { CloneFiles } from './files';
import { DEFAULT_SYNC } from '$lib/clones/sync';
import { setSyncSettings } from './sync-settings';
import { copyCounts, keepView, outOfStep, stepStatus } from './step';

const T0 = Date.UTC(2026, 10, 7, 12);
const ROOMY = 1024 ** 4;

let db: Db;
let named = 0;
const files: CloneFiles = {
	async link(_kind, file) {
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
const mk = (name: string, figureName = 'Enchufla') =>
	createFigure(db, U1_SALSA, {
		figureName,
		name,
		partner: 'partner',
		style: 'salsa',
		notes: 'Old notes'
	})!.figure.id;

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
	T = mk('Basic');
	G1 = await copy(T, T1_SALSA);
	G2 = await copy(T, T2_SALSA);
	const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-04', title: 'Week 1', notes: null })
		.lesson.id;
	linkFigure(db, L, G1, 'u1');
	publishLesson(db, T1_SALSA, L, T0);
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
const recording = (figureId: number) =>
	addRecording(
		db,
		{
			figureId,
			file: `r${figureId}.mp4`,
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 50,
			note: null
		},
		'u1'
	);

describe('stepStatus', () => {
	it('copies that agree: no lines', () => {
		expect(stepStatus(db, 'u1', 'figure', T)).toEqual({ lines: [], sending: 0 });
	});

	it('G1 changed timing, G2 behind on notes and a recording: two lines', () => {
		setSyncSettings(db, 'u1', 'figure', T, { ...DEFAULT_SYNC, media: true }, T0);
		setStart(G1, 3);
		save(T, { notes: 'New notes' });
		recording(T);
		const { lines } = stepStatus(db, 'u1', 'figure', T);
		// G1 changed timing AND is behind on the rest; G2 is only behind. Most urgent first.
		expect(lines.map((l) => [l.id, l.state])).toEqual([
			[G1, 'changed'],
			[G2, 'behind'], // places in order within a state: Rueda club, Salsa Tuesdays
			[G1, 'behind']
		]);
		expect(lines[0]).toMatchObject({ place: 'Salsa Tuesdays', fields: ['Timing'] });
		expect(lines[1]).toMatchObject({ place: 'Rueda club' });
		// The notice's words: root fields by label, pieces counted.
		expect(lines[1].fields).toEqual(['Notes', '1 recording']);
		expect(lines[2].fields).toEqual(lines[1].fields);
	});

	it('one member in two states gives two lines, counted as one copy', () => {
		save(T, { notes: 'Ana notes' });
		setStart(G1, 3);
		const { lines } = stepStatus(db, 'u1', 'figure', T);
		expect(lines.filter((l) => l.id === G1).map((l) => l.state)).toEqual(['changed', 'behind']);
		expect(outOfStep(db, 'u1', 'figure', [T]).get(T)).toBe(2); // G1 and G2, not three lines
	});

	it('a person who edits no live copy of the family gets no lines and no count', async () => {
		// Luka reads the club's copy only; make a second club copy he reads too, differing.
		const LU = createLesson(db, T2_SALSA, { lessonDay: '2026-11-05', title: 'Week 2', notes: null })
			.lesson.id;
		linkFigure(db, LU, G2, 'u1');
		publishLesson(db, T2_SALSA, LU, T0);
		joinTeam(db, 'u2', 2, T0);
		await db.delete(figures).where(eq(figures.id, F2)).run();
		save(G1, { notes: 'One' });
		save(G2, { notes: 'Two' });
		expect(stepStatus(db, 'u2', 'figure', G1)).toEqual({ lines: [], sending: 0 });
		expect(outOfStep(db, 'u2', 'figure', [G1, G2])).toEqual(new Map());
		// Ana, who edits them, is told.
		expect(stepStatus(db, 'u1', 'figure', G1).lines.length).toBeGreaterThan(0);
	});

	it('both changed the notes: both', () => {
		save(T, { notes: 'Ana notes' });
		save(G1, { notes: 'Club notes' });
		const { lines } = stepStatus(db, 'u1', 'figure', T);
		expect(lines.find((l) => l.id === G1)).toMatchObject({ state: 'both', fields: ['Notes'] });
	});

	it('a copy added a recording the page’s options do not carry: held', () => {
		recording(G1); // media off by default
		const { lines } = stepStatus(db, 'u1', 'figure', T);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({
			id: G1,
			state: 'held',
			how: 'added',
			fields: ['1 recording']
		});
	});

	it('a copy removed a link: held, removed (a removal starts unticked)', async () => {
		const D = mk('Doble', 'Dile');
		addLinks(db, { figureId: D }, ['https://example.org/doble'], 'Doble', 'u1');
		const C = await copy(D, T1_SALSA);
		const [link] = db.select().from(links).where(eq(links.figureId, C)).all();
		expect(deleteLink(db, { figureId: C }, link.id, 'u1')).toBe(true);
		expect(stepStatus(db, 'u1', 'figure', D).lines).toEqual([
			{ id: C, place: 'Salsa Tuesdays', state: 'held', how: 'removed', fields: ['1 link'] }
		]);
	});

	it('Luka, who only reads the club’s: its copy behind his is no line', () => {
		save(F2, { notes: 'Luka notes' }, 'u2');
		expect(stepStatus(db, 'u2', 'figure', F2)).toEqual({ lines: [], sending: 0 });
		// Ana, who edits both, is told the club is behind.
		expect(stepStatus(db, 'u1', 'figure', G1).lines).toEqual([]); // her view never shows Luka's copy
	});

	it('Luka sees the club’s change to a field he did not touch', () => {
		save(F2, { notes: 'Luka notes' }, 'u2');
		setStart(G1, 3);
		const { lines } = stepStatus(db, 'u2', 'figure', F2);
		expect(lines).toEqual([
			expect.objectContaining({ id: G1, state: 'changed', fields: ['Timing'] })
		]);
	});

	it('Luka on the club’s page: his own change is no line, the club’s is', () => {
		save(F2, { notes: 'Luka notes' }, 'u2');
		// His own deliberate change: nothing for Update mine to bring, so no line.
		expect(stepStatus(db, 'u2', 'figure', G1)).toEqual({ lines: [], sending: 0 });
		// The club's own change still shows: his copy is behind it.
		setStart(G1, 3);
		expect(stepStatus(db, 'u2', 'figure', G1).lines).toEqual([
			expect.objectContaining({ id: F2, state: 'behind', fields: ['Timing'] })
		]);
	});

	it('a copy that differs only by a name suffix: no line', async () => {
		const old = mk('Basic (Sreda 17:30)', 'Dile');
		const club = await copy(old, T1_SALSA);
		save(club, { name: 'Basic' });
		expect(row(club).name).toBe('Basic');
		expect(stepStatus(db, 'u1', 'figure', old)).toEqual({ lines: [], sending: 0 });
		expect(stepStatus(db, 'u1', 'figure', club)).toEqual({ lines: [], sending: 0 });
	});
});

describe('stepStatus while the device has changes on their way', () => {
	it('copies behind on what the flow carries: no lines, counted as sending', () => {
		save(T, { notes: 'New notes' });
		expect(stepStatus(db, 'u1', 'figure', T).lines.map((l) => l.state)).toEqual([
			'behind',
			'behind'
		]);
		expect(stepStatus(db, 'u1', 'figure', T, true)).toEqual({ lines: [], sending: 2 });
		// The Moves lists count them neither.
		expect(outOfStep(db, 'u1', 'figure', [T], true)).toEqual(new Map());
	});

	it('the page’s switch off: nothing flows, the lines stay', () => {
		setSyncSettings(db, 'u1', 'figure', T, { ...DEFAULT_SYNC, on: false }, T0);
		save(T, { notes: 'New notes' });
		const s = stepStatus(db, 'u1', 'figure', T, true);
		expect(s.sending).toBe(0);
		expect(s.lines).toHaveLength(2);
	});

	it('a copy whose switch is off keeps its line; the other is sending', () => {
		setSyncSettings(db, 'u1', 'figure', G2, { ...DEFAULT_SYNC, on: false }, T0);
		save(T, { notes: 'New notes' });
		const s = stepStatus(db, 'u1', 'figure', T, true);
		expect(s.sending).toBe(1);
		expect(s.lines).toEqual([expect.objectContaining({ id: G2, state: 'behind' })]);
		expect(outOfStep(db, 'u1', 'figure', [T], true).get(T)).toBe(1);
	});

	it('what a copy’s options keep out (a recording, media off) stays a line', () => {
		recording(T);
		const s = stepStatus(db, 'u1', 'figure', T, true);
		expect(s.sending).toBe(0);
		expect(s.lines.map((l) => [l.id, l.fields])).toEqual([
			[G2, ['1 recording']],
			[G1, ['1 recording']]
		]);
	});

	it('a link removed for a recording the copy keeps out is held back with it', async () => {
		const D = mk('Doble', 'Dile');
		addLinks(db, { figureId: D }, ['https://example.org/doble'], 'Doble', 'u1');
		const C = await copy(D, T1_SALSA);
		const [link] = db.select().from(links).where(eq(links.figureId, D)).all();
		// The link became a recording: removed, and a recording added (media off on C).
		expect(deleteLink(db, { figureId: D }, link.id, 'u1')).toBe(true);
		recording(D);
		const s = stepStatus(db, 'u1', 'figure', D, true);
		expect(s.sending).toBe(0);
		expect(s.lines).toEqual([
			expect.objectContaining({ id: C, state: 'behind', fields: ['1 recording', '1 link'] })
		]);
		// Without the recording the removal flows by itself.
		const E = mk('Doble', 'Paseo');
		addLinks(db, { figureId: E }, ['https://example.org/paseo'], 'Paseo', 'u1');
		await copy(E, T1_SALSA);
		const [l2] = db.select().from(links).where(eq(links.figureId, E)).all();
		expect(deleteLink(db, { figureId: E }, l2.id, 'u1')).toBe(true);
		expect(stepStatus(db, 'u1', 'figure', E, true)).toEqual({ lines: [], sending: 1 });
	});

	it('a copy’s own change is never on its way: changed and both stay', () => {
		save(T, { notes: 'Ana notes' });
		save(G1, { notes: 'Club notes' });
		setStart(G2, 3);
		const s = stepStatus(db, 'u1', 'figure', T, true);
		expect(s.lines.map((l) => [l.id, l.state])).toEqual([
			[G1, 'both'],
			[G2, 'changed']
		]);
		// G2 is behind on the notes too: that part is on its way.
		expect(s.sending).toBe(1);
	});

	it('a page the person only reads sends nothing', () => {
		setStart(G1, 3);
		const s = stepStatus(db, 'u2', 'figure', G1, true);
		expect(s.sending).toBe(0);
		expect(s.lines).toEqual([expect.objectContaining({ id: F2, state: 'behind' })]);
	});
});

describe('outOfStep', () => {
	it('over 30 ids, only the one with copies that differ', () => {
		const lone = Array.from({ length: 29 }, (_, i) => mk('Basic', `Solo ${i}`));
		setStart(G1, 3);
		const out = outOfStep(db, 'u1', 'figure', [...lone, T]);
		expect([...out]).toEqual([[T, 1]]);
	});

	it('counts each copy that differs; none for copies in step', () => {
		save(G1, { notes: 'a' });
		save(G2, { notes: 'b' });
		expect(outOfStep(db, 'u1', 'figure', [T, G1, G2])).toEqual(
			new Map([
				[T, 2],
				[G1, 2],
				[G2, 2]
			])
		);
		expect(outOfStep(db, 'u1', 'figure', [])).toEqual(new Map());
	});
});

describe('keepView', () => {
	it('the page row’s settings, whether the person edits them, and how Sync opens', () => {
		setSyncSettings(db, 'u1', 'figure', G1, { ...DEFAULT_SYNC, on: false }, T0);
		expect(keepView(db, 'u1', 'figure', G1)).toEqual({
			settings: { ...DEFAULT_SYNC, on: false },
			editable: true,
			mode: 'sync'
		});
		// Luka reads the club's copy: its settings drawn, not his to change; Sync is Update mine.
		expect(keepView(db, 'u2', 'figure', G1)).toEqual({
			settings: { ...DEFAULT_SYNC, on: false },
			editable: false,
			mode: 'update'
		});
		expect(keepView(db, 'u2', 'figure', F2)).toMatchObject({ editable: true, mode: 'update' });
	});

	it('a row with no other copy the person reads: no Sync', () => {
		const lone = mk('Solo', 'Setenta');
		expect(keepView(db, 'u1', 'figure', lone)).toEqual({
			settings: DEFAULT_SYNC,
			editable: true,
			mode: null
		});
	});
});

describe('copyCounts', () => {
	it("counts the other copies the person reads, never another person's own", () => {
		// Ana: her own Basic has the two clubs' copies; Luka's own copy is his.
		expect(copyCounts(db, 'u1', 'figure', [T, G1, G2])).toEqual(
			new Map([
				[T, 2],
				[G1, 2],
				[G2, 2]
			])
		);
		// Luka reads Salsa Tuesdays' copy only; Ana's own and Rueda club's are not his.
		expect(copyCounts(db, 'u2', 'figure', [F2, G1])).toEqual(
			new Map([
				[F2, 1],
				[G1, 1]
			])
		);
	});

	it('an archived copy no longer counts, and a figure with none is absent', () => {
		db.update(figures).set({ archivedAt: T0 }).where(eq(figures.id, G2)).run();
		expect(copyCounts(db, 'u1', 'figure', [T]).get(T)).toBe(1);
		const lone = mk('Lone', 'Dile que no');
		expect(copyCounts(db, 'u1', 'figure', [lone])).toEqual(new Map());
	});
});
