import { describe, expect, it } from 'vitest';
import type { SectionLinkChip, ViaSection } from '$lib/types';
import {
	deleteBlock,
	deleteVideoBody,
	positionLinkLabel,
	positionMeta,
	positionPickGroups,
	exerciseMeta,
	figureMeta,
	reviewMeta,
	routineMeta,
	sectionHeading,
	unlinkViaBody,
	unlinkViaTitle,
	viaBadge,
	viaRanges
} from './page';

const via = (startMs: number, endMs: number): ViaSection => ({
	spotId: startMs,
	startMs,
	endMs,
	label: null
});
const chip = (label: string, archived = false): SectionLinkChip => ({ id: 1, label, archived });
const two = [via(72_000, 90_400), via(185_000, 202_800)];

describe('lesson page lines', () => {
	it('headings and badges', () => {
		expect(sectionHeading('Figures', 3)).toBe('Figures · 3');
		expect(sectionHeading('Exercises', 0)).toBe('Exercises');
		expect(viaBadge([])).toBeNull();
		expect(viaBadge([two[0]])).toBe('via section');
		expect(viaBadge(two)).toBe('via 2 sections');
		expect(viaRanges(two)).toBe('1:12.0–1:30.4, 3:05.0–3:22.8');
	});
	it('a point is said as a point', () => {
		const point = (startMs: number): ViaSection => ({
			spotId: startMs,
			startMs,
			endMs: null,
			label: null
		});
		expect(viaBadge([point(72_000)])).toBe('via point');
		expect(viaBadge([point(72_000), point(15_000)])).toBe('via 2 points');
		expect(viaBadge([point(72_000), two[0]])).toBe('via a section and a point');
		expect(viaBadge([point(72_000), ...two])).toBe('via 2 sections and a point');
		expect(unlinkViaTitle('Manos cruzadas', 'Week 6')).toBe('Unlink Manos cruzadas from Week 6?');
		expect(unlinkViaTitle('Enchufla · Doble')).toBe('Unlink Enchufla · Doble?');
		expect(unlinkViaBody('Manos cruzadas', [point(72_000)], 'Week 6')).toBe(
			'Manos cruzadas is on Week 6 through point 1:12.0. Unlink it from the lesson and the point?'
		);
		expect(unlinkViaBody('Manos cruzadas', [two[0], point(15_000)], 'Week 6')).toBe(
			'Manos cruzadas is on Week 6 through section and point 1:12.0–1:30.4, 0:15.0. Unlink it from the lesson and the section and point?'
		);
	});

	it('meta lines', () => {
		expect(figureMeta({ partner: 'partner', viaSections: two })).toBe(
			'1:12.0–1:30.4, 3:05.0–3:22.8'
		);
		expect(figureMeta({ partner: 'solo', viaSections: [] })).toBe('Solo');
		expect(routineMeta({ everyDays: 3 })).toBe('Every 3 days');
		expect(routineMeta({ everyDays: null })).toBeNull();
		expect(exerciseMeta({ viaSections: [], everyDays: 1 })).toBe('Daily');
		expect(exerciseMeta({ viaSections: two, everyDays: 1 })).toBe('1:12.0–1:30.4, 3:05.0–3:22.8');
		const label = (t: string | null) => (t === 'son' ? 'Son' : 'Salsa');
		expect(positionMeta({ styleTag: 'son', viaSections: [via(72000, 91000)] }, label)).toBe(
			'1:12.0–1:31.0 · Son'
		);
		expect(positionMeta({ styleTag: 'son', viaSections: [] }, label)).toBe('Son');
		expect(positionMeta({ styleTag: null, viaSections: [] }, label)).toBeNull();
		expect(reviewMeta({ everyDays: 3, active: true })).toEqual([
			{ text: 'Every 3 days', strong: false },
			{ text: 'review exercise', strong: false }
		]);
		expect(reviewMeta({ everyDays: 7, active: false })).toEqual([
			{ text: 'Weekly', strong: false },
			{ text: 'inactive', strong: true },
			{ text: 'review exercise', strong: false }
		]);
	});

	it('dialog bodies', () => {
		expect(unlinkViaBody('Enchufla · Doble', [via(42_000, 65_500)])).toBe(
			'Enchufla · Doble is on this lesson through section 0:42.0–1:05.5. Unlink it from the lesson and the section?'
		);
		expect(unlinkViaBody('Setenta · Basic', two)).toBe(
			'Setenta · Basic is on this lesson through sections 1:12.0–1:30.4, 3:05.0–3:22.8. Unlink it from the lesson and the sections?'
		);
		expect(deleteVideoBody(3)).toBe(
			'Its 3 sections go with it. Lesson videos aren’t backed up, so this can’t be undone.'
		);
		expect(deleteVideoBody(1)).toBe(
			'Its 1 section goes with it. Lesson videos aren’t backed up, so this can’t be undone.'
		);
		expect(deleteVideoBody(0)).toBe('Lesson videos aren’t backed up, so this can’t be undone.');
	});

	it('positionPickGroups marks the linked rows, own types first and a group after', () => {
		const hold = { hands: null, crossed: null, facing: null, frame: null };
		const row = (
			id: number,
			name: string,
			linked: boolean,
			team: { id: number; name: string } | null
		) => ({
			id,
			name,
			styleTag: 'salsa',
			hold,
			teamId: team?.id ?? null,
			archived: false,
			linked,
			team
		});
		const groups = positionPickGroups(
			[
				row(1, 'Cerrada', true, null),
				row(2, 'Abierta', false, null),
				row(3, 'Sombra', true, { id: 9, name: 'Ana' })
			],
			(t) => (t === null ? 'Other' : 'Salsa')
		);
		expect(groups.map((g) => g.title)).toEqual(['Salsa', 'Ana’s']);
		const flat = groups
			.flatMap((g) => g.entries)
			.map((e) => ('rows' in e ? null : [e.label, e.linked]));
		expect(flat).toEqual([
			['Cerrada', true],
			['Abierta', false],
			['Sombra', true]
		]);
	});

	it('deleteBlock mirrors the server wording', () => {
		expect(deleteBlock([{ links: [] }, { links: [] }])).toBeNull();
		expect(
			deleteBlock([
				{ links: [chip('Footwork drill'), chip('Enchufla · Doble')] },
				{ links: [chip('Enchufla · Doble'), chip('Old drill', true)] }
			])
		).toBe('Linked to Enchufla · Doble, Footwork drill, Old drill (archived) — unlink it first.');
	});

	it('deleteBlock names the positions its sections and points link, as linksBlocking does', () => {
		expect(deleteBlock([{ links: [] }], [{ name: 'Cerrada', archived: false }])).toBe(
			'Linked to Position · Cerrada — unlink it first.'
		);
		expect(
			deleteBlock(
				[{ links: [chip('Enchufla · Doble')] }],
				[
					{ name: 'Vieja', archived: true },
					{ name: 'Cerrada', archived: false },
					{ name: 'Cerrada', archived: false }
				]
			)
		).toBe(
			'Linked to Enchufla · Doble, Position · Cerrada, Position · Vieja (archived) — unlink it first.'
		);
		expect(positionLinkLabel('Cerrada')).toBe('Position · Cerrada');
	});

	it('a point in a via list is its moment alone', () => {
		expect(
			viaRanges([{ spotId: 1, startMs: 72_000, endMs: null, label: null }, via(1000, 2000)])
		).toBe('1:12.0, 0:01.0–0:02.0');
	});
});
