import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { t } from '$lib/i18n/catalog';
import {
	DEFAULT_REMINDER,
	appVersionLabel,
	deviceMeta,
	publishedLine,
	reminderToSave,
	siteVersionLabel
} from './view';

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

describe('Settings → About', () => {
	// 10 Nov 2026, 18:26 UTC: 19:26 in Ljubljana.
	const AT = Date.UTC(2026, 10, 10, 18, 26);
	const latest = { versionCode: 10, versionName: '1.9' };

	it('names the website’s version and when it came out, in the person’s zone', () => {
		expect(siteVersionLabel(1805)).toBe('Version 1805');
		expect(publishedLine(AT, 'Europe/Ljubljana', true)).toBe('Published 10 Nov 2026, 19:26');
		expect(publishedLine(AT, 'UTC', true)).toBe('Published 10 Nov 2026, 18:26');
	});

	it('names the app by its release when it is the current one, else by its number', () => {
		expect(appVersionLabel(10, latest)).toBe('Version 1.9 (10)');
		expect(appVersionLabel(8, latest)).toBe('Version 8');
		expect(appVersionLabel(8, null)).toBe('Version 8');
		expect(publishedLine(AT, 'Europe/Ljubljana', false)).toBe('Published 10 Nov 2026');
	});

	it('in Slovenian', () => {
		withLocale('sl', () => {
			expect(appVersionLabel(10, latest)).toBe('Različica 1.9 (10)');
			expect(publishedLine(AT, 'Europe/Ljubljana', true)).toBe('Objavljeno 10. nov. 2026, 19:26');
		});
	});
});
