import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { t } from '$lib/i18n/catalog';
import { DEFAULT_REMINDER, deviceMeta, reminderToSave } from './view';

describe('reminderToSave', () => {
	it('posts off, a valid time, or nothing', () => {
		expect(reminderToSave(false, '07:05')).toBe('');
		expect(reminderToSave(true, '07:05')).toBe('07:05');
		expect(reminderToSave(true, '')).toBeNull();
		expect(reminderToSave(true, '7:5')).toBeNull();
		expect(reminderToSave(true, DEFAULT_REMINDER)).toBe('19:30');
	});
});

describe('deviceMeta', () => {
	it('says when a phone was paired and last used', () => {
		expect(deviceMeta('2026-10-28', '2026-10-31', '2026-10-31')).toBe(
			'Paired 28 Oct 2026 · last used today'
		);
		expect(deviceMeta('2026-10-28', '2026-10-30', '2026-10-31')).toBe(
			'Paired 28 Oct 2026 · last used yesterday'
		);
		expect(deviceMeta('2026-10-28', '2026-10-01', '2026-10-31')).toBe(
			'Paired 28 Oct 2026 · last used 1 Oct 2026'
		);
		expect(deviceMeta('2026-10-28', null, '2026-10-31')).toBe('Paired 28 Oct 2026');
	});
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('says when a phone was paired and last used, with no gender', () => {
		expect(sl(() => deviceMeta('2026-10-28', '2026-10-31', '2026-10-31'))).toBe(
			'Povezava: 28. okt. 2026 · zadnja uporaba: danes'
		);
		expect(sl(() => deviceMeta('2026-10-28', '2026-10-30', '2026-10-31'))).toBe(
			'Povezava: 28. okt. 2026 · zadnja uporaba: včeraj'
		);
		expect(sl(() => deviceMeta('2026-10-28', '2026-10-01', '2026-10-31'))).toBe(
			'Povezava: 28. okt. 2026 · zadnja uporaba: 1. okt. 2026'
		);
		expect(sl(() => deviceMeta('2026-10-28', null, '2026-10-31'))).toBe('Povezava: 28. okt. 2026');
	});

	it('words the reminder', () => {
		expect(sl(() => t().settings.android.reminder)).toBe('Dnevni opomnik');
		expect(sl(() => t().settings.android.reminderTime)).toBe('Ura opomnika');
		expect(sl(() => t().settings.refusals.reminder)).toBe('Izberite uro ali opomnik izklopite.');
	});

	it('names a phone and what removing it says', () => {
		expect(sl(() => t().settings.devices.appLabel('Salsa'))).toBe('Aplikacija Salsa');
		expect(sl(() => t().settings.devices.removed('Aplikacija Salsa'))).toBe(
			'Odstranjeno: Aplikacija Salsa'
		);
		expect(t().settings.devices.appLabel('Salsa')).toBe('Salsa app');
		expect(t().settings.devices.removed('Salsa app')).toBe('Salsa app removed');
	});
});
