import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
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
	retrySong,
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
		const a = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
		const b = createSongFromUpload(db, {
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
		const s = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
		expect(claimJob(db, T)?.id).toBe(s.id);
		expect(claimJob(db, T + LEASE_MS - 1)).toBeNull();
		expect(claimJob(db, T + LEASE_MS + 1)?.id).toBe(s.id);
		expect(getSong(db, s.id)?.attempts).toBe(2);
	});

	it('gives up after MAX_ATTEMPTS stale claims', () => {
		const s = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
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
		const s = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
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
		const up = createSongFromUpload(db, {
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

		const s = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
		expect(storeFetchedAudio(db, s.id, audio)).toBe(true);
		expect(storeFetchedAudio(db, s.id, { ...audio, file: 'again.m4a' })).toBe(false);
		expect(getSong(db, s.id)?.audioFile).toBe('new.m4a');
		expect(storeFetchedAudio(db, 999, audio)).toBe(false);
	});

	it('keeps a title the user typed', () => {
		const s = createSongFromUrl(db, { url: URL, title: 'Mine', style: 'salsa' });
		storeFetchedAudio(db, s.id, {
			file: 'a.opus',
			mime: 'audio/ogg',
			title: 'Theirs',
			durationS: 1
		});
		expect(getSong(db, s.id)?.title).toBe('Mine');
	});

	it('stores a cleaned analysis and marks the song ready', () => {
		const s = createSongFromUpload(db, {
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
		expect(listSongs(db)[0]).toMatchObject({ id: s.id, status: 'ready', durationS: 5 });
	});

	it('retries a transient failure and fails a permanent one', () => {
		const s = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
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
		const s = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
		expect(claimJob(db, T)?.id).toBe(s.id);
		failJob(db, s.id, 'network down', false);
		expect(claimJob(db, T + 1)).toBeNull();
		expect(claimJob(db, T + LEASE_MS - 1)).toBeNull();
		expect(claimJob(db, T + LEASE_MS + 1)?.id).toBe(s.id);
		expect(getSong(db, s.id)?.attempts).toBe(2);
	});

	it('fails the song on the last attempt even when the error is transient', () => {
		const s = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
		let now = T;
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			expect(claimJob(db, now)?.id).toBe(s.id);
			failJob(db, s.id, 'network down', false);
			now += LEASE_MS + 1;
		}
		expect(getSong(db, s.id)).toMatchObject({ status: 'failed', claimedAt: null });
	});

	it('ignores a failure report for a song that is no longer waiting', () => {
		const s = createSongFromUpload(db, {
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
		const s = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
		expect(retrySong(db, s.id)).toBeNull(); // waiting
		const up = createSongFromUpload(db, {
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
		const s = createSongFromUpload(db, {
			file: 'x.mp3',
			mime: 'audio/mpeg',
			title: 'x',
			style: 'salsa'
		});
		failJob(db, s.id, 'bad audio', true);
		expect(retrySong(db, s.id)?.status).toBe('waiting_analysis');
	});

	it('clears anchors when the tempo factor changes', () => {
		const s = createSongFromUpload(db, {
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
		const s = createSongFromUrl(db, { url: URL, title: '', style: 'salsa' });
		expect(archiveSong(db, s.id, T)).toBe(true);
		expect(listSongs(db)).toHaveLength(0);
		expect(claimJob(db, T)).toBeNull();
	});
});
