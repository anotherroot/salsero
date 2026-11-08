import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { comingHeading } from './coming-view';

const group = (key: string, day: string | null, away: string | null) => ({
	key,
	day,
	away,
	rows: []
});

describe('comingHeading', () => {
	it('names a day left and how far away right', () => {
		expect(comingHeading(group('2026-11-08', '2026-11-08', 'in 3 days'), '2026-11-05')).toEqual({
			title: 'Sun 8 Nov',
			away: 'in 3 days'
		});
	});

	it('adds the year when the day is not this year', () => {
		expect(comingHeading(group('2027-01-14', '2027-01-14', 'in 2 months'), '2026-11-05')).toEqual({
			title: 'Thu 14 Jan 2027',
			away: 'in 2 months'
		});
	});

	it('Next in line and Paused have no date and no distance', () => {
		expect(comingHeading(group('waiting', null, null), '2026-11-05')).toEqual({
			title: 'Next in line',
			away: null
		});
		expect(comingHeading(group('paused', null, null), '2026-11-05')).toEqual({
			title: 'Paused',
			away: null
		});
	});
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	it('names the day, with the year when it is not this year', () => {
		expect(
			sl(() => comingHeading(group('2026-11-08', '2026-11-08', 'čez 3 dni'), '2026-11-05'))
		).toEqual({ title: 'ned, 8. nov.', away: 'čez 3 dni' });
		expect(
			sl(() => comingHeading(group('2027-01-14', '2027-01-14', null), '2026-11-05')).title
		).toBe('čet, 14. jan. 2027');
	});
	it('Next in line and Paused', () => {
		expect(sl(() => comingHeading(group('waiting', null, null), '2026-11-05')).title).toBe(
			'Naslednje na vrsti'
		);
		expect(sl(() => comingHeading(group('paused', null, null), '2026-11-05')).title).toBe(
			'Na premoru'
		);
	});
});
