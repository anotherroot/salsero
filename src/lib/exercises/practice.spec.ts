import { describe, expect, it } from 'vitest';
import { DANCES } from '$lib/dances/dances';
import { withLocale } from '$lib/i18n/current';
import {
	practiceOf,
	practiceToPost,
	defaultPracticeConfig,
	hourOfBars,
	minutesFrom,
	parsePracticeConfig,
	parsePracticeInput,
	practiceStart,
	practiceSummary,
	parsePhonePractice,
	practiceSeed
} from './practice';

const salsa = DANCES.salsa;
const bachata = DANCES.bachata;

describe('parsePracticeConfig', () => {
	it('reads back what was written', () => {
		const c = { count: 'son', clave: '2-3', speed: 0.8 } as const;
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

	it('drops the call interval an older value still carries: nothing is called any more', () => {
		expect(parsePracticeConfig('{"count":"son","callEvery":2}', salsa)).toEqual({
			...defaultPracticeConfig(salsa),
			count: 'son'
		});
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
					config: { count: 'son', clave: '2-3', speed: 1 }
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
					config: { count: 'salsa', clave: null, speed: 0.8 }
				},
				salsa
			)
		).toBe('El Cantante 0.8× · 1 2 3 · 5 6 7');
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

describe('practiceStart', () => {
	const ready = [3, 5, 9];

	it('opens on the remembered song while it is ready', () => {
		expect(practiceStart({ practiceMode: 'song', songId: 5 }, ready)).toEqual({
			source: 'song',
			songId: 5,
			songGone: false
		});
	});

	it('opens on the count when the remembered song is no longer ready, and says so', () => {
		expect(practiceStart({ practiceMode: 'song', songId: 4 }, ready)).toEqual({
			source: 'count',
			songId: 3,
			songGone: true
		});
	});

	it('opens on the count after a count practice, a song still to hand for the picker', () => {
		expect(practiceStart({ practiceMode: 'count', songId: null }, ready)).toEqual({
			source: 'count',
			songId: 3,
			songGone: false
		});
	});

	it('opens on the count for a never-practised exercise, or none at all', () => {
		const counted = { source: 'count', songId: 3, songGone: false };
		expect(practiceStart({ practiceMode: 'none', songId: null }, ready)).toEqual(counted);
		expect(practiceStart(null, ready)).toEqual(counted);
	});

	it('lets a requested song win over what was remembered', () => {
		expect(practiceStart({ practiceMode: 'song', songId: 5 }, ready, 9)).toEqual({
			source: 'song',
			songId: 9,
			songGone: false
		});
		expect(practiceStart({ practiceMode: 'count', songId: null }, ready, 9).source).toBe('song');
	});

	it('has no song to offer when the dance has none ready', () => {
		expect(practiceStart({ practiceMode: 'song', songId: 5 }, [])).toEqual({
			source: 'count',
			songId: null,
			songGone: true
		});
	});
});

// The panel's collapsed line in Slovenian: the count stays Spanish digits, the speed a comma.
describe('practiceSummary in Slovenian', () => {
	const summary = (p: Parameters<typeof practiceSummary>[0]) =>
		withLocale('sl', () => practiceSummary(p, salsa));

	it('names the tempo, the count and the clave', () => {
		expect(
			summary({
				mode: 'count',
				bpm: 180,
				songTitle: null,
				config: { count: 'son', clave: '2-3', speed: 1 }
			})
		).toBe('Štetje 180 · 2 3 4 · 6 7 8 · clave 2-3');
	});
	it('names the song, and a slowed speed with a comma', () => {
		expect(
			summary({
				mode: 'song',
				bpm: 180,
				songTitle: 'El Cantante',
				config: { count: 'salsa', clave: null, speed: 0.8 }
			})
		).toBe('El Cantante 0,8× · 1 2 3 · 5 6 7');
		expect(
			summary({
				mode: 'count',
				bpm: 150,
				songTitle: null,
				config: { count: 'off', clave: null, speed: 1 }
			})
		).toBe('Štetje 150 · brez štetja');
	});
	it('keeps "Off" in English', () => {
		expect(
			practiceSummary(
				{
					mode: 'count',
					bpm: 150,
					songTitle: null,
					config: { count: 'off', clave: null, speed: 1 }
				},
				salsa
			)
		).toBe('Count 150 · Off');
	});
});

describe('practiceToPost', () => {
	const row = {
		practiceMode: 'count' as const,
		songId: null,
		countBpm: 180,
		practiceJson: JSON.stringify({ count: 'salsa', clave: '2-3', speed: 1 })
	};
	const config = { count: 'salsa', clave: '2-3', speed: 1 } as const;
	const loaded = () => practiceOf(row, salsa);

	it('reads what the page loaded as the endpoint would store it', () => {
		expect(loaded()).toEqual({ mode: 'count', songId: null, countBpm: 180, config });
		expect(practiceOf({ ...row, practiceMode: 'none' }, salsa)).toBeNull();
		expect(practiceOf({ ...row, practiceMode: 'song', songId: 4, countBpm: 120 }, salsa)).toEqual({
			mode: 'song',
			songId: 4,
			countBpm: null,
			config
		});
	});

	it('posts nothing when Play keeps what was loaded', () => {
		// The song picker's songId is not stored for a count run.
		expect(
			practiceToPost(loaded(), { source: 'count', songId: 9, bpm: 180, config: { ...config } })
		).toBeNull();
	});

	it('posts what differs: the bpm, the source, the song or the config', () => {
		const next = { source: 'count' as const, songId: null, bpm: 180, config: { ...config } };
		expect(practiceToPost(loaded(), { ...next, bpm: 150 })).toEqual({
			mode: 'count',
			songId: null,
			countBpm: 150,
			config
		});
		expect(practiceToPost(loaded(), { ...next, source: 'song', songId: 3 })).toEqual({
			mode: 'song',
			songId: 3,
			countBpm: null,
			config
		});
		expect(practiceToPost(loaded(), { ...next, config: { ...config, speed: 0.8 } })).not.toBeNull();
		expect(
			practiceToPost(loaded(), { ...next, config: { ...config, clave: null } })
		).not.toBeNull();
	});

	it('posts on first practice, when nothing was remembered', () => {
		expect(
			practiceToPost(null, { source: 'count', songId: null, bpm: 180, config: { ...config } })
		).not.toBeNull();
	});
});

describe('parsePhonePractice', () => {
	it('reads back what the phone stored', () => {
		expect(
			parsePhonePractice(
				{ bpm: 150, count: 'off', clave: '3-2', speed: 0.8, voiceVolume: 0.4 },
				salsa
			)
		).toEqual({ bpm: 150, count: 'off', clave: '3-2', speed: 0.8, voiceVolume: 0.4 });
	});

	it('keeps clave off apart from nothing stored', () => {
		expect(parsePhonePractice({ clave: null }, salsa).clave).toBeNull();
		expect(parsePhonePractice({}, salsa).clave).toBeUndefined();
	});

	it('drops what does not prove itself', () => {
		expect(
			parsePhonePractice(
				{ bpm: 900, count: 'waltz', clave: '1-1', speed: 2, voiceVolume: -1 },
				salsa
			)
		).toEqual({ bpm: null, count: null, clave: undefined, speed: null, voiceVolume: null });
		expect(parsePhonePractice('nonsense', salsa).count).toBeNull();
		expect(parsePhonePractice(null, salsa).bpm).toBeNull();
	});

	it('reads the store written before count patterns existed', () => {
		expect(parsePhonePractice({ count: true }, salsa).count).toBe('salsa');
		expect(parsePhonePractice({ count: false }, salsa).count).toBe('off');
	});

	it('never gives bachata a clave or a son count from a salsa store', () => {
		const p = parsePhonePractice({ count: 'son', clave: '2-3' }, bachata);
		expect(p.count).toBeNull();
		expect(p.clave).toBeNull();
	});
});

describe('practiceSeed', () => {
	const phone = parsePhonePractice(
		{ bpm: 150, count: 'off', clave: '3-2', speed: 0.8, voiceVolume: 0.5 },
		salsa
	);

	it("starts from the exercise's own memory when it has one", () => {
		const remembered = {
			mode: 'count' as const,
			songId: null,
			countBpm: 190,
			config: { count: 'son', clave: null, speed: 1 } as const
		};
		expect(practiceSeed(remembered, phone, salsa, 180)).toEqual({
			bpm: 190,
			count: 'son',
			clave: null,
			speed: 1
		});
	});

	it("takes the phone's tempo when the exercise remembers a song", () => {
		const remembered = {
			mode: 'song' as const,
			songId: 3,
			countBpm: null,
			config: { count: 'salsa', clave: '2-3', speed: 0.9 } as const
		};
		expect(practiceSeed(remembered, phone, salsa, 180).bpm).toBe(150);
	});

	it('starts from what this phone last used when the exercise remembers nothing', () => {
		expect(practiceSeed(null, phone, salsa, 180)).toEqual({
			bpm: 150,
			count: 'off',
			clave: '3-2',
			speed: 0.8
		});
	});

	it('falls back to the defaults on a phone that never practised', () => {
		expect(practiceSeed(null, parsePhonePractice(null, salsa), salsa, 180)).toEqual({
			bpm: 180,
			count: 'salsa',
			clave: null,
			speed: 1
		});
	});
});
