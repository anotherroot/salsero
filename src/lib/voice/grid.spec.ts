import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import type { CountPattern } from '$lib/labels';
import {
	keptMessage,
	ownVoiceSummary,
	recordedLabel,
	takeRows,
	tempoMeta,
	tempoState
} from './grid';

const k = (pattern: CountPattern, bpm: number, phrase: 'a' | 'b', id = 1) => ({
	id,
	pattern,
	bpm,
	phrase
});

describe('tempoState', () => {
	it('is none, half or done', () => {
		expect(tempoState([], 'salsa', 120)).toEqual({ state: 'none' });
		expect(tempoState([k('salsa', 164, 'a')], 'salsa', 164)).toEqual({ state: 'half', half: 'a' });
		expect(tempoState([k('salsa', 120, 'a'), k('salsa', 120, 'b')], 'salsa', 120)).toEqual({
			state: 'done'
		});
		expect(tempoState([k('son', 120, 'a'), k('son', 120, 'b')], 'salsa', 120)).toEqual({
			state: 'none'
		});
	});
});

describe('ownVoiceSummary', () => {
	it('counts whole tempos only', () => {
		expect(ownVoiceSummary([])).toBe('0 of 21 tempos in your own voice');
		expect(
			ownVoiceSummary([
				k('salsa', 120, 'a'),
				k('salsa', 120, 'b'),
				k('all', 191, 'a'),
				k('all', 191, 'b'),
				k('son', 140, 'a')
			])
		).toBe('2 of 21 tempos in your own voice');
	});
});

describe('tempoMeta', () => {
	it('says what is recorded', () => {
		expect(tempoMeta({ state: 'done' }, 'salsa')).toEqual({ text: 'Recorded', tone: 'done' });
		expect(tempoMeta({ state: 'half', half: 'a' }, 'salsa')).toEqual({
			text: 'Half recorded · counts 1 2 3',
			tone: 'status'
		});
		expect(tempoMeta({ state: 'half', half: 'b' }, 'son')).toEqual({
			text: 'Half recorded · counts 6 7 8',
			tone: 'status'
		});
		expect(tempoMeta({ state: 'none' }, 'all')).toEqual({ text: 'Not recorded', tone: 'muted' });
	});
});

const both = (pattern: CountPattern, bpm: number, id: number) => [
	k(pattern, bpm, 'a', id),
	k(pattern, bpm, 'b', id + 1)
];
const takes = [
	...both('salsa', 120, 1),
	...both('salsa', 130, 3),
	...both('salsa', 140, 5),
	k('salsa', 164, 'a', 7),
	...both('son', 152, 8)
];

describe('recordedLabel', () => {
	it('counts whole tempos of the pattern', () => {
		expect(recordedLabel(takes, 'salsa')).toBe('Tempos · 3 of 7 recorded');
		expect(recordedLabel(takes, 'son')).toBe('Tempos · 1 of 7 recorded');
		expect(recordedLabel([], 'all')).toBe('Tempos · 0 of 7 recorded');
	});
});

describe('takeRows', () => {
	it('lists the pattern bpm then phrase', () => {
		const rows = takeRows(
			[
				k('salsa', 130, 'a', 3),
				k('salsa', 120, 'b', 2),
				k('salsa', 120, 'a', 1),
				k('son', 120, 'a', 4)
			],
			'salsa'
		);
		expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
		expect(rows[0]).toEqual({
			id: 1,
			title: '120 BPM · counts 1 2 3',
			meta: '1 2 3 · 5 6 7 · phrase A',
			deleteLabel: 'Delete 120 BPM phrase A',
			deleted: '120 BPM · counts 1 2 3 deleted'
		});
		expect(rows[1]).toEqual({
			id: 2,
			title: '120 BPM · counts 5 6 7',
			meta: '1 2 3 · 5 6 7 · phrase B',
			deleteLabel: 'Delete 120 BPM phrase B',
			deleted: '120 BPM · counts 5 6 7 deleted'
		});
		expect(rows[2].title).toBe('130 BPM · counts 1 2 3');
	});
});

describe('keptMessage', () => {
	it('says which halves landed', () => {
		expect(keptMessage(152, ['a', 'b'], 'salsa')).toBe('Kept both halves for 152 BPM');
		expect(keptMessage(152, ['b'], 'salsa')).toBe('Kept counts 5 6 7 for 152 BPM');
		expect(keptMessage(152, ['a'], 'son')).toBe('Kept counts 2 3 4 for 152 BPM');
	});
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('words the grid', () => {
		expect(sl(() => ownVoiceSummary([]))).toBe('0 od 21 tempov z vašim glasom');
		expect(sl(() => recordedLabel(takes, 'salsa'))).toBe('Tempi · posnetih 3 od 7');
		expect(sl(() => tempoMeta({ state: 'done' }, 'salsa').text)).toBe('Posneto');
		expect(sl(() => tempoMeta({ state: 'half', half: 'a' }, 'salsa').text)).toBe(
			'Pol posneto · štetje 1 2 3'
		);
		expect(sl(() => tempoMeta({ state: 'none' }, 'all').text)).toBe('Ni posneto');
	});

	it('words a take row and the toasts', () => {
		expect(sl(() => takeRows([k('salsa', 120, 'a', 1)], 'salsa')[0])).toEqual({
			id: 1,
			title: '120 BPM · štetje 1 2 3',
			meta: '1 2 3 · 5 6 7 · fraza A',
			deleteLabel: 'Izbriši 120 BPM, fraza A',
			deleted: 'Izbrisano: 120 BPM · štetje 1 2 3'
		});
		expect(sl(() => keptMessage(152, ['a', 'b'], 'salsa'))).toBe(
			'Obe polovici sta shranjeni za 152 BPM'
		);
		expect(sl(() => keptMessage(152, ['b'], 'salsa'))).toBe('Shranjeno štetje 5 6 7 za 152 BPM');
	});
});
