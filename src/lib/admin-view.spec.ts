import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import {
	gbToBytes,
	LIMIT_PRESETS_GB,
	appsLines,
	groupMeta,
	groupsMadeLine,
	limitsLine,
	personMeta,
	presetLabel,
	requestUsesLine,
	usesLine
} from './admin-view';

const MB = 1024 * 1024;
const GB = 1024 ** 3;

describe('admin view', () => {
	it('presets are 2, 5 and 10 GB', () => {
		expect(LIMIT_PRESETS_GB.map(presetLabel)).toEqual(['2 GB', '5 GB', '10 GB']);
	});
	it('gbToBytes takes positive numbers only', () => {
		expect(gbToBytes(2)).toBe(2 * GB);
		expect(gbToBytes(0.5)).toBe(GB / 2);
		for (const bad of [0, -1, NaN, Infinity, 1e9]) expect(gbToBytes(bad)).toBeUndefined();
	});
	it('words', () => {
		expect(requestUsesLine(840 * MB, GB)).toBe('Uses 840 MB of 1.0 GB');
		expect(personMeta({ day: '2026-11-02', usedBytes: 0, limitBytes: null })).toBe(
			'Joined 2 Nov 2026 · 0 MB, no limit'
		);
	});
});

describe('groups on the admin page', () => {
	it('words the top line, a group and a person', async () => {
		const { limitsLine, groupMeta, groupsMadeLine, requestTitle } = await import('./admin-view');
		const GB = 1024 ** 3;
		expect(limitsLine(12 * GB, 8 * GB)).toBe('Limits add up to 12.0 GB · 8.0 GB free');
		expect(
			groupMeta({
				owner: 'Ana Kranjc',
				people: 3,
				usedBytes: 120 * 1024 ** 2,
				limitBytes: 600 * 1024 ** 2,
				deleted: false
			})
		).toBe('Ana Kranjc · 3 people · 120 MB of 600 MB');
		expect(groupsMadeLine(2, 3)).toBe('Groups made: 2 · limit 3');
		expect(requestTitle({ email: 'a@x.si', teamName: null })).toBe('a@x.si');
		expect(requestTitle({ email: 'a@x.si', teamName: 'Class' })).toBe('Class · a@x.si');
	});
});

describe('appsLines', () => {
	const today = '2026-11-03';
	const row = (day: string, channel: 'direct' | 'play' = 'direct') => [
		{ dance: 'salsa' as const, versionCode: 2, channel, day }
	];
	it('says the version and the day, one line per dance', () => {
		// One account, one dance (the dance split): its own app only.
		expect(appsLines(row(today), today, 'salsa')).toEqual(['Salsa app 2 · today']);
		expect(appsLines([], today, 'bachata')).toEqual(['Bachata: no app']);
		expect(appsLines(row('2026-11-02'), today, 'salsa')[0]).toBe('Salsa app 2 · yesterday');
		expect(appsLines(row('2025-10-28'), today, 'salsa')[0]).toBe('Salsa app 2 · Tue 28 Oct');
		expect(appsLines(row(today, 'play'), today, 'salsa')[0]).toBe('Salsa app 2 (Play) · today');
	});
});

describe('admin view in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('words a preset with a decimal comma', () => {
		expect(sl(() => presetLabel(0.5))).toBe('0,5 GB');
		expect(sl(() => presetLabel(2))).toBe('2 GB');
	});
	it('words the use, the request and the top line', () => {
		expect(sl(() => usesLine(840 * MB, GB))).toBe('840 MB od 1,0 GB');
		expect(sl(() => usesLine(840 * MB, null))).toBe('840 MB, brez omejitve');
		expect(sl(() => requestUsesLine(840 * MB, GB))).toBe('Porabljeno 840 MB od 1,0 GB');
		expect(sl(() => limitsLine(12 * GB, 8 * GB))).toBe('Omejitve skupaj: 12,0 GB · prosto 8,0 GB');
	});
	it('words a person', () => {
		expect(sl(() => personMeta({ day: '2026-11-02', usedBytes: 0, limitBytes: null }))).toBe(
			'Pridružitev: 2. nov. 2026 · 0 MB, brez omejitve'
		);
		expect(sl(() => groupsMadeLine(2, 3))).toBe('Ustvarjene skupine: 2 · omejitev 3');
	});
	it('words a group with the right form of people', () => {
		const meta = (people: number, deleted = false) =>
			sl(() =>
				groupMeta({
					owner: 'Ana Kranjc',
					people,
					usedBytes: 120 * MB,
					limitBytes: 600 * MB,
					deleted
				})
			);
		expect(meta(1)).toBe('Ana Kranjc · 1 oseba · 120 MB od 600 MB');
		expect(meta(2)).toContain('· 2 osebi ·');
		expect(meta(3)).toContain('· 3 osebe ·');
		expect(meta(5)).toContain('· 5 oseb ·');
		expect(meta(3, true)).toBe('Ana Kranjc · 3 osebe · 120 MB od 600 MB · izbrisana');
	});
	it('words the apps', () => {
		const today = '2026-11-03';
		const row = (day: string, channel: 'direct' | 'play' = 'direct') => [
			{ dance: 'salsa' as const, versionCode: 2, channel, day }
		];
		expect(sl(() => appsLines(row(today), today, 'salsa'))).toEqual([
			'Salsa: različica aplikacije 2 · danes'
		]);
		expect(sl(() => appsLines([], today, 'bachata'))).toEqual(['Bachata: brez aplikacije']);
		expect(sl(() => appsLines(row('2026-11-02', 'play'), today, 'salsa'))).toEqual([
			'Salsa: različica aplikacije 2 (Play) · včeraj'
		]);
	});
});
