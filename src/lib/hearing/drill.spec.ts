import { describe, expect, it } from 'vitest';
import {
	HEARING_DEFAULT,
	appendRound,
	hearingOf,
	parseRound,
	roundsLine,
	roundsOf,
	settingsFrom,
	settingsQuery,
	suggestFeel,
	withHearing,
	type HearingRound,
	type HearingSettings
} from './drill';

const round = (score: number, changed = false): HearingRound => ({
	kind: 'dropped',
	target: 'one',
	drops: 10,
	songIds: [4, 7],
	score,
	timing: score,
	count: 0,
	restarts: 0,
	listening: 0,
	changed
});

describe("a hearing drill's settings", () => {
	it('reads none, or junk, as the default', () => {
		expect(hearingOf(null)).toEqual(HEARING_DEFAULT);
		expect(hearingOf('not json')).toEqual(HEARING_DEFAULT);
		expect(hearingOf('{"count":"on"}')).toEqual(HEARING_DEFAULT);
	});

	it('reads its own key, and a bad field as its default', () => {
		const s: HearingSettings = { kind: 'tapAlong', target: 'clave', clave: '3-2', drops: 20 };
		expect(hearingOf(withHearing(null, s))).toEqual(s);
		expect(hearingOf('{"hearing":{"kind":"x","target":"odd","drops":7}}')).toEqual({
			kind: 'dropped',
			target: 'odd',
			drops: 10
		});
		const own: HearingSettings = { kind: 'dropped', target: 'own', positions: [3, 6, 7], drops: 5 };
		expect(hearingOf(withHearing(null, own))).toEqual(own);
	});

	it('keeps every other key of practice_json', () => {
		const s: HearingSettings = { kind: 'dropped', target: 'every', drops: 5 };
		const out = JSON.parse(withHearing('{"count":"on","speed":1}', s));
		expect(out.count).toBe('on');
		expect(out.speed).toBe(1);
		expect(out.hearing).toEqual(s);
	});
});

describe('rounds in a set', () => {
	it('appends, keeping the earlier rounds in order', () => {
		const once = appendRound(null, round(40));
		const twice = appendRound(once, round(60));
		expect(roundsOf(twice).map((r) => r.score)).toEqual([40, 60]);
		expect(roundsOf(null)).toEqual([]);
		expect(roundsOf('junk')).toEqual([]);
	});

	it('keeps what else the set held', () => {
		const out = JSON.parse(appendRound('{"source":"song"}', round(50)));
		expect(out.source).toBe('song');
	});

	it('refuses a round that is not one', () => {
		expect(parseRound(round(70))).toEqual(round(70));
		expect(parseRound({ ...round(70), score: 120 })).toBeNull();
		expect(parseRound({ ...round(70), songIds: ['4'] })).toBeNull();
		expect(parseRound({ ...round(70), target: 'two' })).toBeNull();
		expect(parseRound('nope')).toBeNull();
	});

	it("draws the line from the drill's own rounds only", () => {
		const line = roundsLine([round(31), round(52, true), round(40), round(64)]);
		expect(line).toEqual({ count: 3, last: 64, before: 40, scores: [31, 40, 64] });
		expect(roundsLine([])).toEqual({ count: 0, last: null, before: null, scores: [] });
		expect(roundsLine([round(50)]).before).toBeNull();
	});
});

describe('the face a score suggests', () => {
	it('follows the ladder', () => {
		expect([49, 50, 74, 75, 89, 90, 100].map(suggestFeel)).toEqual([
			'hard',
			'getting',
			'getting',
			'gotit',
			'gotit',
			'easy',
			'easy'
		]);
	});
});

describe('settings in a link', () => {
	const base: HearingSettings = { kind: 'dropped', target: 'clave', clave: '2-3', drops: 10 };

	it('round-trips, and says when they differ from the drill', () => {
		const same = settingsFrom(new URLSearchParams(settingsQuery(base)), base);
		expect(same).toEqual({ settings: base, changed: false });
		const other = settingsFrom(new URLSearchParams('target=every'), base);
		expect(other.changed).toBe(true);
		expect(other.settings.target).toBe('every');
		expect(settingsFrom(new URLSearchParams(''), base)).toEqual({ settings: base, changed: false });
	});
});
