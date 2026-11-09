import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { createFigure, updateVariation } from '../figures';
import { makeClass, CLASS_ED } from '../test-class';
import { U1_SALSA } from '../test-walls';
import type { CapturedRow, Row } from '$lib/sync/outbox';
import { createPosition } from '../positions';
import {
	fieldsToRestore,
	restoreOwnFields,
	restoreOwnSets,
	snapshotRows,
	snapshotSets
} from './merge';

describe('fieldsToRestore (pure)', () => {
	it('puts back a field the entry left alone and the server changed since', () => {
		const device = { before: { name: 'A', notes: 'x' }, after: { name: 'A', notes: 'y' } };
		// the PC renamed it to B; the replayed form wrote the whole row back (name A, notes y)
		const server = { before: { name: 'B', notes: 'x' }, after: { name: 'A', notes: 'y' } };
		expect(fieldsToRestore(device, server, 5000, 1000)).toEqual({ name: 'B' });
	});

	it('keeps the later of two changes to one field', () => {
		const device = { before: { name: 'A' }, after: { name: 'C' } };
		const server = { before: { name: 'B' }, after: { name: 'C' } };
		expect(fieldsToRestore(device, server, 2000, 1000)).toEqual({ name: 'B' });
		expect(fieldsToRestore(device, server, 2000, 3000)).toEqual({});
	});

	it('keeps a field nobody else changed', () => {
		const device = { before: { name: 'A', notes: 'x' }, after: { name: 'A', notes: 'y' } };
		const server = { before: { name: 'A', notes: 'x' }, after: { name: 'A', notes: 'y' } };
		expect(fieldsToRestore(device, server, null, 1000)).toEqual({});
	});

	it('compares numbers and their text alike', () => {
		const device = { before: { n: 3 }, after: { n: 3 } };
		const server = { before: { n: '3' }, after: { n: 3 } };
		expect(fieldsToRestore(device, server, null, 1000)).toEqual({});
	});
});

/** The figure row as the device would have captured it. */
function rowOf(db: Db, id: number): Row {
	return db.get<Row>(sql`SELECT * FROM figures WHERE id = ${id}`);
}
const captured = (id: number, before: Row, after: Row): CapturedRow[] => [
	{ tbl: 'figures', key: String(id), op: 'u', before, after }
];

describe('restoreOwnFields (on a database)', () => {
	function ownFigure(db: Db) {
		const made = createFigure(db, U1_SALSA, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: 'old'
		})!;
		return made.figure;
	}

	it("puts back the PC's rename when the offline save changed only the notes", () => {
		const db = openDb(':memory:');
		const f = ownFigure(db);
		const deviceBefore = rowOf(db, f.id);
		const deviceAfter = { ...deviceBefore, notes: 'new' };
		// meanwhile on the PC: renamed
		updateVariation(db, f.id, { name: 'Doble', partner: 'partner', style: 'salsa', notes: 'old' });
		const rows = captured(f.id, deviceBefore, deviceAfter);
		const snap = snapshotRows(db, rows);
		// the replayed form sends the whole row as the device had it
		updateVariation(db, f.id, { name: 'Basic', partner: 'partner', style: 'salsa', notes: 'new' });
		expect(restoreOwnFields(db, rows, snap, 1)).toBe(1);
		expect(rowOf(db, f.id)).toMatchObject({ name: 'Doble', notes: 'new' });
	});

	it("never touches a group's row", () => {
		const db = openDb(':memory:');
		makeClass(db);
		const made = createFigure(db, CLASS_ED, {
			figureName: 'Group move',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: 'old'
		})!;
		const id = made.figure.id;
		const before = rowOf(db, id);
		updateVariation(
			db,
			id,
			{ name: 'Doble', partner: 'partner', style: 'salsa', notes: 'old' },
			'u2'
		);
		const rows = captured(id, before, { ...before, notes: 'new' });
		const snap = snapshotRows(db, rows);
		updateVariation(
			db,
			id,
			{ name: 'Basic', partner: 'partner', style: 'salsa', notes: 'new' },
			'u2'
		);
		expect(restoreOwnFields(db, rows, snap, 1)).toBe(0);
		expect(rowOf(db, id)).toMatchObject({ name: 'Basic', notes: 'new' });
	});

	it('does nothing for a row deleted on the server meanwhile', () => {
		const db = openDb(':memory:');
		const f = ownFigure(db);
		const before = rowOf(db, f.id);
		const rows = captured(f.id, before, { ...before, notes: 'new' });
		const gone: CapturedRow[] = [{ ...rows[0], key: '987654' }];
		const snap = snapshotRows(db, gone);
		expect(restoreOwnFields(db, gone, snap, 1)).toBe(0);
	});
});

describe('child sets and ordering (the Part A review)', () => {
	function setup() {
		const db = openDb(':memory:');
		const f = createFigure(db, U1_SALSA, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: 'old'
		})!.figure;
		const pos = (name: string) => {
			const made = createPosition(
				db,
				U1_SALSA,
				{
					name,
					styleTag: null,
					hold: { hands: null, crossed: null, facing: null, frame: null },
					notes: null,
					pictureSpotId: null
				},
				1
			);
			return (made as { id: number }).id;
		};
		return { db, f, p1: pos('Cerrada'), p2: pos('Abierta'), p3: pos('Cross') };
	}
	const tags = (db: Db, figureId: number) =>
		db
			.all<{ position_id: number }>(
				sql`SELECT position_id FROM figure_end_positions WHERE figure_id = ${figureId} ORDER BY position_id`
			)
			.map((r) => r.position_id);
	const tag = (db: Db, figureId: number, positionId: number) =>
		db.run(
			sql`INSERT INTO figure_end_positions (figure_id, position_id, created_at) VALUES (${figureId}, ${positionId}, 0)`
		);
	/** What the figure's update does with its posted tags: all of them replaced. */
	const writeTags = (db: Db, figureId: number, ids: number[]) => {
		db.run(sql`DELETE FROM figure_end_positions WHERE figure_id = ${figureId}`);
		for (const id of ids) tag(db, figureId, id);
	};

	it('keeps a position tag the PC added when the notes were edited offline', () => {
		const { db, f, p1, p2 } = setup();
		tag(db, f.id, p1);
		const before = rowOf(db, f.id);
		const rows = captured(f.id, before, { ...before, notes: 'new' });
		// on the PC, after the offline edit: a second end
		tag(db, f.id, p2);
		const snap = snapshotSets(db, rows);
		// the stale form posts the one tag the device knew
		writeTags(db, f.id, [p1]);
		restoreOwnSets(db, rows, snap);
		expect(tags(db, f.id)).toEqual([p1, p2].sort((a, b) => a - b));
	});

	it('keeps a tag the entry added and drops one it removed', () => {
		const { db, f, p1, p2, p3 } = setup();
		tag(db, f.id, p1);
		tag(db, f.id, p2);
		const before = rowOf(db, f.id);
		const rows: CapturedRow[] = [
			...captured(f.id, before, before),
			{
				tbl: 'figure_end_positions',
				key: JSON.stringify([f.id, p3]),
				op: 'i',
				before: null,
				after: { figure_id: f.id, position_id: p3 }
			},
			{
				tbl: 'figure_end_positions',
				key: JSON.stringify([f.id, p2]),
				op: 'd',
				before: { figure_id: f.id, position_id: p2 },
				after: null
			}
		];
		const snap = snapshotSets(db, rows);
		writeTags(db, f.id, [p1, p3]);
		restoreOwnSets(db, rows, snap);
		expect(tags(db, f.id)).toEqual([p1, p3].sort((a, b) => a - b));
	});

	it('never puts back an ordering column', () => {
		const device = { before: { position: 1, name: 'A' }, after: { position: 1, name: 'A' } };
		const server = { before: { position: 2, name: 'A' }, after: { position: 1, name: 'A' } };
		expect(fieldsToRestore(device, server, null, 1000)).toEqual({});
	});
});
