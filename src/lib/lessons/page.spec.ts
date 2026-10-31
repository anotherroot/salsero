import { describe, expect, it } from 'vitest';
import type { SectionLinkChip, ViaSection } from '$lib/types';
import {
	deleteBlock,
	deleteVideoBody,
	exerciseMeta,
	figureMeta,
	reviewMeta,
	routineMeta,
	sectionHeading,
	unlinkViaBody,
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

	it('meta lines', () => {
		expect(figureMeta({ partner: 'partner', viaSections: two })).toBe(
			'1:12.0–1:30.4, 3:05.0–3:22.8'
		);
		expect(figureMeta({ partner: 'solo', viaSections: [] })).toBe('Solo');
		expect(routineMeta({ everyDays: 3 })).toBe('Every 3 days');
		expect(routineMeta({ everyDays: null })).toBeNull();
		expect(exerciseMeta({ viaSections: [], everyDays: 1 })).toBe('Daily');
		expect(exerciseMeta({ viaSections: two, everyDays: 1 })).toBe('1:12.0–1:30.4, 3:05.0–3:22.8');
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

	it('deleteBlock mirrors the server wording', () => {
		expect(deleteBlock([{ links: [] }, { links: [] }])).toBeNull();
		expect(
			deleteBlock([
				{ links: [chip('Footwork drill'), chip('Enchufla · Doble')] },
				{ links: [chip('Enchufla · Doble'), chip('Old drill', true)] }
			])
		).toBe('Linked to Enchufla · Doble, Footwork drill, Old drill (archived) — unlink it first.');
	});
});
