import { describe, expect, it } from 'vitest';
import { withLocale } from './current';
import { t } from './catalog';

const en = <T>(fn: () => T) => withLocale('en', fn);
const sl = <T>(fn: () => T) => withLocale('sl', fn);

describe('the map’s words', () => {
	it('English keeps the words the map had', () => {
		en(() => {
			const m = t().map;
			expect(m.title).toBe('The map');
			expect(m.legend.arrows).toBe('Thicker arrows: more figures · the number: how many');
			expect(m.label(false)).toBe('The map of your positions');
			expect(m.label(true)).toBe('The map of the group’s positions');
			expect(m.summary({ positions: 15, between: 32, none: 10, stranded: 4 })).toBe(
				'15 positions · 32 figures between them · 10 with none · 4 stranded'
			);
			expect(m.summary({ positions: 1, between: 1, none: 0, stranded: 0 })).toBe(
				'1 position · 1 figure between them'
			);
			expect(m.summary({ positions: 3, between: 0, none: 2, stranded: 0 })).toBe(
				'3 positions · 2 with none'
			);
			expect(m.nodeName({ name: 'Cerrada', ins: 6, outs: 8, mark: null, twins: null })).toBe(
				'Cerrada · 6 in · 8 out'
			);
			expect(
				m.nodeName({ name: 'Caída', ins: 2, outs: 0, mark: 'dead end', twins: 'Twins: x' })
			).toBe('Caída · 2 in · 0 out · dead end · Twins: x');
			expect(m.chip.deadEnds(1)).toBe('1 dead end');
			expect(m.chip.deadEnds(2)).toBe('2 dead ends');
		});
	});
	it('the new words read as the brief gives them', () => {
		en(() => {
			const m = t().map;
			expect(m.chip.orphans(3)).toBe('3 nothing gets to');
			expect(m.sheet.insOuts(1, 4)).toBe('1 figure in · 4 out');
			expect(m.walk.status(0, 'X')).toBe('No figures yet');
			expect(m.walk.status(3, 'Cerrada')).toBe('3 figures · now in Cerrada');
			expect(m.walk.make(3)).toBe('Make routine · 3');
			expect(m.walk.next('Cerrada', 2)).toBe('Next from Cerrada · 2 places');
			expect(m.walk.stays('Cerrada')).toBe('↻ Stays in Cerrada');
		});
	});
	it('Slovenian declines its counts', () => {
		sl(() => {
			const m = t().map;
			expect(m.summary({ positions: 2, between: 3, none: 0, stranded: 0 })).toBe(
				'2 položaja · 3 različice med njimi'
			);
			expect(m.walk.next('Zaprta', 5)).toBe('Naprej od: Zaprta · 5 mest');
			expect(m.walk.status(0, 'x')).toBe('Še ni različic');
		});
	});
	it('Slovenian declines the stranded count and the unused chip: 1, 2, 3, 5', () => {
		sl(() => {
			const m = t().map;
			const stranded = (n: number) =>
				m.summary({ positions: 6, between: 0, none: 0, stranded: n }).split(' · ')[1];
			expect([1, 2, 3, 5].map(stranded)).toEqual([
				'1 obtičal',
				'2 obtičala',
				'3 obtičali',
				'5 obtičalih'
			]);
			expect([1, 2, 3, 5].map((n) => m.chip.unused(n))).toEqual([
				'1 neuporabljen položaj',
				'2 neuporabljena položaja',
				'3 neuporabljeni položaji',
				'5 neuporabljenih položajev'
			]);
		});
	});
});
