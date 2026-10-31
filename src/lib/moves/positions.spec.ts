import { describe, expect, it } from 'vitest';
import { gapsTitle, positionBadges, positionMeta } from './positions';

const base = { inCount: 0, outCount: 0, deadEnd: false, orphan: false, unused: false };

describe('positionMeta', () => {
	it('is the plain counts for a connected position', () => {
		expect(positionMeta({ ...base, inCount: 14, outCount: 16 })).toEqual({
			text: '14 in · 16 out',
			tone: null,
			mutedTitle: false
		});
	});
	it('names a dead end and marks it danger', () => {
		expect(positionMeta({ ...base, inCount: 2, deadEnd: true })).toEqual({
			text: '2 in · 0 out · dead end',
			tone: 'danger',
			mutedTitle: false
		});
	});
	it('names an orphan', () => {
		expect(positionMeta({ ...base, outCount: 1, orphan: true }).text).toBe('0 in · 1 out · orphan');
		expect(positionMeta({ ...base, outCount: 1, orphan: true }).tone).toBe('danger');
	});
	it('mutes the title of an unused position', () => {
		expect(positionMeta({ ...base, unused: true })).toEqual({
			text: '0 in · 0 out · unused',
			tone: null,
			mutedTitle: true
		});
	});
});

describe('positionBadges', () => {
	it('lists the counts and the gap', () => {
		expect(positionBadges({ ...base, inCount: 2, deadEnd: true })).toEqual([
			{ text: '2 in', tone: 'neutral' },
			{ text: '0 out', tone: 'neutral' },
			{ text: 'dead end', tone: 'danger', icon: 'warning' }
		]);
	});
	it('has no gap badge on a connected position', () => {
		expect(positionBadges({ ...base, inCount: 3, outCount: 4 })).toHaveLength(2);
	});
	it('names an orphan and an unused position', () => {
		expect(positionBadges({ ...base, outCount: 1, orphan: true }).at(-1)).toEqual({
			text: 'orphan',
			tone: 'danger',
			icon: 'warning'
		});
		expect(positionBadges({ ...base, unused: true }).at(-1)).toEqual({
			text: 'unused',
			tone: 'neutral'
		});
	});
});

describe('gapsTitle', () => {
	it('counts dead ends and orphans together', () => {
		expect(
			gapsTitle([
				{ deadEnd: true, orphan: false },
				{ deadEnd: false, orphan: true }
			])
		).toBe('2 gaps in the graph');
	});
	it('is singular for one', () => {
		expect(gapsTitle([{ deadEnd: true, orphan: false }])).toBe('1 gap in the graph');
	});
	it('is null with no gap', () => {
		expect(gapsTitle([{ deadEnd: false, orphan: false }])).toBeNull();
		expect(gapsTitle([])).toBeNull();
	});
});
