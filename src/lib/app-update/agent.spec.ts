import { describe, expect, it } from 'vitest';
import {
	deviceOf,
	parseAppAgent,
	parseAppVersion,
	parseRelease,
	updateState,
	type AppAgent,
	type Release
} from './agent';

const CHROME =
	'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Mobile Safari/537.36';

const release: Release = {
	versionCode: 3,
	versionName: '1.2',
	minVersionCode: 1,
	sha256: 'abc',
	size: 1000,
	commit: 'deadbeef'
};

describe('parseAppAgent', () => {
	it('reads the app suffix', () => {
		expect(parseAppAgent(`${CHROME} SalsaApp/7 (bachata; direct)`)).toEqual({
			versionCode: 7,
			dance: 'bachata',
			channel: 'direct'
		});
	});
	it('is null for a plain browser, an unknown dance or a bad version', () => {
		expect(parseAppAgent(CHROME)).toBeNull();
		expect(parseAppAgent(null)).toBeNull();
		expect(parseAppAgent(`${CHROME} SalsaApp/7 (tango; direct)`)).toBeNull();
		expect(parseAppAgent(`${CHROME} SalsaApp/x (salsa; play)`)).toBeNull();
	});
});

describe('parseAppVersion', () => {
	it('reads the header', () => {
		expect(parseAppVersion('3; salsa; play')).toEqual({
			versionCode: 3,
			dance: 'salsa',
			channel: 'play'
		});
	});
	it('is null for anything else', () => {
		expect(parseAppVersion('3')).toBeNull();
		expect(parseAppVersion(null)).toBeNull();
		expect(parseAppVersion('3; tango; play')).toBeNull();
		expect(parseAppVersion('3; salsa; web')).toBeNull();
	});
});

describe('parseRelease', () => {
	it('accepts the current.json shape', () => {
		expect(parseRelease({ ...release })).toEqual(release);
	});
	it('rejects missing, mistyped and negative values', () => {
		expect(parseRelease({})).toBeNull();
		expect(parseRelease(null)).toBeNull();
		expect(parseRelease({ ...release, versionCode: '2' })).toBeNull();
		expect(parseRelease({ ...release, minVersionCode: -1 })).toBeNull();
	});
});

describe('updateState', () => {
	const at = (versionCode: number, channel: AppAgent['channel']): AppAgent => ({
		versionCode,
		dance: 'salsa',
		channel
	});
	it('covers the cases', () => {
		expect(updateState(at(2, 'direct'), null)).toBe('none');
		expect(updateState(at(2, 'direct'), release)).toBe('available');
		expect(updateState(at(2, 'direct'), { ...release, minVersionCode: 3 })).toBe('required');
		expect(updateState(at(3, 'direct'), release)).toBe('none');
		expect(updateState(at(2, 'play'), release)).toBe('none');
		expect(updateState(at(2, 'play'), { ...release, minVersionCode: 3 })).toBe('required');
	});
});

describe('deviceOf', () => {
	it('tells the platforms apart', () => {
		expect(deviceOf(CHROME)).toBe('android');
		expect(deviceOf(`${CHROME} SalsaApp/7 (salsa; direct)`)).toBe('android');
		expect(
			deviceOf(
				'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
			)
		).toBe('ios');
		expect(deviceOf('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(
			'ios'
		);
		expect(deviceOf('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0')).toBe(
			'other'
		);
		expect(deviceOf(null)).toBe('other');
	});
});
