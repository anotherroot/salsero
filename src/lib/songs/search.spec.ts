import { describe, expect, it } from 'vitest';
import type { PickerSong } from '$lib/types';
import { groupSongs, searchSongs } from './search';

function song(id: number, title: string, over: Partial<PickerSong> = {}): PickerSong {
	return {
		id,
		title,
		artist: null,
		style: 'salsa',
		bpm: null,
		durationS: null,
		sample: { id, audioFile: `${id}.mp3`, startS: 0 },
		recentRank: null,
		...over
	};
}

const songs = [
	song(1, 'Quimbara'),
	song(2, 'Valió la pena', { artist: 'Marc Anthony' }),
	song(3, 'Idilio')
];

describe('searchSongs', () => {
	it('ignores accents', () => {
		expect(searchSongs(songs, 'valio').map((s) => s.id)).toEqual([2]);
	});
	it('trims and ignores case', () => {
		expect(searchSongs(songs, '  QUIM ').map((s) => s.id)).toEqual([1]);
	});
	it('matches the artist', () => {
		expect(searchSongs(songs, 'anthony').map((s) => s.id)).toEqual([2]);
	});
	it('treats punctuation literally', () => {
		expect(searchSongs(songs, '(')).toEqual([]);
	});
	it('lists everything A to Z for a blank query', () => {
		expect(searchSongs(songs, '   ').map((s) => s.title)).toEqual([
			'Idilio',
			'Quimbara',
			'Valió la pena'
		]);
	});
});

describe('groupSongs', () => {
	it('puts recents by rank and the rest A to Z', () => {
		const g = groupSongs([
			song(1, 'B', { recentRank: 1 }),
			song(2, 'Z'),
			song(3, 'A', { recentRank: 0 }),
			song(4, 'M')
		]);
		expect(g.recent.map((s) => s.id)).toEqual([3, 1]);
		expect(g.rest.map((s) => s.id)).toEqual([4, 2]);
	});
});
