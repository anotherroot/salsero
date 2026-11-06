import { describe, expect, it } from 'vitest';
import type { PickerSong } from '$lib/types';
import { groupSongs, musicFirst, pickerCount, searchSongs, songMeta, songSections } from './search';

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
		group: null,
		groupId: null,
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

describe('pickerCount', () => {
	it('counts songs and matches', () => {
		expect(pickerCount(1, false)).toBe('1 song');
		expect(pickerCount(8, false)).toBe('8 songs');
		expect(pickerCount(1, true)).toBe('1 match');
		expect(pickerCount(0, true)).toBe('0 matches');
	});
});

describe("the groups' songs", () => {
	const mixed = [
		song(1, 'Mine B'),
		song(2, 'Chan Chan', { group: 'Salsa Tuesdays', groupId: 1 }),
		song(3, 'Mine A'),
		song(4, 'Zeta', { group: 'Advanced', groupId: 2 }),
		song(5, 'Abre', { group: 'Salsa Tuesdays', groupId: 1 }),
		song(6, 'Played', { group: 'Advanced', groupId: 2, recentRank: 0 })
	];

	it('groupSongs keeps the own songs in rest and gives each group its own list', () => {
		const g = groupSongs(mixed);
		expect(g.recent.map((s) => s.id)).toEqual([6]);
		expect(g.rest.map((s) => s.id)).toEqual([3, 1]);
		expect(g.groups.map((x) => [x.name, x.songs.map((s) => s.id)])).toEqual([
			['Advanced', [4]],
			['Salsa Tuesdays', [5, 2]]
		]);
	});

	it('sections: Recent, the own songs, then a heading per group', () => {
		expect(songSections(mixed).map((x) => [x.kind, x.label, x.songs.map((s) => s.id)])).toEqual([
			['recent', 'Recent', [6]],
			['yours', 'Your songs', [3, 1]],
			['group', 'Advanced', [4]],
			['group', 'Salsa Tuesdays', [5, 2]]
		]);
	});

	it('sections without groups keep the old headings', () => {
		expect(songSections(songs).map((x) => [x.kind, x.label])).toEqual([['yours', null]]);
		const played = [song(1, 'A', { recentRank: 0 }), song(2, 'B')];
		expect(songSections(played).map((x) => x.label)).toEqual(['Recent', 'All songs A–Z']);
	});

	it('sections leave out what is empty', () => {
		const onlyGroup = [song(2, 'Chan Chan', { group: 'Salsa Tuesdays', groupId: 1 })];
		expect(songSections(onlyGroup).map((x) => x.label)).toEqual(['Salsa Tuesdays']);
	});

	it('two groups of the same name stay apart, each under its own heading', () => {
		const twins = [
			song(1, 'B', { group: 'Class', groupId: 7 }),
			song(2, 'A', { group: 'Class', groupId: 3 }),
			song(3, 'C', { group: 'Class', groupId: 7 })
		];
		expect(groupSongs(twins).groups.map((g) => [g.id, g.name, g.songs.map((s) => s.id)])).toEqual([
			[3, 'Class', [2]],
			[7, 'Class', [1, 3]]
		]);
		expect(songSections(twins).map((x) => [x.kind, x.label])).toEqual([
			['group', 'Class'],
			['group', 'Class']
		]);
	});
});

describe("songSections with a row's Music first", () => {
	it('leads with those songs, in the given order, the rest as before', () => {
		const songs = [song(1, 'Alma'), song(2, 'Bembe'), song(3, 'Casa')];
		expect(
			songSections(songs, { label: 'Warmup', ids: [3, 1] }).map((x) => [
				x.kind,
				x.label,
				x.songs.map((s) => s.id)
			])
		).toEqual([
			['first', 'Warmup', [3, 1]],
			['yours', null, [1, 2, 3]]
		]);
	});
	it('leaves the lead out when none of its songs is offered', () => {
		const songs = [song(1, 'Alma')];
		expect(songSections(songs, { label: 'Warmup', ids: [9] }).map((x) => x.kind)).toEqual([
			'yours'
		]);
	});
});

describe('songMeta', () => {
	it('reads style, tempo and length, naming the group unless a heading does', () => {
		const s = song(1, 'Alma', { style: 'salsa', bpm: 94, durationS: 225, group: 'Tuesdays' });
		expect(songMeta(s, { salsa: 'Salsa' })).toBe('Tuesdays · Salsa · 94 BPM · 3:45');
		expect(songMeta(s, { salsa: 'Salsa' }, true)).toBe('Salsa · 94 BPM · 3:45');
	});
});

describe('musicFirst', () => {
	it("gathers the marked songs, in the row's order, under its name", () => {
		const songs = [
			song(1, 'Alma', { music: { label: 'Shines', rank: 1 } }),
			song(2, 'Bembe'),
			song(3, 'Casa', { music: { label: 'Shines', rank: 0 } })
		];
		expect(musicFirst(songs)).toEqual({ label: 'Shines', ids: [3, 1] });
	});
	it('is null with nothing marked', () => {
		expect(musicFirst([song(1, 'Alma')])).toBeNull();
	});
});
