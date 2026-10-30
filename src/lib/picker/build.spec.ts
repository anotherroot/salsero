import { describe, expect, it } from 'vitest';
import { exerciseGroups, figureRows, routineRows, variationEntries } from './build';
import { isHeading, shown, type PickRow } from './model';
import type { FigureVersion, PickExercise } from '$lib/types';

const version = (id: number, groupId: number, figure: string, name: string): FigureVersion => ({
	id,
	groupId,
	figure,
	name,
	label: `${figure} · ${name}`
});

const exercise = (over: Partial<PickExercise> & { id: number; name: string }): PickExercise => ({
	source: 'custom',
	everyDays: 3,
	figure: null,
	variation: null,
	linked: false,
	...over
});

describe('variationEntries', () => {
	it('variationEntries: groups variations under their figure in input order, keys figure:{id}', () => {
		const entries = variationEntries([
			version(4, 2, 'Enchufla', 'Basic'),
			version(7, 2, 'Enchufla', 'Doble'),
			version(3, 1, 'Dile que no', 'Basic')
		]);
		expect(entries.map((e) => e.heading)).toEqual(['Enchufla', 'Dile que no']);
		expect(entries.every((e) => e.collapse)).toBe(true);
		expect(entries[0].rows).toEqual([
			{ key: 'figure:4', value: 4, label: 'Enchufla · Basic', short: 'Basic' },
			{ key: 'figure:7', value: 7, label: 'Enchufla · Doble', short: 'Doble' }
		]);
		expect(entries[1].rows.map((r) => r.key)).toEqual(['figure:3']);
	});

	it('variationEntries: carries linked', () => {
		const entries = variationEntries([
			{ ...version(4, 2, 'Enchufla', 'Basic'), linked: true },
			{ ...version(7, 2, 'Enchufla', 'Doble'), linked: false }
		]);
		expect(entries[0].rows.map((r) => r.linked)).toEqual([true, false]);
	});
});

describe('figureRows', () => {
	it('figureRows: meta is the variations joined with ", "', () => {
		expect(figureRows([{ id: 2, name: 'Enchufla', variations: ['Basic', 'Doble'] }])).toEqual([
			{ key: 'group:2', value: 2, label: 'Enchufla', meta: 'Basic, Doble' }
		]);
	});
});

describe('routineRows', () => {
	it('routineRows: "1 slot", "4 slots · loops"', () => {
		const rows = routineRows([
			{ id: 1, name: 'Warm-up loop', slots: 4, loops: true },
			{ id: 2, name: 'Enchufla combo', slots: 1, loops: false, linked: true }
		]);
		expect(rows).toEqual([
			{ key: 'routine:1', value: 1, label: 'Warm-up loop', meta: '4 slots · loops' },
			{ key: 'routine:2', value: 2, label: 'Enchufla combo', meta: '1 slot', linked: true }
		]);
	});
});

describe('exerciseGroups', () => {
	it('exerciseGroups: groups in the order Figures, Routines, Drills, Lessons, empty ones left out', () => {
		const all = exerciseGroups([
			exercise({ id: 1, name: 'Review: Tuesday', source: 'lesson' }),
			exercise({ id: 2, name: 'Spot turns', source: 'custom' }),
			exercise({ id: 3, name: 'Combo', source: 'routine' }),
			exercise({
				id: 4,
				name: 'Setenta · Complicado',
				source: 'figure',
				figure: 'Setenta',
				variation: 'Complicado'
			})
		]);
		expect(all.map((g) => g.title)).toEqual(['Figures', 'Routines', 'Drills', 'Lessons']);

		const some = exerciseGroups([
			exercise({ id: 2, name: 'Spot turns', source: 'custom' }),
			exercise({ id: 3, name: 'Combo', source: 'routine' })
		]);
		expect(some.map((g) => g.title)).toEqual(['Routines', 'Drills']);
		expect(exerciseGroups([])).toEqual([]);
	});

	it('exerciseGroups: a figure with one exercise collapses to "Setenta · Complicado"', () => {
		const groups = exerciseGroups([
			exercise({
				id: 4,
				name: 'Setenta · Complicado',
				source: 'figure',
				figure: 'Setenta',
				variation: 'Complicado'
			}),
			exercise({
				id: 5,
				name: 'Enchufla · Basic',
				source: 'figure',
				figure: 'Enchufla',
				variation: 'Basic'
			}),
			exercise({
				id: 6,
				name: 'Enchufla · Doble',
				source: 'figure',
				figure: 'Enchufla',
				variation: 'Doble'
			})
		]);
		const lines = shown(groups, '');
		const text = lines.map((l) =>
			l.kind === 'group'
				? `# ${l.title}`
				: l.kind === 'heading'
					? l.text
					: `${l.indent ? '  ' : ''}${l.text}`
		);
		expect(text).toEqual(['# Figures', 'Enchufla', '  Basic', '  Doble', 'Setenta · Complicado']);
		const setenta = lines.find((l) => l.kind === 'row' && l.text === 'Setenta · Complicado');
		expect(setenta?.kind === 'row' && setenta.row.key).toBe('exercise:4');
	});

	it('exerciseGroups: meta is frequencyLabel(everyDays)', () => {
		const [drills] = exerciseGroups([
			exercise({ id: 2, name: 'Spot turns', everyDays: 3, linked: true })
		]);
		const row = drills.entries[0];
		expect(isHeading(row)).toBe(false);
		expect((row as PickRow).meta).toBe('Every 3 days');
		expect((row as PickRow).linked).toBe(true);
	});
});
