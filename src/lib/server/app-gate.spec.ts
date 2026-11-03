import { describe, expect, it } from 'vitest';
import { refusesOldApp } from './app-gate';
import type { AppAgent, Release } from '$lib/app-update/agent';

const release: Release = {
	versionCode: 5,
	versionName: '1.4',
	minVersionCode: 4,
	sha256: 'x',
	size: 1,
	commit: 'abc'
};
const old: AppAgent = { versionCode: 3, dance: 'salsa', channel: 'direct' };

describe('refusesOldApp', () => {
	it('refuses an app below the minimum on the API', () => {
		expect(refusesOldApp('/api/device/today', old, release)).toBe(true);
	});
	it('lets the update check through', () => {
		expect(refusesOldApp('/api/app-update/salsa', old, release)).toBe(false);
	});
	it('leaves the worker alone', () => {
		expect(refusesOldApp('/api/worker/next', old, release)).toBe(false);
	});
	it('leaves pages alone', () => {
		expect(refusesOldApp('/salsa', old, release)).toBe(false);
	});
	it('needs an agent and a release', () => {
		expect(refusesOldApp('/api/device/today', null, release)).toBe(false);
		expect(refusesOldApp('/api/device/today', old, null)).toBe(false);
	});
	it('lets the minimum itself through', () => {
		expect(refusesOldApp('/api/device/today', { ...old, versionCode: 4 }, release)).toBe(false);
	});
});
