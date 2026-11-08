import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import {
	hiddenToday,
	hideMark,
	hideUpdate,
	parseBridge,
	showsUpdateNeeded,
	updateNeededNow,
	updateRowLine,
	updateRowTitle,
	updateView,
	type AppUpdate,
	type BridgeStatus
} from './view';

const update = (state: AppUpdate['state']): AppUpdate => ({
	state,
	channel: 'direct',
	dance: 'salsa',
	installed: 1,
	latest: { versionCode: 2, versionName: '1.1', url: '/releases/salsa/2.apk' }
});

describe('updateView', () => {
	const rows: [BridgeStatus, string, boolean, string | null][] = [
		['idle', 'Update', false, null],
		[{ progress: 40 }, 'Downloading… 40%', true, null],
		['confirming', 'Installing…', true, null],
		['permission', 'Update', false, 'Allow this app to install updates, then come back.'],
		['busy', 'Update', true, 'Updating after your upload finishes.'],
		['current', 'Update', false, 'You have the latest version.'],
		['cancelled', 'Update', false, null],
		['failed:offline', 'Try again', false, 'No connection.'],
		['failed:download', 'Try again', false, 'The download broke.'],
		['failed:check', 'Try again', false, "The download didn't check out."],
		['failed:install', 'Try again', false, "It didn't install."]
	];
	it.each(rows)('%j', (status, label, working, line) => {
		expect(updateView(status)).toEqual({ label, working, line });
	});
});

describe('parseBridge', () => {
	it('reads each message', () => {
		expect(parseBridge('progress:40')).toEqual({ progress: 40 });
		expect(parseBridge('confirming')).toBe('confirming');
		expect(parseBridge('failed:check')).toBe('failed:check');
	});
	it('refuses what it does not know', () => {
		expect(parseBridge('progress:140')).toBeNull();
		expect(parseBridge('progress:x')).toBeNull();
		expect(parseBridge('nonsense')).toBeNull();
	});
});

describe('showsUpdateNeeded', () => {
	it('shows when required, except where interrupting costs work', () => {
		expect(showsUpdateNeeded(update('required'), '/[dance]/(today)')).toBe(true);
		expect(showsUpdateNeeded(update('required'), '/[dance]/player')).toBe(false);
		expect(showsUpdateNeeded(update('required'), '/voice')).toBe(false);
	});
	it('not otherwise', () => {
		expect(showsUpdateNeeded(update('available'), '/[dance]/(today)')).toBe(false);
		expect(showsUpdateNeeded(null, '/[dance]/(today)')).toBe(false);
	});
});

describe('updateNeededNow', () => {
	const quiet = { playerOpen: false, sheetsOpen: false, unsaved: 0, held: 0 };
	const at = (
		state: AppUpdate['state'] | null,
		when: 'load' | 'navigated' | 'refresh',
		more: Partial<Parameters<typeof updateNeededNow>[1]> = {}
	) =>
		updateNeededNow(state ? update(state) : null, {
			routeId: '/[dance]/(today)',
			shown: false,
			at: when,
			...quiet,
			...more
		});

	it('takes a page load or a finished navigation', () => {
		expect(at('required', 'load')).toBe(true);
		expect(at('required', 'navigated', { unsaved: 1, sheetsOpen: true })).toBe(true);
	});
	it('never Practice or My count', () => {
		expect(at('required', 'load', { routeId: '/[dance]/player' })).toBe(false);
		expect(at('required', 'navigated', { routeId: '/voice' })).toBe(false);
		expect(at('required', 'refresh', { routeId: '/voice' })).toBe(false);
	});
	it('turning required on an open page takes it only when nothing is cut short', () => {
		expect(at('required', 'refresh')).toBe(true);
		expect(at('required', 'refresh', { unsaved: 1 })).toBe(false);
		expect(at('required', 'refresh', { sheetsOpen: true })).toBe(false);
		expect(at('required', 'refresh', { playerOpen: true })).toBe(false);
		expect(at('required', 'refresh', { held: 1 })).toBe(false);
	});
	it('once up, it stays while the update is required', () => {
		expect(at('required', 'refresh', { shown: true, unsaved: 1 })).toBe(true);
		expect(at('required', 'navigated', { shown: true, routeId: '/voice' })).toBe(true);
	});
	it('goes once the update is no longer required', () => {
		expect(at('available', 'refresh', { shown: true })).toBe(false);
		expect(at('none', 'navigated', { shown: true })).toBe(false);
		expect(at(null, 'load', { shown: true })).toBe(false);
	});
});

describe('the Update row on Today', () => {
	it('says which version is ready, or what the Update button is doing', () => {
		expect(updateRowLine(update('available'), null)).toBe('Version 1.1 is ready');
		expect(updateRowLine({ ...update('available'), latest: null }, null)).toBe('Ready to install');
		expect(updateRowLine(update('available'), 'No connection.')).toBe('No connection.');
		expect(updateRowTitle()).toBe('New version of the app');
		expect(hideUpdate()).toBe('Hide until tomorrow');
	});

	it('× hides it for the rest of the day, for that version', () => {
		expect(hiddenToday(hideMark('2026-11-06', 2), '2026-11-06', 2)).toBe(true);
		expect(hiddenToday(hideMark('2026-11-06', 2), '2026-11-07', 2)).toBe(false);
		expect(hiddenToday(hideMark('2026-11-06', 2), '2026-11-06', 3)).toBe(false);
		expect(hiddenToday(null, '2026-11-06', 2)).toBe(false);
		expect(hiddenToday('junk', '2026-11-06', 2)).toBe(false);
	});
});

describe('in Slovenian', () => {
	it('says what the Update button is doing, with a non-breaking space before … and %', () => {
		const sl = withLocale('sl', () => [
			updateView({ progress: 45 }).label,
			updateView('failed:offline').label,
			updateView('idle').label,
			updateRowLine(update('available'), null),
			updateRowTitle()
		]);
		expect(sl).toEqual([
			'Prenašanje\u00a0… 45\u00a0%',
			'Poskusi znova',
			'Posodobi',
			'Različica aplikacije 1.1 je pripravljena',
			'Nova različica aplikacije'
		]);
	});
});
