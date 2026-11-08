import { describe, expect, it } from 'vitest';
import { readPicks } from './import-form';
import type { ImportItem } from '$lib/types';

const ITEMS: ImportItem[] = [0, 1, 2].map((n) => ({
	title: `Song ${n}`,
	artist: `Artist ${n}`,
	durationS: 200,
	url: `https://www.youtube.com/watch?v=v${n}`
}));
const STYLES = ['salsa', 'son', 'timba', 'other'];
const read = (v: unknown) => readPicks(JSON.stringify(v), ITEMS, STYLES, 'salsa');

describe('readPicks', () => {
	it('reads the ticked songs with what was typed', () => {
		expect(
			read([
				{ i: 2, title: `  ${'x'.repeat(250)}  `, artist: 'Me', style: 'son' },
				{ i: 0, title: '', artist: '', style: 'bachata' }
			])
		).toEqual([
			{ i: 2, title: 'x'.repeat(200), artist: 'Me', style: 'son' },
			{ i: 0, title: 'Song 0', artist: null, style: 'salsa' }
		]);
	});

	it('refuses an index out of range or twice, and anything not a list of picks', () => {
		expect(read([{ i: 3, title: 'a', artist: null, style: 'salsa' }])).toBeNull();
		expect(read([{ i: -1, title: 'a', artist: null, style: 'salsa' }])).toBeNull();
		expect(
			read([
				{ i: 1, title: 'a', artist: null, style: 'salsa' },
				{ i: 1, title: 'b', artist: null, style: 'salsa' }
			])
		).toBeNull();
		expect(readPicks('not json', ITEMS, STYLES, 'salsa')).toBeNull();
		expect(read({ i: 0 })).toBeNull();
	});
});
