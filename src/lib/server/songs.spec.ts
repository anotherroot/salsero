import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { createCustomExercise, logSet } from './exercises';
import {
	LEASE_MS,
	MAX_ATTEMPTS,
	archiveSong,
	claimJob,
	createSongFromUpload,
	createSongFromUrl,
	failJob,
	getSong,
	listSongs,
	recentSongIds,
	retrySong,
	setSampleStart,
	songChoices,
	setAnchors,
	setTempoFactor,
	storeAnalysis,
	storeFetchedAudio
} from './songs';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const URL = 'https://www.youtube.com/watch?v=YXnjy5YlDwk';
const T = 1_790_000_000_000;

describe('songs', () => {
	it('queues a URL for download and an upload for analysis, oldest first', () => {
		const a = createSongFromUrl(db, 'salsa', { url: URL, title: '', style: 'salsa' });
		const b = createSongFromUpload(db, 'salsa', {
			file: 'b.mp3',
			mime: 'audio/mpeg',
			title: 'Chan Chan',
			style: 'son'
		});
		expect(a.status).toBe('waiting_download');
		expect(b.status).toBe('waiting_analysis');
		expect(claimJob(db, T)).toEqual({ id: a.id, kind: 'download', url: URL });
		expect(claimJob(db, T)).toEqual({ id: b.id, kind: 'analyze', url: null });
		expect(claimJob(db, T)).toBeNull();
	});

	it('holds a lease, then lets a stale claim be taken again', () => {
		const s = createSongFromUrl(db, 'salsa', { url: URL, title: '', style: 'salsa' });
		expect(claimJob(db, T)?.id).toBe(s.id);
		expect(claimJob(db, T + LEASE_MS - 1)).toBeNull();
		expect(claimJob(db, T + LEASE_MS + 1)?.id).toBe(s.id);
		expect(getSong(db, s.id)?.attempts).toBe(2);
	});

	it('gives up after MAX_ATTEMPTS stale claims', () => {
		const s = createSongFromUrl(db, 'salsa', { url: URL, title: '', style: 'salsa' });
		let now = T;
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			expect(claimJob(db, now)?.id).toBe(s.id);
			now += LEASE_MS + 1;
		}
		expect(claimJob(db, now)).toBeNull();
		const row = getSong(db, s.id);
		expect(row?.status).toBe('failed');
		expect(row?.error).toMatch(/5 attempts/);
	});

	it('moves a fetched song to analysis and names it from the source when unnamed', () => {
		const s = createSongFromUrl(db, 'salsa', { url: URL, title: '', style: 'salsa' });
		claimJob(db, T);
		storeFetchedAudio(db, s.id, {
			file: 'a.opus',
			mime: 'audio/ogg',
			title: 'Vivir Mi Vida',
			durationS: 327
		});
		const row = getSong(db, s.id);
		expect(row?.status).toBe('waiting_analysis');
		expect(row?.title).toBe('Vivir Mi Vida');
		expect(row?.claimedAt).toBeNull();
		// The same claim continues straight into analysis.
		expect(claimJob(db, T)?.kind).toBe('analyze');
	});

	it('takes fetched audio only for a song waiting for its download', () => {
		const audio = { file: 'new.m4a', mime: 'audio/mp4', title: 'T', durationS: 1 };
		const up = createSongFromUpload(db, 'salsa', {
			file: 'x.mp3',
			mime: 'audio/mpeg',
			title: 'x',
			style: 'salsa'
		});
		expect(storeFetchedAudio(db, up.id, audio)).toBe(false);
		setAnchors(db, up.id, [3]);
		storeAnalysis(db, up.id, { beats: [0.5, 1], downbeats: [0.5], durationS: 5 });
		expect(storeFetchedAudio(db, up.id, audio)).toBe(false);
		expect(getSong(db, up.id)).toMatchObject({
			audioFile: 'x.mp3',
			status: 'ready',
			anchorsJson: '[3]'
		});

		const s = createSongFromUrl(db, 'salsa', { url: URL, title: '', style: 'salsa' });
		expect(storeFetchedAudio(db, s.id, audio)).toBe(true);
		expect(storeFetchedAudio(db, s.id, { ...audio, file: 'again.m4a' })).toBe(false);
		expect(getSong(db, s.id)?.audioFile).toBe('new.m4a');
		expect(storeFetchedAudio(db, 999, audio)).toBe(false);
	});

	it('keeps a title the user typed', () => {
		const s = createSongFromUrl(db, 'salsa', { url: URL, title: 'Mine', style: 'salsa' });
		storeFetchedAudio(db, s.id, {
			file: 'a.opus',
			mime: 'audio/ogg',
			title: 'Theirs',
			durationS: 1
		});
		expect(getSong(db, s.id)?.title).toBe('Mine');
	});

	it('stores a cleaned analysis and marks the song ready', () => {
		const s = createSongFromUpload(db, 'salsa', {
			file: 'x.mp3',
			mime: 'audio/mpeg',
			title: 'x',
			style: 'salsa'
		});
		claimJob(db, T);
		// A gap of two missing beats at 2.0 and 2.5.
		storeAnalysis(db, s.id, { beats: [0.5, 1, 1.5, 3, 3.5, 4], downbeats: [0.5], durationS: 5 });
		const row = getSong(db, s.id);
		expect(row?.status).toBe('ready');
		expect(JSON.parse(row?.beatsJson ?? '[]')).toHaveLength(8);
		expect(row?.bpm).toBeCloseTo(120);
		expect(listSongs(db, 'salsa')[0]).toMatchObject({ id: s.id, status: 'ready', durationS: 5 });
	});

	it('retries a transient failure and fails a permanent one', () => {
		const s = createSongFromUrl(db, 'salsa', { url: URL, title: '', style: 'salsa' });
		claimJob(db, T);
		failJob(db, s.id, 'network down', false);
		// The lease stays: it is the backoff before the next try.
		expect(getSong(db, s.id)).toMatchObject({
			status: 'waiting_download',
			claimedAt: T,
			error: 'network down'
		});
		claimJob(db, T + LEASE_MS + 1);
		failJob(db, s.id, 'Video unavailable', true);
		expect(getSong(db, s.id)).toMatchObject({
			status: 'failed',
			error: 'Video unavailable',
			claimedAt: null
		});
		expect(retrySong(db, s.id)).toMatchObject({
			status: 'waiting_download',
			attempts: 0,
			error: null
		});
	});

	it('does not hand a transiently failed song out again until its lease runs out', () => {
		const s = createSongFromUrl(db, 'salsa', { url: URL, title: '', style: 'salsa' });
		expect(claimJob(db, T)?.id).toBe(s.id);
		failJob(db, s.id, 'network down', false);
		expect(claimJob(db, T + 1)).toBeNull();
		expect(claimJob(db, T + LEASE_MS - 1)).toBeNull();
		expect(claimJob(db, T + LEASE_MS + 1)?.id).toBe(s.id);
		expect(getSong(db, s.id)?.attempts).toBe(2);
	});

	it('fails the song on the last attempt even when the error is transient', () => {
		const s = createSongFromUrl(db, 'salsa', { url: URL, title: '', style: 'salsa' });
		let now = T;
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			expect(claimJob(db, now)?.id).toBe(s.id);
			failJob(db, s.id, 'network down', false);
			now += LEASE_MS + 1;
		}
		expect(getSong(db, s.id)).toMatchObject({ status: 'failed', claimedAt: null });
	});

	it('ignores a failure report for a song that is no longer waiting', () => {
		const s = createSongFromUpload(db, 'salsa', {
			file: 'x.mp3',
			mime: 'audio/mpeg',
			title: 'x',
			style: 'salsa'
		});
		storeAnalysis(db, s.id, { beats: [0.5, 1], downbeats: [0.5], durationS: 5 });
		failJob(db, s.id, 'stale worker', true);
		expect(getSong(db, s.id)).toMatchObject({ status: 'ready', error: null });
	});

	it('retries only a failed, unarchived song', () => {
		const s = createSongFromUrl(db, 'salsa', { url: URL, title: '', style: 'salsa' });
		expect(retrySong(db, s.id)).toBeNull(); // waiting
		const up = createSongFromUpload(db, 'salsa', {
			file: 'x.mp3',
			mime: 'audio/mpeg',
			title: 'x',
			style: 'salsa'
		});
		storeAnalysis(db, up.id, { beats: [0.5, 1], downbeats: [0.5], durationS: 5 });
		expect(retrySong(db, up.id)).toBeNull(); // ready
		expect(getSong(db, up.id)?.status).toBe('ready');
		failJob(db, s.id, 'Video unavailable', true);
		archiveSong(db, s.id, T);
		expect(retrySong(db, s.id)).toBeNull(); // archived
		expect(getSong(db, s.id)?.status).toBe('failed');
		expect(retrySong(db, 999)).toBeNull();
	});

	it('retries an uploaded song by analysing it again', () => {
		const s = createSongFromUpload(db, 'salsa', {
			file: 'x.mp3',
			mime: 'audio/mpeg',
			title: 'x',
			style: 'salsa'
		});
		failJob(db, s.id, 'bad audio', true);
		expect(retrySong(db, s.id)?.status).toBe('waiting_analysis');
	});

	it('clears anchors when the tempo factor changes', () => {
		const s = createSongFromUpload(db, 'salsa', {
			file: 'x.mp3',
			mime: 'audio/mpeg',
			title: 'x',
			style: 'salsa'
		});
		setAnchors(db, s.id, [3, 19]);
		expect(getSong(db, s.id)?.anchorsJson).toBe('[3,19]');
		setTempoFactor(db, s.id, 2);
		expect(getSong(db, s.id)).toMatchObject({ tempoFactor: 2, anchorsJson: '[]' });
	});

	it('archives out of the list and the queue', () => {
		const s = createSongFromUrl(db, 'salsa', { url: URL, title: '', style: 'salsa' });
		expect(archiveSong(db, s.id, T)).toBe(true);
		expect(listSongs(db, 'salsa')).toHaveLength(0);
		expect(claimJob(db, T)).toBeNull();
	});
});

describe('songs are walled off by dance', () => {
	it('lists only its own dance', () => {
		createSongFromUpload(db, 'salsa', {
			file: 'a.m4a',
			mime: 'audio/mp4',
			title: 'El Cantante',
			style: 'salsa'
		});
		createSongFromUpload(db, 'bachata', {
			file: 'b.m4a',
			mime: 'audio/mp4',
			title: 'Obsesion',
			style: 'sensual'
		});

		expect(listSongs(db, 'salsa').map((s) => s.title)).toEqual(['El Cantante']);
		expect(listSongs(db, 'bachata').map((s) => s.title)).toEqual(['Obsesion']);
	});

	it('still lets the dance-blind worker claim either', () => {
		createSongFromUrl(db, 'bachata', {
			url: 'https://example.test/x',
			title: '',
			style: 'sensual'
		});
		expect(claimJob(db, 1_000)).not.toBeNull();
	});
});

describe('song samples and the picker', () => {
	// 120 BPM: a beat every 0.5 s from 0, 90 s long. With no anchors the count
	// starts at beat 0, so a 1 falls every 4 s; a third of 90 s is 30, which
	// snaps back to 28.
	const beats = Array.from({ length: 180 }, (_, i) => i * 0.5);
	let n = 0;
	beforeEach(() => {
		n = 0;
	});
	const readySong = (title: string, dance: 'salsa' | 'bachata' = 'salsa') => {
		const s = createSongFromUpload(db, dance, {
			file: `s${n++}.mp3`,
			mime: 'audio/mpeg',
			title,
			style: 'salsa'
		});
		storeAnalysis(db, s.id, { beats, downbeats: [], durationS: 90 });
		return s;
	};
	const ex = (dance: 'salsa' | 'bachata' = 'salsa') =>
		createCustomExercise(db, dance, { name: `E${n++}`, everyDays: 1, notes: null });
	const play = (exerciseId: number, doneAt: number, songId: number | null | 'count') =>
		logSet(db, {
			exerciseId,
			doneAt,
			durationS: null,
			reps: null,
			rating: null,
			note: null,
			playerJson: songId === 'count' ? '{"count":true}' : JSON.stringify({ songId })
		});

	it('lists ready songs of the dance by title, with sample start and bpm', () => {
		readySong('Zeta');
		const a = readySong('Alpha');
		readySong('Other dance', 'bachata');
		createSongFromUrl(db, 'salsa', { url: URL, title: 'Waiting', style: 'salsa' });
		setTempoFactor(db, a.id, 2);
		const rows = songChoices(db, 'salsa');
		expect(rows.map((r) => r.title)).toEqual(['Alpha', 'Zeta']);
		expect(rows[0].bpm).toBe(240);
		expect(rows[1].bpm).toBe(120);
		expect(rows[1].sample).toEqual({ id: rows[1].id, audioFile: 's0.mp3', startS: 28 });
		expect(rows.every((r) => r.recentRank === null)).toBe(true);
	});

	it('sets, snaps, rejects and clears the sample start', () => {
		const s = readySong('A');
		const start = () => songChoices(db, 'salsa')[0].sample.startS;
		expect(setSampleStart(db, s.id, 43.9)).toBe(true);
		expect(start()).toBe(40);
		expect(setSampleStart(db, s.id, 95)).toBe(false);
		expect(setSampleStart(db, s.id, -1)).toBe(false);
		expect(getSong(db, s.id)?.sampleStartS).toBe(43.9);
		expect(setSampleStart(db, s.id, null)).toBe(true);
		expect(start()).toBe(28);
	});

	it('finds the songs practised most recently, newest first and distinct', () => {
		const a = readySong('A');
		const b = readySong('B');
		const c = readySong('C', 'bachata');
		const e = ex();
		const other = ex('bachata');
		play(e.id, 100, a.id);
		play(e.id, 200, b.id);
		play(e.id, 300, a.id);
		play(e.id, 400, null);
		play(e.id, 500, 'count');
		play(other.id, 600, c.id);
		expect(recentSongIds(db, 'salsa')).toEqual([a.id, b.id]);
		expect(recentSongIds(db, 'salsa', 1)).toEqual([a.id]);
		expect(recentSongIds(db, 'bachata')).toEqual([c.id]);
	});

	it('ranks the recent songs in the picker and leaves archived ones out', () => {
		const a = readySong('A');
		const b = readySong('B');
		const c = readySong('C');
		const d = readySong('D');
		const e = ex();
		play(e.id, 100, d.id);
		play(e.id, 200, b.id);
		play(e.id, 300, a.id);
		archiveSong(db, d.id, T);
		const rows = songChoices(db, 'salsa');
		expect(rows.map((r) => [r.title, r.recentRank])).toEqual([
			['A', 0],
			['B', 1],
			['C', null]
		]);
		expect(c.id).toBeGreaterThan(0);
	});

	it('gives a ready song its sample and a waiting one none', () => {
		const r = readySong('Ready');
		createSongFromUpload(db, 'salsa', {
			file: 'w.mp3',
			mime: 'audio/mpeg',
			title: 'Waiting',
			style: 'salsa'
		});
		const rows = listSongs(db, 'salsa');
		expect(rows.find((s) => s.id === r.id)?.sample).toEqual({
			id: r.id,
			audioFile: 's0.mp3',
			startS: 28
		});
		expect(rows.find((s) => s.title === 'Waiting')?.sample).toBeNull();
	});
});
