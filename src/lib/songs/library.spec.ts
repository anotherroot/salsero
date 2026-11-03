import { describe, expect, it } from 'vitest';
import type { SongItem } from '$lib/types';
import {
	audioFileProblem,
	classLibraryView,
	classSongNote,
	countOnlyMeta,
	deleteSongBody,
	deleteSongTitle,
	groupSectionHeading,
	groupSections,
	libraryView,
	sharedMeta,
	songDeleteWarning,
	songUseWarning,
	stopSharingBody,
	stopSharingTitle,
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

describe('class songs', () => {
	it('warns how many people practise with the song', () => {
		expect(songUseWarning(1)).toBe(
			"Used in 1 person's practice. They'll switch to count only until you share it again."
		);
		expect(songUseWarning(4)).toBe(
			"Used in 4 people's practice. They'll switch to count only until you share it again."
		);
	});

	it('warns Delete that Restore brings it back', () => {
		expect(songDeleteWarning(1)).toBe(
			"Used in 1 person's practice. They'll switch to count only until you restore it."
		);
		expect(songDeleteWarning(4)).toBe(
			"Used in 4 people's practice. They'll switch to count only until you restore it."
		);
	});

	it('lists the group’s songs: Being added, Drafts, then Shared with the class', () => {
		const songs = [
			song(5, 'Waiting', { status: 'waiting_download' }),
			song(4, 'Zeta', { sharedAt: 9 }),
			song(3, 'Beta'),
			song(2, 'Alpha', { sharedAt: 8 }),
			song(1, 'Gamma')
		];
		const view = classLibraryView(songs, '', false);
		if (view.kind !== 'class') throw new Error(view.kind);
		expect(ids(view.adding)).toEqual([5]);
		expect(ids(view.drafts)).toEqual([3, 1]);
		expect(ids(view.shared)).toEqual([2, 4]);
		expect(view.addingHeading).toBe('Being added · 1');
		expect(view.draftsHeading).toBe('Drafts · 2');
		expect(view.sharedHeading).toBe('Shared with the class · 2');
		expect(view.worker).toBe(true);
	});

	it('is empty only with no song and no upload, and searches like Music', () => {
		expect(classLibraryView([], '', false).kind).toBe('empty');
		expect(classLibraryView([], '', true).kind).toBe('class');
		// A query is always a search, own songs or none, so no match never reads "No songs yet".
		expect(libraryView([], 'x', false)).toMatchObject({ kind: 'search', hits: [] });
		const view = classLibraryView(
			[song(1, 'Chan Chan', { sharedAt: 1 }), song(2, 'Other')],
			'chan',
			false
		);
		expect(view.kind === 'search' && ids(view.hits)).toEqual([1]);
	});

	it('words a shared song’s meta with how many use it', () => {
		const s = song(1, 'x', { tempoFactor: 1, bpm: 180, durationS: 200 });
		expect(sharedMeta(s, L, 0)).toBe('Salsa · 180 BPM · 3:20');
		expect(sharedMeta(s, L, 3)).toBe('Salsa · 180 BPM · 3:20 · used by 3');
	});

	it('words a group’s section, the read-only note and the sheets', () => {
		expect(groupSectionHeading('Salsa Tuesdays', 6)).toBe('Salsa Tuesdays · 6');
		expect(classSongNote('Salsa Tuesdays')).toBe(
			"Salsa Tuesdays's song. The count is the teacher's."
		);
		expect(stopSharingTitle('Chan Chan')).toBe('Stop sharing Chan Chan?');
		expect(deleteSongTitle('Chan Chan')).toBe('Delete Chan Chan?');
	});
});

describe('groupSections', () => {
	const groups = [
		{ team: { id: 1, name: 'Salsa Tuesdays' }, songs: [song(2, 'Zeta'), song(1, 'Chan Chan')] },
		{ team: { id: 2, name: 'Other' }, songs: [song(3, 'Elsewhere')] }
	];

	it('heads each group with its count, its songs A–Z', () => {
		const out = groupSections(groups, '');
		expect(out.map((g) => g.heading)).toEqual(['Salsa Tuesdays · 2', 'Other · 1']);
		expect(ids(out[0].songs)).toEqual([1, 2]);
	});

	it('keeps only the matches, and drops a group with none', () => {
		const out = groupSections(groups, 'chan');
		expect(out.map((g) => [g.heading, ids(g.songs)])).toEqual([['Salsa Tuesdays · 1', [1]]]);
	});
});

describe('Stop sharing and Delete', () => {
	it('warn only when members practise with the song', () => {
		expect(stopSharingBody(0)).toBe('Members no longer see it, and it is a draft again.');
		expect(stopSharingBody(2)).toBe(
			"Members no longer see it, and it is a draft again. Used in 2 people's practice. They'll switch to count only until you share it again."
		);
		expect(deleteSongBody(0)).toBe('It goes to Recently deleted for 30 days.');
		expect(deleteSongBody(1)).toBe(
			"It goes to Recently deleted for 30 days. Used in 1 person's practice. They'll switch to count only until you restore it."
		);
	});
});
