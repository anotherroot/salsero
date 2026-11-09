import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { createFigure, updateVariation } from '../figures';
import { makeClass, CLASS_ED } from '../test-class';
import { U1_SALSA } from '../test-walls';
import type { CapturedRow, Row } from '$lib/sync/outbox';
import { fieldsToRestore, restoreOwnFields, snapshotRows } from './merge';

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
