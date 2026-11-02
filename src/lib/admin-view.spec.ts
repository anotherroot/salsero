import { describe, expect, it } from 'vitest';
import {
	gbToBytes,
	LIMIT_PRESETS_GB,
	personMeta,
	presetLabel,
	requestUsesLine
} from './admin-view';

const MB = 1024 * 1024;
const GB = 1024 ** 3;

describe('admin view', () => {
	it('presets are 2, 5 and 10 GB', () => {
		expect(LIMIT_PRESETS_GB.map(presetLabel)).toEqual(['2 GB', '5 GB', '10 GB']);
	});
	it('gbToBytes takes positive numbers only', () => {
		expect(gbToBytes(2)).toBe(2 * GB);
		expect(gbToBytes(0.5)).toBe(GB / 2);
		for (const bad of [0, -1, NaN, Infinity, 1e9]) expect(gbToBytes(bad)).toBeUndefined();
	});
	it('words', () => {
		expect(requestUsesLine(840 * MB, GB)).toBe('Uses 840 MB of 1.0 GB');
		expect(personMeta({ day: '2026-11-02', usedBytes: 0, limitBytes: null })).toBe(
			'Joined 2 Nov 2026 · 0 MB, no limit'
		);
	});
});
