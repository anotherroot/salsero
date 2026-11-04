import { describe, expect, it } from 'vitest';
import type { PositionListRow } from '$lib/types';
import { EMPTY_HOLD } from './hold';
import * as v from './view';

const label = (t: string | null) => (t === null ? 'Other' : t[0].toUpperCase() + t.slice(1));
const row = (o: Partial<PositionListRow>): PositionListRow => ({
	id: 1,
	name: 'x',
	styleTag: 'salsa',
	hold: EMPTY_HOLD,
	teamId: null,
	archived: false,
	inCount: 0,
	outCount: 0,
	deadEnd: false,
	orphan: false,
	island: false,
	unused: false,
	from: null,
	twins: false,
	...o
});

describe('positions view', () => {
	it('taggedLine', () => {
		expect(v.taggedLine({ done: 31, total: 41 })).toBe('31 of 41 figures have positions.');
	});
	it('OPTIONAL_LINE', () => {
		expect(v.OPTIONAL_LINE).toBe(
			'Positions are optional: a figure without one fits anywhere in a routine.'
		);
	});
	it('rowMeta', () => {
		expect(v.rowMeta(row({ inCount: 17, outCount: 12 }), label)).toEqual({
			text: 'Salsa · 17 in · 12 out',
			word: null,
			tone: null
		});
		expect(v.rowMeta(row({ styleTag: 'timba', inCount: 2, deadEnd: true }), label)).toEqual({
			text: 'Timba · 2 in ·',
			word: 'dead end',
			tone: 'danger'
		});
		expect(v.rowMeta(row({ styleTag: 'timba', unused: true }), label)).toEqual({
			text: 'Timba · unused',
			word: null,
			tone: null
		});
		expect(v.rowMeta(row({ styleTag: null, outCount: 1, orphan: true }), label)).toEqual({
			text: 'Other · 1 out ·',
			word: 'orphan',
			tone: 'danger'
		});
		expect(
			v.rowMeta(row({ styleTag: null, inCount: 1, outCount: 2, island: true }), label)
		).toEqual({ text: 'Other · 1 in · 2 out ·', word: 'island', tone: null });
	});
	it('groupRowMeta', () => {
		expect(v.groupRowMeta(row({ from: 'Week 6' }), label)).toBe('Salsa · from Week 6');
		expect(v.groupRowMeta(row({}), label)).toBe('Salsa');
	});
	it('noPositionRow', () => {
		expect(v.noPositionRow(10)).toEqual({
			title: 'No position',
			meta: '10 figures · they fit anywhere'
		});
		expect(v.noPositionRow(1).meta).toBe('1 figure · they fit anywhere');
	});
	it('noPositionHead', () => {
		expect(v.noPositionHead({ none: 7, onlyStart: 1, onlyEnd: 2 })).toBe(
			'10 figures · 7 with none, 3 with only a start or an end'
		);
	});
	it('FITS_ANYWHERE', () => {
		expect(v.FITS_ANYWHERE).toEqual({
			title: 'Fits anywhere',
			body: 'A figure with no position can follow anything and lead into anything: the routine editor offers it everywhere and never marks a break for it.'
		});
	});
	it('noPositionGroups', () => {
		expect(v.noPositionGroups({ none: [1, 2], onlyStart: [3], onlyEnd: [4, 5, 6] })).toEqual([
			{ title: 'No start and no end · 2', ids: [1, 2] },
			{ title: 'Only an end · 3', ids: [4, 5, 6] },
			{ title: 'Only a start · 1', ids: [3] }
		]);
		expect(v.noPositionGroups({ none: [], onlyStart: [], onlyEnd: [9] })).toEqual([
			{ title: 'Only an end · 1', ids: [9] }
		]);
	});
	it('EMPTY and firstRunBody', () => {
		expect(v.EMPTY).toEqual({
			title: 'No positions yet',
			body: 'Start from a template’s rough positions, or make your own.'
		});
		expect(v.firstRunBody(41)).toBe(
			'Your 41 figures have none, and that is fine: they fit anywhere. Add positions when you want routines checked for what can follow what.'
		);
	});
	it('GROUP_NOTE', () => {
		expect(v.GROUP_NOTE).toBe(
			'The group’s own positions. Its figures can only be tagged with these.'
		);
	});
	it('positionSubtitle', () => {
		const p = row({});
		expect(v.positionSubtitle(p, { ins: 4, outs: 3 })).toBe('Position · 4 in · 3 out');
		expect(v.positionSubtitle(p, { ins: 2, outs: 0 })).toBe('Position · 2 in · 0 out');
		expect(v.positionSubtitle(p, { teamName: 'Salsa Tuesdays', ins: 3, outs: 3 })).toBe(
			'Salsa Tuesdays’ position · 3 in · 3 out'
		);
		expect(v.positionSubtitle(p, { teamName: 'Club', ins: 1, outs: 1 })).toBe(
			'Club’s position · 1 in · 1 out'
		);
	});
	it('holdChips is re-exported', () => {
		expect(v.holdChips({ hands: 'two', crossed: true, facing: 'face', frame: 'open' })).toEqual([
			'Two hands',
			'Crossed, right on top',
			'Face to face',
			'Open'
		]);
	});
	it('figureFromRow and figureIntoRow', () => {
		expect(
			v.figureFromRow({
				label: 'Enchufla · Complicada',
				style: 'Son',
				ends: ['Abierta (dos manos), Salsa']
			})
		).toBe('Son → ends in Abierta (dos manos), Salsa');
		expect(v.figureFromRow({ label: 'k', style: 'Son', ends: ['A', 'B'] })).toBe(
			'Son → ends in A or B'
		);
		expect(v.figureFromRow({ label: 'k', style: 'Son', ends: [] })).toBe('Son');
		expect(
			v.figureIntoRow({ label: 'Dile que no · Cruzado', starts: ['Cerrada'], style: 'Salsa' })
		).toBe('from Cerrada, Salsa');
		expect(v.figureIntoRow({ label: 'k', starts: ['Manos cruzadas'], style: '' })).toBe(
			'from Manos cruzadas'
		);
	});
	it('deadEnd', () => {
		expect(v.deadEnd('Caída', 2)).toEqual({
			title: 'Dead end',
			body: 'Two figures end in Caída and nothing you know leaves it. A routine that gets here stops.',
			action: 'New figure from Caída'
		});
		expect(v.deadEnd('Caída', 1).body).toBe(
			'One figure ends in Caída and nothing you know leaves it. A routine that gets here stops.'
		);
	});
	it('orphan', () => {
		expect(v.orphan('Espalda con espalda', 1)).toEqual({
			title: 'Orphan',
			body: 'One figure leaves Espalda con espalda and nothing you know ends in it.',
			action: 'New figure into Espalda con espalda'
		});
		expect(v.orphan('X', 3).body).toBe('Three figures leave X and nothing you know ends in it.');
	});
	it('throughMeta', () => {
		expect(v.throughMeta([[2, 3]])).toBe('Slots 2 → 3');
		expect(
			v.throughMeta([
				[5, 6],
				[9, 10]
			])
		).toBe('Slots 5 → 6 and 9 → 10');
		expect(
			v.throughMeta([
				[1, 2],
				[5, 6],
				[9, 10]
			])
		).toBe('Slots 1 → 2, 5 → 6 and 9 → 10');
	});
	it('moreLine', () => {
		expect(v.moreLine(2)).toBe('and 2 more');
	});
	it('pointLabel', () => {
		expect(v.pointLabel(72_000)).toBe('Point at 1:12');
		expect(v.pointLabel(5_400)).toBe('Point at 0:05');
	});
	it('HOW', () => {
		expect(v.HOW.example).toEqual([
			['Cerrada', 'Dile que no', 'Abierta'],
			['', 'Enchufla', 'Abierta']
		]);
		expect(v.HOW.sections.map((s) => s.title)).toEqual([
			'What is a position?',
			'Why tag figures with them?',
			'Types',
			'Optional',
			'Where to start'
		]);
		expect(v.HOW.sections[0].body).toBe(
			'How the two of you hold each other between figures: open with two hands, closed, crossed hands, a hammerlock, side by side.'
		);
		expect(v.HOW.sections[1].body).toBe(
			'Every figure starts in a position and ends in one. That tells the app what can follow what: the routine editor offers only what fits, and the map shows where you get stuck.'
		);
		expect(v.HOW.sections[2].body).toBe(
			'Give each one a type, the same as a figure’s: Salsa, Son, Timba. When you tag a figure, positions of its type come first; a figure can still go from one type to another.'
		);
		expect(v.HOW.sections[3].body).toBe(
			'A figure has no position until you give it one, and then it fits anywhere: the routine editor checks nothing for it. Use positions if they help you; leave them out if they don’t.'
		);
		expect(v.HOW.sections[4].body).toBe(
			'Add a template’s rough positions and rename or change them as you go, or make your own. Groups have their own, like figures, and you can copy them.'
		);
		expect(v.HOW.done).toBe('Got it');
	});
	it('templatesNote and addLabel', () => {
		expect(v.templatesNote('Son')).toBe(
			'Rough positions to start from: rename, change or remove them later. They get the type Son. What you already have by name is skipped.'
		);
		expect(v.addLabel(3)).toBe('Add 3 positions');
		expect(v.addLabel(1)).toBe('Add 1 position');
	});
	it('tags words', () => {
		expect(v.tagsEmpty).toBe('No position · fits anywhere');
		expect(v.TAGS_HELP).toBe(
			'Any number of each. In a routine, the next figure fits when it starts in any of these ends.'
		);
	});
	it('handholds', () => {
		expect(
			v.handholds(['Abierta (dos manos)', 'Manos cruzadas'], ['Abierta (una mano)', 'Candado'])
		).toEqual({
			from: 'Abierta (dos manos) or Manos cruzadas',
			to: 'Abierta (una mano) or Candado'
		});
		expect(v.handholds([], [])).toEqual({ from: 'No position', to: 'No position' });
	});
	it('holdsLine: a sibling’s handholds on one line', () => {
		expect(v.holdsLine(['Cerrada', 'Manos cruzadas'], ['Caída'])).toBe(
			'Cerrada or Manos cruzadas → Caída'
		);
		expect(v.holdsLine(['Cerrada'], [])).toBe('Cerrada → No position');
		expect(v.holdsLine([], ['Caída'])).toBe('No position → Caída');
		expect(v.holdsLine([], [])).toBe('No position');
	});
});
