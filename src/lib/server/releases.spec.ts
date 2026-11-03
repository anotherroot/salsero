import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { readRelease } from './releases';

const R = {
	versionCode: 2,
	versionName: '1.1',
	minVersionCode: 1,
	sha256: 'ab',
	size: 3,
	commit: 'c'
};
let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'releases-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('readRelease', () => {
	it('reads a valid release with its apk', () => {
		mkdirSync(join(dir, 'salsa'));
		writeFileSync(join(dir, 'salsa', 'current.json'), JSON.stringify(R));
		writeFileSync(join(dir, 'salsa', '2.apk'), 'x');
		expect(readRelease(dir, 'salsa')).toEqual(R);
	});
	it('is null without a folder', () => expect(readRelease(dir, 'salsa')).toBeNull());
	it('is null for invalid JSON', () => {
		mkdirSync(join(dir, 'salsa'));
		writeFileSync(join(dir, 'salsa', 'current.json'), '{nope');
		expect(readRelease(dir, 'salsa')).toBeNull();
	});
	it('is null when the apk is missing', () => {
		mkdirSync(join(dir, 'salsa'));
		writeFileSync(join(dir, 'salsa', 'current.json'), JSON.stringify(R));
		expect(readRelease(dir, 'salsa')).toBeNull();
	});
});
