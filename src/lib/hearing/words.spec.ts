import { describe, expect, it } from 'vitest';
import { posLabel, posName, targetLabel } from './words';

describe('targetLabel', () => {
	it('names a target by its counts or in words', () => {
		expect(targetLabel('ones')).toBe('1 · 5');
		expect(targetLabel('one')).toBe('The 1');
		expect(targetLabel('clave')).toBe('The clave');
	});
});

describe('targetLabel for your own counts', () => {
	it('names them by their counts', () => {
		expect(targetLabel('own', [3, 6, 7])).toBe('3 6 7');
		expect(targetLabel('own', [])).toBe('Your own');
	});
});

describe('positions', () => {
	it('labels a position by its count, the and with &', () => {
		expect(posLabel(6.5)).toBe('6&');
		expect(posLabel(2)).toBe('2');
	});

	it('names a position in a sentence', () => {
		expect(posName(6.5)).toBe('the and of 6');
		expect(posName(1)).toBe('the 1');
	});
});

describe('kindLine: a hearing drill in one line (phase 2)', () => {
	it('says the kind, the target and, dropped in, the length', async () => {
		const { kindLine } = await import('./words');
		const { withLocale } = await import('$lib/i18n/current');
		expect(kindLine({ kind: 'dropped', target: 'one', drops: 10 })).toBe(
			'Dropped in · The 1 · 10 spots'
		);
		expect(kindLine({ kind: 'tapAlong', target: 'own', positions: [3, 6, 7], drops: 10 })).toBe(
			'Tap along · 3 6 7'
		);
		expect(withLocale('sl', () => kindLine({ kind: 'dropped', target: 'one', drops: 5 }))).toBe(
			'Sredi skladbe · Ena · 5 mest'
		);
	});
});
