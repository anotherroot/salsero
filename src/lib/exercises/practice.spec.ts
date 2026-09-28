import { describe, expect, it } from 'vitest';
import { DANCES } from '$lib/dances/dances';
import {
	defaultPracticeConfig,
	hourOfBars,
	minutesFrom,
	parsePracticeConfig,
	parsePracticeInput,
	practiceSummary
} from './practice';

const salsa = DANCES.salsa;
const bachata = DANCES.bachata;

describe('parsePracticeConfig', () => {
	it('reads back what was written', () => {
		const c = { count: 'son', clave: '2-3', speed: 0.8, callEvery: 4 } as const;
		expect(parsePracticeConfig(JSON.stringify(c), salsa)).toEqual(c);
	});

	it.each([null, '', 'not json', '42', '[]', '{"count":7}', '{"speed":"fast"}'])(
		'falls back to the defaults for %s',
		(raw) => {
			expect(parsePracticeConfig(raw, salsa)).toEqual(defaultPracticeConfig(salsa));
		}
	);

	it('keeps the good fields of a half-bad value', () => {
		expect(parsePracticeConfig('{"count":"son","clave":"4-4"}', salsa)).toEqual({
			...defaultPracticeConfig(salsa),
			count: 'son'
		});
	});

	it('never gives bachata a clave, even from a salsa-shaped value', () => {
		expect(parsePracticeConfig('{"clave":"2-3"}', bachata).clave).toBeNull();
	});

	it('refuses a count pattern the dance does not offer', () => {
		const onlySalsa = { ...salsa, countPatterns: ['salsa'] as const };
		expect(parsePracticeConfig('{"count":"son"}', onlySalsa).count).toBe(salsa.defaultCountPattern);
	});

	it('refuses a call interval the panel does not offer', () => {
		expect(parsePracticeConfig('{"callEvery":1}', salsa).callEvery).toBeNull();
	});
});

describe('parsePracticeInput', () => {
	const config = defaultPracticeConfig(salsa);

	it('accepts count mode with a tempo, and clears the song', () => {
		expect(parsePracticeInput({ mode: 'count', songId: 9, countBpm: 150, config }, salsa)).toEqual({
			mode: 'count',
			songId: null,
			countBpm: 150,
			config
		});
	});

	it('accepts song mode with a song id, and clears the tempo', () => {
		expect(parsePracticeInput({ mode: 'song', songId: 9, countBpm: 150, config }, salsa)).toEqual({
			mode: 'song',
			songId: 9,
			countBpm: null,
			config
		});
	});

	it.each([
		null,
		'x',
		{ mode: 'none', songId: null, countBpm: 150, config },
		{ mode: 'count', songId: null, countBpm: 59, config },
		{ mode: 'count', songId: null, countBpm: 301, config },
		{ mode: 'count', songId: null, countBpm: 150.5, config },
		{ mode: 'song', songId: null, countBpm: null, config },
		{ mode: 'song', songId: -1, countBpm: null, config }
	])('refuses %j', (body) => {
		expect(parsePracticeInput(body, salsa)).toBeNull();
	});

	it('makes a garbage config total rather than refusing the whole body', () => {
		expect(
			parsePracticeInput({ mode: 'count', songId: null, countBpm: 150, config: 'junk' }, salsa)
				?.config
		).toEqual(defaultPracticeConfig(salsa));
	});
});

describe('practiceSummary', () => {
	it('names the tempo, the count and the clave', () => {
		expect(
			practiceSummary(
				{
					mode: 'count',
					bpm: 180,
					songTitle: null,
					config: { count: 'son', clave: '2-3', speed: 1, callEvery: null }
				},
				salsa
			)
		).toBe('Count 180 · 2 3 4 · 6 7 8 · clave 2-3');
	});
	it('names the song and a slowed speed', () => {
		expect(
			practiceSummary(
				{
					mode: 'song',
					bpm: 180,
					songTitle: 'El Cantante',
					config: { count: 'salsa', clave: null, speed: 0.8, callEvery: 2 }
				},
				salsa
			)
		).toBe('El Cantante 0.8× · 1 2 3 · 5 6 7 · call every 2');
	});
});

describe('sizes', () => {
	it('sizes a count-only grid for an hour', () => {
		// 180 beats a minute for 60 minutes, 8 beats an 8-count.
		expect(hourOfBars(180)).toBe(1350);
	});
	it('rounds minutes, never below one', () => {
		expect(minutesFrom(0)).toBe(1);
		expect(minutesFrom(29)).toBe(1);
		expect(minutesFrom(90)).toBe(2);
		expect(minutesFrom(600)).toBe(10);
	});
});
