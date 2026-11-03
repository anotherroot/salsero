import { describe, expect, it } from 'vitest';
import {
	parseBridge,
	showsUpdateNeeded,
	updateNeededNow,
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
		expect(showsUpdateNeeded(update('required'), '/[dance]')).toBe(true);
		expect(showsUpdateNeeded(update('required'), '/[dance]/player')).toBe(false);
		expect(showsUpdateNeeded(update('required'), '/voice')).toBe(false);
	});
	it('not otherwise', () => {
		expect(showsUpdateNeeded(update('available'), '/[dance]')).toBe(false);
		expect(showsUpdateNeeded(null, '/[dance]')).toBe(false);
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
			routeId: '/[dance]',
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
