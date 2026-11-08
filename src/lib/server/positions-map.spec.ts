import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { createFigure } from './figures';
import { createPosition } from './positions';
import { setFigureShape } from './graph';
import { markTwins } from './twins';
import { mapData } from './positions-map';
import { U1_SALSA } from './test-walls';
import type { Hold } from '$lib/types';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const hold = { hands: 2, crossed: false } as unknown as Hold;
const position = (name: string) => {
	const r = createPosition(
		db,
		U1_SALSA,
		{ name, styleTag: null, hold, notes: null, pictureSpotId: null },
		1_800_000_000_000
	);
	if ('field' in r) throw new Error('setup');
	return r.id;
};
const figure = (move: string, name: string, startIds: number[], endIds: number[]) => {
	const id = createFigure(db, U1_SALSA, {
		figureName: move,
		name,
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	expect(setFigureShape(db, id, { startIds, endIds, startCount: 1, lengthCounts: 8 })).toBe(true);
	return id;
};

describe('mapData figures', () => {
	it('puts each figure on its arrow, and the rest in anyFrom and noStart', () => {
		const A = position('Abierta');
		const B = position('Cerrada');
		const f1 = figure('Enchufla', 'Basic', [A], [B]);
		const f2 = figure('Dile que no', 'Basic', [A], [B]);
		const f3 = figure('Setenta', 'Basic', [A], [A]);
		const f4 = figure('Sombrero', 'Basic', [A], []);
		const f5 = figure('Paseo', 'Basic', [], [B]);
		const f6 = figure('Free', 'Basic', [], []);

		const m = mapData(db, U1_SALSA, null);
		const edge = (from: number, to: number) => m.edges.find((e) => e.from === from && e.to === to)!;

		expect(edge(A, B).figs).toEqual([
			{ id: f2, label: 'Dile que no · Basic', move: 'Dile que no' },
			{ id: f1, label: 'Enchufla · Basic', move: 'Enchufla' }
		]);
		expect(edge(A, B).figures).toBe(2);
		expect(edge(A, A).figs).toEqual([{ id: f3, label: 'Setenta · Basic', move: 'Setenta' }]);
		expect(m.anyFrom).toEqual([
			{ from: A, figs: [{ id: f4, label: 'Sombrero · Basic', move: 'Sombrero' }] }
		]);
		expect(m.noStart).toEqual([
			{ fig: { id: f6, label: 'Free · Basic', move: 'Free' }, ends: [] },
			{ fig: { id: f5, label: 'Paseo · Basic', move: 'Paseo' }, ends: [B] }
		]);
	});

	it('folds twinned positions into one node whose edges hold both members figures', () => {
		const A = position('Abierta');
		const B = position('Cerrada');
		const B2 = position('Closed');
		expect(markTwins(db, U1_SALSA, 'position', [B, B2])).toBe(true);
		const f1 = figure('Enchufla', 'Basic', [A], [B]);
		const f2 = figure('Setenta', 'Basic', [A], [B2]);

		const m = mapData(db, U1_SALSA, null);
		const nodeB = m.positions.find((p) => p.twinsLine !== null)!;
		const edge = m.edges.find((e) => e.from === A && e.to === nodeB.id)!;
		expect(edge.figs.map((f) => f.id).sort()).toEqual([f1, f2].sort());
	});
});
