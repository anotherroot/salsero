import { describe, expect, it } from 'vitest';
import {
	parseBridge,
	showsUpdateNeeded,
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
