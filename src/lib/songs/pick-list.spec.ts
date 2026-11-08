import { describe, expect, it } from 'vitest';
import {
	allState,
	initial,
	originLine,
	picksOut,
	rowMeta,
	selectAll,
	styleOf,
	withEdit,
	withTick
} from './pick-list';
import type { PickItem } from '$lib/types';

const STYLES = ['salsa', 'son', 'timba', 'other'];
const LABEL = { salsa: 'Salsa', son: 'Son', timba: 'Timba', other: 'Other' };
const item = (i: number, over: Partial<PickItem> = {}): PickItem => ({
	i,
	title: `Song ${i}`,
	artist: 'Grupo Niche',
	durationS: 311,
	url: `https://open.spotify.com/track/t${i}`,
	already: false,
	...over
});
const ITEMS = [item(0), item(1, { already: true }), item(2)];

describe('the pick list', () => {
	it('starts with nothing ticked and the first style for all', () => {
		const s = initial(ITEMS, STYLES);
		expect(s.ticked.size).toBe(0);
		expect(s.styleForAll).toBe('salsa');
		expect(allState(ITEMS, s)).toBe('none');
	});

	it('Select all ticks all but the already added; again, none', () => {
		const s = initial(ITEMS, STYLES);
		s.ticked = selectAll(ITEMS, s);
		expect([...s.ticked].sort()).toEqual([0, 2]);
		expect(allState(ITEMS, s)).toBe('all');
		s.ticked = selectAll(ITEMS, s);
		expect(s.ticked.size).toBe(0);
		s.ticked = new Set([0]);
		expect(allState(ITEMS, s)).toBe('some');
	});

	it("keeps a song's own style when Style for all changes", () => {
		const s = initial(ITEMS, STYLES);
		s.edits.set(0, { title: 'Song 0', artist: 'Grupo Niche', style: 'son' });
		s.styleForAll = 'timba';
		expect(styleOf(0, s)).toBe('son');
		expect(styleOf(2, s)).toBe('timba');
	});

	it('names a different style in the grey line, and only then', () => {
		const s = initial(ITEMS, STYLES);
		expect(rowMeta(ITEMS[0], s, LABEL)).toBe('Grupo Niche · 5:11');
		s.edits.set(0, { title: 'Song 0', artist: 'Grupo Niche', style: 'son' });
		expect(rowMeta(ITEMS[0], s, LABEL)).toBe('Grupo Niche · 5:11 · Son');
		expect(rowMeta(item(5, { artist: null }), s, LABEL)).toBe('5:11');
	});

	it('keeps where a song came from under its fields', () => {
		expect(originLine('spotify-playlist', item(0, { title: 'Que Locura' }))).toBe(
			'On Spotify: Que Locura · 5:11'
		);
		expect(originLine('youtube-playlist', item(0, { title: 'X', durationS: null }))).toBe(
			'On YouTube: X'
		);
	});

	it('sends only the ticked songs, as edited', () => {
		const s = initial(ITEMS, STYLES);
		s.ticked = new Set([2, 0]);
		s.edits.set(2, { title: 'Dos', artist: '', style: 'son' });
		expect(picksOut(ITEMS, s)).toEqual([
			{ i: 0, title: 'Song 0', artist: 'Grupo Niche', style: 'salsa' },
			{ i: 2, title: 'Dos', artist: null, style: 'son' }
		]);
	});
});

describe('the state updates', () => {
	it('tick and edit into new sets and maps', () => {
		const a = new Set([1]);
		const b = withTick(a, 2, true);
		expect([...b].sort()).toEqual([1, 2]);
		expect(a.size).toBe(1);
		expect([...withTick(b, 1, false)]).toEqual([2]);
		const m = new Map();
		const e = { title: 'x', artist: '', style: null };
		expect(withEdit(m, 3, e).get(3)).toEqual(e);
		expect(m.size).toBe(0);
	});
});
