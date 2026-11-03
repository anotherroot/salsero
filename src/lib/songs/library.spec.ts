import { describe, expect, it } from 'vitest';
import type { SongItem } from '$lib/types';
import {
	audioFileProblem,
	countOnlyMeta,
	libraryView,
	megabytes,
	readyMeta,
	songName,
	songState,
	uploadMeta
} from './library';

const MiB = 1024 * 1024;
const L = { salsa: 'Salsa' };

function song(id: number, title: string, over: Partial<SongItem> = {}): SongItem {
	return {
		id,
		title,
		artist: null,
		style: 'salsa',
		sourceUrl: null,
		status: 'ready',
		error: null,
		durationS: 323,
		bpm: 96,
		tempoFactor: 2,
		createdAt: id,
		sample: null,
		recentRank: null,
		sharedAt: null,
		...over
	};
}

const ids = (xs: SongItem[]) => xs.map((s) => s.id);

describe('libraryView', () => {
	it('puts Being added first, then Recent by rank, then the rest A–Z', () => {
		const v = libraryView(
			[
				song(5, 'Juliana', { status: 'waiting_analysis' }),
				song(4, 'Pedro Navaja', { status: 'failed' }),
				song(3, 'Quimbara', { recentRank: 1 }),
				song(2, 'Aguanile'),
				song(1, 'Valió la pena', { recentRank: 0 })
			],
			'',
			false
		);
		expect(v).toMatchObject({
			kind: 'list',
			addingHeading: 'Being added · 2',
			restHeading: 'All songs A–Z · 1',
			worker: true
		});
		if (v.kind !== 'list') throw new Error('list');
		expect(ids(v.adding)).toEqual([5, 4]);
		expect(ids(v.recent)).toEqual([1, 3]);
		expect(ids(v.rest)).toEqual([2]);
	});

	it('counts the upload in Being added and is not empty while uploading', () => {
		expect(libraryView([], '', true)).toMatchObject({
			kind: 'list',
			addingHeading: 'Being added · 1'
		});
		expect(libraryView([], '', false)).toEqual({ kind: 'empty' });
		const v = libraryView([song(1, 'x', { status: 'failed' })], '  ', true);
		expect(v).toMatchObject({ addingHeading: 'Being added · 2' });
	});

	it('shows the worker note only while a song waits', () => {
		const v = libraryView([song(1, 'x', { status: 'failed' })], '', false);
		expect(v).toMatchObject({ kind: 'list', worker: false });
		const w = libraryView([song(1, 'x', { status: 'waiting_download' })], '', false);
		expect(w).toMatchObject({ worker: true });
	});

	it('searches every state by title or artist, A–Z', () => {
		const songs = [
			song(1, 'Pedro Navaja', { status: 'failed' }),
			song(2, 'Bravo', { artist: 'Marc Anthony' }),
			song(3, 'Alpha', { artist: 'Marc Anthony' })
		];
		const a = libraryView(songs, 'navaja', false);
		expect(a.kind === 'search' && ids(a.hits)).toEqual([1]);
		expect(a).toMatchObject({ heading: '1 match · title or artist' });
		const b = libraryView(songs, 'MARC', false);
		expect(b.kind === 'search' && ids(b.hits)).toEqual([3, 2]);
		expect(b).toMatchObject({ heading: '2 matches · title or artist' });
		expect(libraryView(songs, 'zz', false)).toEqual({
			kind: 'search',
			hits: [],
			heading: '0 matches · title or artist'
		});
	});
});

describe('words', () => {
	it('words the meta and badge of each state', () => {
		expect(readyMeta(song(1, 'x'), L)).toBe('Salsa · 192 BPM · 5:23');
		expect(readyMeta(song(1, 'x', { bpm: null, durationS: null }), L)).toBe('Salsa');
		expect(songState(song(1, 'x', { status: 'waiting_download' }), L)).toMatchObject({
			meta: 'Salsa',
			tone: null,
			badge: { text: 'Waiting to download', tone: 'neutral', icon: 'clock' }
		});
		expect(songState(song(1, 'x', { status: 'waiting_analysis' }), L).badge).toEqual({
			text: 'Finding the beat',
			tone: 'accent',
			icon: 'metronome'
		});
		expect(
			songState(song(1, 'x', { status: 'failed', error: 'Video unavailable' }), L)
		).toMatchObject({ meta: 'Failed: Video unavailable', tone: 'danger', badge: null });
		expect(songState(song(1, 'x', { status: 'failed', error: null }), L).meta).toBe('Failed');
		expect(songState(song(1, 'x'), L)).toEqual({
			meta: 'Salsa · 192 BPM · 5:23',
			tone: null,
			badge: null
		});
	});

	it('names a song before it has a title', () => {
		expect(songName({ title: 'A', sourceUrl: 'u' })).toBe('A');
		expect(songName({ title: '', sourceUrl: 'https://youtu.be/x' })).toBe('https://youtu.be/x');
		expect(songName({ title: '', sourceUrl: null })).toBe('Untitled song');
	});

	it('says clave only where it exists', () => {
		expect(countOnlyMeta(true)).toBe('The count and clave, no song');
		expect(countOnlyMeta(false)).toBe('The count, no song');
	});

	it('refuses a file before uploading it', () => {
		expect(audioFileProblem({ size: 120 * MiB, type: 'audio/mpeg' })).toBe(
			'That file is 120 MB; the limit is 95 MB.'
		);
		expect(audioFileProblem({ size: 120 * MiB, type: 'video/mp4' })).toBe(
			'That file is 120 MB; the limit is 95 MB.'
		);
		expect(audioFileProblem({ size: MiB, type: 'video/mp4' })).toBe(
			'Only audio files can be added.'
		);
		expect(audioFileProblem({ size: 95 * MiB, type: 'audio/mp4' })).toBeNull();
	});

	it('words upload progress', () => {
		expect(megabytes(6 * MiB)).toBe('6');
		expect(megabytes(9.7 * MiB)).toBe('9.7');
		expect(megabytes(62.4 * MiB)).toBe('62');
		expect(megabytes(0.4 * MiB)).toBe('0.4');
		expect(uploadMeta(6 * MiB, 9.7 * MiB)).toBe('Uploading · 6 of 9.7 MB · keep the app open');
	});
});
