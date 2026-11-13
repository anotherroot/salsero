import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { t } from '$lib/i18n/catalog';
import { actionBlocks, extractBlock, inOrder, selectionShape } from './selection';

const rows = [
	{ id: 10, isRoutine: false },
	{ id: 11, isRoutine: false },
	{ id: 12, isRoutine: true },
	{ id: 13, isRoutine: false }
];

describe('inOrder', () => {
	it('puts a selection in routine order, whatever order it was tapped in', () => {
		expect(inOrder(rows, [13, 10, 11])).toEqual([10, 11, 13]);
	});
});

describe('extractBlock', () => {
	it('allows any run of neighbours, sections and routines in it too (spec 2026-11-12)', () => {
		expect(extractBlock(rows, [11, 10])).toBeNull();
		expect(extractBlock(rows, [11, 12])).toBeNull();
	});

	it('names the reason it cannot', () => {
		expect(extractBlock(rows, [10, 13])).toBe('Select slots next to each other.');
	});
});

describe('actionBlocks', () => {
	it('blocks everything for an empty selection, with extract’s own reason', () => {
		expect(actionBlocks(0, false, 'Select the slots to make into a routine.')).toEqual({
			above: 'Select slots first.',
			below: 'Select slots first.',
			duplicate: 'Select slots first.',
			delete: 'Select slots first.',
			extract: 'Select the slots to make into a routine.'
		});
	});
	it('allows everything for one slot', () => {
		expect(Object.values(actionBlocks(1, true, null)).every((v) => v === null)).toBe(true);
	});
	it('Before and After work for a run of neighbours', () => {
		const b = actionBlocks(3, true, null);
		expect([b.above, b.below]).toEqual([null, null]);
	});
	it('apart: Before and After say why', () => {
		const b = actionBlocks(2, false, 'Select slots next to each other.');
		expect([b.above, b.below, b.duplicate, b.delete]).toEqual([
			'Select slots next to each other.',
			'Select slots next to each other.',
			null,
			null
		]);
	});
});

describe('selectionShape', () => {
	const ids = [10, 11, 12, 13, 14, 15];
	it('nothing selected', () => {
		expect(selectionShape(ids, [])).toEqual({
			pieces: [null, null, null, null, null, null],
			runs: []
		});
	});
	it('one slot', () => {
		expect(selectionShape(ids, [12])).toEqual({
			pieces: [null, null, 'single', null, null, null],
			runs: [{ from: 2, to: 2 }]
		});
	});
	it('neighbours join, whatever order they were tapped in', () => {
		expect(selectionShape(ids, [14, 12, 13])).toEqual({
			pieces: [null, null, 'top', 'mid', 'bottom', null],
			runs: [{ from: 2, to: 4 }]
		});
	});
	it('apart stays apart', () => {
		expect(selectionShape(ids, [11, 14])).toEqual({
			pieces: [null, 'single', null, null, 'single', null],
			runs: [
				{ from: 1, to: 1 },
				{ from: 4, to: 4 }
			]
		});
	});
	it('an id not on screen is ignored', () => {
		expect(selectionShape(ids, [99]).runs).toEqual([]);
	});
});

describe('the run’s header and the tip', () => {
	it('names the run', () => {
		expect(t().routine.selection.run(3, 4)).toBe('Slots 3–4');
		expect(withLocale('sl', () => t().routine.selection.run(3, 4))).toBe('Mesti 3–4');
		expect(withLocale('sl', () => t().routine.selection.run(3, 5))).toBe('Mesta 3–5');
	});
	it('the tip under one selected slot', () => {
		expect(t().routine.selection.tip).toBe('Tap other slots to add them.');
		expect(withLocale('sl', () => t().routine.selection.tip)).toBe(
			'Tapnite še druga mesta, da jih dodate.'
		);
	});
});

describe('the selection in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('names why Section is greyed', () => {
		expect(sl(() => extractBlock(rows, []))).toBe('Izberite mesta, iz katerih naj nastane sklop.');
		expect(sl(() => extractBlock(rows, [10, 13]))).toBe('Izberite sosednja mesta.');
	});

	it('names why each action is greyed', () => {
		expect(sl(() => actionBlocks(0, false, null))).toEqual({
			above: 'Najprej izberite mesta.',
			below: 'Najprej izberite mesta.',
			duplicate: 'Najprej izberite mesta.',
			delete: 'Najprej izberite mesta.',
			extract: null
		});
	});
});
