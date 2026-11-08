import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NO_FILES, T1_SALSA, T2_SALSA, U1_BACHATA, U1_SALSA } from '$lib/server/test-walls';
import { eq } from 'drizzle-orm';
import { exercises, songs, teamChanges, teams, users } from './db/schema';
import { openDb, type Db } from './db';
import type { Space } from './scope';
import { createTeam } from './teams';
import { leaveTeam } from './membership';
import { usedBytesOf } from './storage';
import { cloneFilesIn, type CloneFiles } from './clones/files';
import { makeMine } from './clones/edit';
import { ARCHIVED_SONG_COPY } from '$lib/clones/view';
import { makeClass, SHARED_FILE, type Class } from './test-class';
import { createCustomExercise, logSet } from './exercises';
import {
	LEASE_MS,
	MAX_ATTEMPTS,
	archiveSong,
	claimJob,
	createSongFromUpload,
	createSongFromUrl,
	deleteSong,
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
	storeFetchedAudio,
	useAudioUrl
} from './songs';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const URL = 'https://www.youtube.com/watch?v=YXnjy5YlDwk';
const T = 1_790_000_000_000;

describe('songs', () => {
	it('queues a URL for download and an upload for analysis, oldest first', () => {
		const a = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
		const b = createSongFromUpload(db, U1_SALSA, {
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
		const s = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
		expect(claimJob(db, T)?.id).toBe(s.id);
		expect(claimJob(db, T + LEASE_MS - 1)).toBeNull();
		expect(claimJob(db, T + LEASE_MS + 1)?.id).toBe(s.id);
		expect(getSong(db, s.id)?.attempts).toBe(2);
	});

	it('gives up after MAX_ATTEMPTS stale claims', () => {
		const s = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
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
		const s = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
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
		const up = createSongFromUpload(db, U1_SALSA, {
			file: 'x.mp3',
			mime: 'audio/mpeg',
			title: 'x',
			style: 'salsa'
		});
		expect(storeFetchedAudio(db, up.id, audio)).toEqual({ ok: false });
		setAnchors(db, up.id, [3]);
		storeAnalysis(db, up.id, { beats: [0.5, 1], downbeats: [0.5], durationS: 5 });
		expect(storeFetchedAudio(db, up.id, audio)).toEqual({ ok: false });
		expect(getSong(db, up.id)).toMatchObject({
			audioFile: 'x.mp3',
			status: 'ready',
			anchorsJson: '[3]'
		});

		const s = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
		expect(storeFetchedAudio(db, s.id, audio)).toEqual({ ok: true, replaced: null });
		expect(storeFetchedAudio(db, s.id, { ...audio, file: 'again.m4a' })).toEqual({ ok: false });
		expect(getSong(db, s.id)?.audioFile).toBe('new.m4a');
		expect(storeFetchedAudio(db, 999, audio)).toEqual({ ok: false });
	});

	it('claim hands out the audio link before the source', () => {
		const s = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
		expect(claimJob(db, T)?.url).toBe(URL);
		failJob(db, s.id, 'x', true);
		retrySong(db, s.id);
		db.update(songs).set({ audioUrl: 'https://youtu.be/other' }).where(eq(songs.id, s.id)).run();
		expect(claimJob(db, T + LEASE_MS + 1)?.url).toBe('https://youtu.be/other');
	});

	it('storeFetchedAudio fills the artist only when empty and records what was fetched', () => {
		const a = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
		storeFetchedAudio(db, a.id, {
			file: 'a.m4a',
			mime: 'audio/mp4',
			title: 'Cali Pachanguero',
			artist: 'Grupo Niche',
			fetchedUrl: 'https://www.youtube.com/watch?v=n1',
			fetchedTitle: 'Grupo Niche - Cali Pachanguero (Audio)',
			durationS: 312
		});
		expect(getSong(db, a.id)).toMatchObject({
			artist: 'Grupo Niche',
			fetchedUrl: 'https://www.youtube.com/watch?v=n1',
			fetchedTitle: 'Grupo Niche - Cali Pachanguero (Audio)'
		});
		const b = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
		db.update(songs).set({ artist: 'Mine' }).where(eq(songs.id, b.id)).run();
		storeFetchedAudio(db, b.id, {
			file: 'b.m4a',
			mime: 'audio/mp4',
			title: null,
			artist: 'Grupo Niche',
			durationS: 1
		});
		expect(getSong(db, b.id)?.artist).toBe('Mine');
	});

	it("storeFetchedAudio replaces a swapped song's file", () => {
		const s = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
		db.update(songs).set({ audioFile: 'old.m4a' }).where(eq(songs.id, s.id)).run();
		expect(
			storeFetchedAudio(db, s.id, { file: 'new.m4a', mime: 'audio/mp4', title: null, durationS: 1 })
		).toEqual({ ok: true, replaced: 'old.m4a' });
		expect(getSong(db, s.id)?.audioFile).toBe('new.m4a');
	});

	it('storeFetchedAudio without the new fields leaves them null', () => {
		const s = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
		storeFetchedAudio(db, s.id, { file: 'n.m4a', mime: 'audio/mp4', title: 'T', durationS: 1 });
		expect(getSong(db, s.id)).toMatchObject({ artist: null, fetchedUrl: null, fetchedTitle: null });
	});

	it('keeps a title the user typed', () => {
		const s = createSongFromUrl(db, U1_SALSA, { url: URL, title: 'Mine', style: 'salsa' });
		storeFetchedAudio(db, s.id, {
			file: 'a.opus',
			mime: 'audio/ogg',
			title: 'Theirs',
			durationS: 1
		});
		expect(getSong(db, s.id)?.title).toBe('Mine');
	});

	it('stores a cleaned analysis and marks the song ready', () => {
		const s = createSongFromUpload(db, U1_SALSA, {
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
		expect(listSongs(db, U1_SALSA)[0]).toMatchObject({ id: s.id, status: 'ready', durationS: 5 });
	});

	it('retries a transient failure and fails a permanent one', () => {
		const s = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
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
		const s = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
		expect(claimJob(db, T)?.id).toBe(s.id);
		failJob(db, s.id, 'network down', false);
		expect(claimJob(db, T + 1)).toBeNull();
		expect(claimJob(db, T + LEASE_MS - 1)).toBeNull();
		expect(claimJob(db, T + LEASE_MS + 1)?.id).toBe(s.id);
		expect(getSong(db, s.id)?.attempts).toBe(2);
	});

	it('fails the song on the last attempt even when the error is transient', () => {
		const s = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
		let now = T;
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			expect(claimJob(db, now)?.id).toBe(s.id);
			failJob(db, s.id, 'network down', false);
			now += LEASE_MS + 1;
		}
		expect(getSong(db, s.id)).toMatchObject({ status: 'failed', claimedAt: null });
	});

	it('ignores a failure report for a song that is no longer waiting', () => {
		const s = createSongFromUpload(db, U1_SALSA, {
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
		const s = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
		expect(retrySong(db, s.id)).toBeNull(); // waiting
		const up = createSongFromUpload(db, U1_SALSA, {
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
		const s = createSongFromUpload(db, U1_SALSA, {
			file: 'x.mp3',
			mime: 'audio/mpeg',
			title: 'x',
			style: 'salsa'
		});
		failJob(db, s.id, 'bad audio', true);
		expect(retrySong(db, s.id)?.status).toBe('waiting_analysis');
	});

	it('clears anchors when the tempo factor changes', () => {
		const s = createSongFromUpload(db, U1_SALSA, {
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
		const s = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
		expect(archiveSong(db, s.id, T)).toBe(true);
		expect(listSongs(db, U1_SALSA)).toHaveLength(0);
		expect(claimJob(db, T)).toBeNull();
	});
});

describe('songs are walled off by dance', () => {
	it('lists only its own dance', () => {
		createSongFromUpload(db, U1_SALSA, {
			file: 'a.m4a',
			mime: 'audio/mp4',
			title: 'El Cantante',
			style: 'salsa'
		});
		createSongFromUpload(db, U1_BACHATA, {
			file: 'b.m4a',
			mime: 'audio/mp4',
			title: 'Obsesion',
			style: 'sensual'
		});

		expect(listSongs(db, U1_SALSA).map((s) => s.title)).toEqual(['El Cantante']);
		expect(listSongs(db, U1_BACHATA).map((s) => s.title)).toEqual(['Obsesion']);
	});

	it('still lets the dance-blind worker claim either', () => {
		createSongFromUrl(db, U1_BACHATA, {
			url: 'https://example.test/x',
			title: '',
			style: 'sensual'
		});
		expect(claimJob(db, 1_000)).not.toBeNull();
	});
});

describe("a group's songs", () => {
	const add = (space: typeof T1_SALSA | typeof U1_SALSA, title: string) =>
		createSongFromUrl(db, space, { url: URL, title, style: 'salsa' });
	beforeEach(() => {
		createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
	});

	it('are owned by the group alone and listed in its space only', () => {
		const g = add(T1_SALSA, 'Group');
		expect(g).toMatchObject({ userId: null, teamId: 1, sharedAt: null, dance: 'salsa' });
		const u = createSongFromUpload(db, T1_SALSA, {
			file: 'g.mp3',
			mime: 'audio/mpeg',
			title: 'Uploaded',
			style: 'salsa'
		});
		expect(u).toMatchObject({ userId: null, teamId: 1 });
		add(U1_SALSA, 'Mine');
		expect(listSongs(db, U1_SALSA).map((s) => s.title)).toEqual(['Mine']);
		expect(listSongs(db, T1_SALSA).map((s) => s.title)).toEqual(['Uploaded', 'Group']);
		expect(listSongs(db, T2_SALSA)).toEqual([]);
		expect(listSongs(db, U1_SALSA)[0].sharedAt).toBeNull();
	});

	it('lists drafts first, then the shared ones, newest first in each', () => {
		const a = add(T1_SALSA, 'A').id;
		add(T1_SALSA, 'B');
		const c = add(T1_SALSA, 'C').id;
		add(T1_SALSA, 'D');
		db.update(songs).set({ sharedAt: 5 }).where(eq(songs.id, a)).run();
		db.update(songs).set({ sharedAt: 6 }).where(eq(songs.id, c)).run();
		const list = listSongs(db, T1_SALSA);
		expect(list.map((s) => [s.title, s.sharedAt])).toEqual([
			['D', null],
			['B', null],
			['C', 6],
			['A', 5]
		]);
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
		const s = createSongFromUpload(
			db,
			{ userId: 'u1', dance },
			{
				file: `s${n++}.mp3`,
				mime: 'audio/mpeg',
				title,
				style: 'salsa'
			}
		);
		storeAnalysis(db, s.id, { beats, downbeats: [], durationS: 90 });
		return s;
	};
	const ex = (dance: 'salsa' | 'bachata' = 'salsa') =>
		createCustomExercise(
			db,
			{ userId: 'u1', dance },
			{ name: `E${n++}`, everyDays: 1, notes: null }
		);
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
		createSongFromUrl(db, U1_SALSA, { url: URL, title: 'Waiting', style: 'salsa' });
		setTempoFactor(db, a.id, 2);
		const rows = songChoices(db, U1_SALSA);
		expect(rows.map((r) => r.title)).toEqual(['Alpha', 'Zeta']);
		expect(rows[0].bpm).toBe(240);
		expect(rows[1].bpm).toBe(120);
		expect(rows[1].sample).toEqual({ id: rows[1].id, audioFile: 's0.mp3', startS: 28 });
		expect(rows.every((r) => r.recentRank === null)).toBe(true);
	});

	it('keeps a song with a malformed beats_json, with an unsnapped start', () => {
		const a = readySong('Broken');
		db.update(songs).set({ beatsJson: '{not json' }).where(eq(songs.id, a.id)).run();
		const rows = songChoices(db, U1_SALSA);
		expect(rows.map((r) => r.title)).toEqual(['Broken']);
		expect(rows[0].sample.startS).toBe(30);
	});

	it('sets, snaps, rejects and clears the sample start', () => {
		const s = readySong('A');
		const start = () => songChoices(db, U1_SALSA)[0].sample.startS;
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
		expect(recentSongIds(db, U1_SALSA)).toEqual([a.id, b.id]);
		expect(recentSongIds(db, U1_SALSA, 1)).toEqual([a.id]);
		expect(recentSongIds(db, U1_BACHATA)).toEqual([c.id]);
	});

	it('ranks the recent songs in the library list, ready songs only', () => {
		const a = readySong('A');
		readySong('B');
		const w = createSongFromUrl(db, U1_SALSA, { url: URL, title: '', style: 'salsa' });
		const e = ex();
		play(e.id, 100, a.id);
		const byId = new Map(listSongs(db, U1_SALSA).map((r) => [r.id, r.recentRank]));
		expect(byId.get(a.id)).toBe(0);
		expect(byId.get(w.id)).toBeNull();
		expect([...byId.values()].filter((r) => r === null)).toHaveLength(2);
	});

	it('ranks the recent songs in the picker and leaves archived ones out', () => {
		const a = readySong('A');
		const b = readySong('B');
		readySong('C');
		const d = readySong('D');
		const e = ex();
		play(e.id, 100, d.id);
		play(e.id, 200, b.id);
		play(e.id, 300, a.id);
		archiveSong(db, d.id, T);
		const rows = songChoices(db, U1_SALSA);
		expect(rows.map((r) => [r.title, r.recentRank])).toEqual([
			['A', 0],
			['B', 1],
			['C', null]
		]);
	});

	it('gives a ready song its sample and a waiting one none', () => {
		const r = readySong('Ready');
		createSongFromUpload(db, U1_SALSA, {
			file: 'w.mp3',
			mime: 'audio/mpeg',
			title: 'Waiting',
			style: 'salsa'
		});
		const rows = listSongs(db, U1_SALSA);
		expect(rows.find((s) => s.id === r.id)?.sample).toEqual({
			id: r.id,
			audioFile: 's0.mp3',
			startS: 28
		});
		expect(rows.find((s) => s.title === 'Waiting')?.sample).toBeNull();
	});
});

describe('recent songs skip what the picker will not show', () => {
	it('fills ranks from 0 when the newest recent song is archived or the log has bad JSON', () => {
		const mk = (title: string, file: string) => {
			const s = createSongFromUpload(db, U1_SALSA, {
				file,
				mime: 'audio/mpeg',
				title,
				style: 'salsa'
			});
			storeAnalysis(db, s.id, { beats: [0.5, 1], downbeats: [], durationS: 90 });
			return s;
		};
		const a = mk('A', 'a.mp3');
		const b = mk('B', 'b.mp3');
		const waiting = createSongFromUpload(db, U1_SALSA, {
			file: 'w.mp3',
			mime: 'audio/mpeg',
			title: 'W',
			style: 'salsa'
		});
		const e = createCustomExercise(db, U1_SALSA, { name: 'E', everyDays: 1, notes: null });
		const log = (doneAt: number, playerJson: string) =>
			logSet(db, {
				exerciseId: e.id,
				doneAt,
				durationS: null,
				reps: null,
				rating: null,
				note: null,
				playerJson
			});
		log(100, JSON.stringify({ songId: b.id }));
		log(200, JSON.stringify({ songId: a.id }));
		log(300, JSON.stringify({ songId: waiting.id }));
		log(400, '{not json');
		log(450, JSON.stringify({ songId: 'x' }));
		log(500, JSON.stringify({ songId: 1.5 }));
		const gone = mk('Gone', 'g.mp3');
		log(600, JSON.stringify({ songId: gone.id }));
		archiveSong(db, gone.id, T);
		expect(recentSongIds(db, U1_SALSA)).toEqual([a.id, b.id]);
		expect(songChoices(db, U1_SALSA).map((r) => [r.title, r.recentRank])).toEqual([
			['A', 0],
			['B', 1]
		]);
	});
});

describe('deleteSong', () => {
	const mk = (wall = U1_SALSA, file = 's.mp3') => {
		const s = createSongFromUpload(db, wall, {
			file,
			mime: 'audio/mpeg',
			title: 'T',
			style: 'son'
		});
		db.update(songs).set({ status: 'ready' }).where(eq(songs.id, s.id)).run();
		return s;
	};
	const exercise = (songId: number, name: string, archivedAt: number | null) =>
		db
			.insert(exercises)
			.values({
				name,
				source: 'custom',
				everyDays: 3,
				practiceMode: 'song',
				songId,
				userId: 'u1',
				archivedAt
			} as never)
			.returning()
			.get();

	it('is null for another person’s song and a missing one, deleting nothing', () => {
		const s = mk();
		expect(deleteSong(db, 'u2', s.id)).toBeNull();
		expect(deleteSong(db, 'u1', 999)).toBeNull();
		expect(getSong(db, s.id)).not.toBeNull();
	});

	it('is refused with busy while the worker is still on it', () => {
		const s = mk();
		db.update(songs).set({ status: 'waiting_analysis' }).run();
		expect(deleteSong(db, 'u1', s.id)).toEqual({ ok: false, usedBy: [], busy: true });
		expect(getSong(db, s.id)).not.toBeNull();
	});

	it('deletes the row and hands back the audio file', () => {
		const s = mk();
		expect(deleteSong(db, 'u1', s.id)).toEqual({ ok: true, file: 's.mp3' });
		expect(getSong(db, s.id)).toBeNull();
	});

	it('is refused while a live exercise uses it, naming the exercise', () => {
		const s = mk();
		exercise(s.id, 'Warm up', null);
		expect(deleteSong(db, 'u1', s.id)).toEqual({ ok: false, usedBy: ['Warm up'] });
		expect(getSong(db, s.id)).not.toBeNull();
	});

	it('clears the link on archived exercises in the same go', () => {
		const s = mk();
		const e = exercise(s.id, 'Old', 5);
		expect(deleteSong(db, 'u1', s.id)).toMatchObject({ ok: true });
		expect(db.select().from(exercises).where(eq(exercises.id, e.id)).get()!.songId).toBeNull();
	});
});

describe("the picker lists the shared songs of the person's groups", () => {
	let c: Class;
	beforeEach(() => {
		c = makeClass(db);
	});
	const mine = (userId: string, title: string) => {
		const s = createSongFromUpload(
			db,
			{ userId, dance: 'salsa' },
			{ file: `${userId}-${title}.mp3`, mime: 'audio/mpeg', title, style: 'salsa' }
		);
		storeAnalysis(db, s.id, { beats: [0.5, 1, 1.5, 2], downbeats: [], durationS: 90 });
		return s.id;
	};
	const choices = (userId: string) =>
		songChoices(db, { userId, dance: 'salsa' }).map((s) => [s.title, s.group]);

	it('a member: their own songs, then the shared ones with the group named', () => {
		mine('u3', 'Zeta');
		expect(choices('u3')).toEqual([
			['Zeta', null],
			['Chan Chan', 'Salsa Tuesdays']
		]);
		expect(songChoices(db, { userId: 'u3', dance: 'salsa' }).map((s) => s.groupId)).toEqual([
			null,
			1
		]);
	});

	it('an editor sees the shared list too, never a draft', () => {
		expect(choices('u2')).toEqual([['Chan Chan', 'Salsa Tuesdays']]);
	});

	it('an outsider, a former member and the other dance see none of the group’s', async () => {
		expect(choices('u4')).toEqual([]);
		await leaveTeam(db, 1, 'u3', { mode: 'all' }, NO_FILES, T);
		// A former member who kept everything has their own copy, not the group's.
		expect(choices('u3')).toEqual([['Chan Chan', null]]);
		expect(songChoices(db, { userId: 'u2', dance: 'bachata' })).toEqual([]);
	});

	it('a deleted song or group is gone from the list', () => {
		db.update(songs).set({ archivedAt: T }).where(eq(songs.id, c.shared)).run();
		expect(choices('u3')).toEqual([]);
		db.update(songs).set({ archivedAt: null }).where(eq(songs.id, c.shared)).run();
		db.update(teams).set({ deletedAt: T }).where(eq(teams.id, 1)).run();
		expect(choices('u3')).toEqual([]);
	});

	it('a shared song practised to is Recent; one no longer shared is not', () => {
		const own = mine('u3', 'Own');
		const log = (doneAt: number, songId: number) =>
			logSet(db, {
				exerciseId: c.entry,
				doneAt,
				durationS: null,
				reps: null,
				rating: null,
				note: null,
				playerJson: JSON.stringify({ songId })
			});
		log(100, own);
		log(200, c.shared);
		const ranks = () =>
			songChoices(db, { userId: 'u3', dance: 'salsa' }).map((s) => [s.title, s.recentRank]);
		expect(ranks()).toEqual([
			['Own', 1],
			['Chan Chan', 0]
		]);
		db.update(songs).set({ sharedAt: null }).where(eq(songs.id, c.shared)).run();
		expect(ranks()).toEqual([['Own', 0]]);
	});
});

describe('Make it mine on a class song', () => {
	let c: Class;
	let dir: string;
	let files: CloneFiles;
	const U3 = { userId: 'u3', dance: 'salsa' } as const;
	const ROOMY = 1024 ** 4;
	/** u3's Make it mine: the copy's song row, or the refusal. */
	const copySong = async (id: number, as = 'u3', now = T, free = ROOMY) => {
		const res = await makeMine(db, { ...U3, userId: as }, 'song', id, files, now, free);
		return res.ok ? { song: getSong(db, res.id)! } : res;
	};
	beforeEach(() => {
		c = makeClass(db);
		dir = mkdtempSync(join(tmpdir(), 'salsa-song-copy-'));
		writeFileSync(join(dir, SHARED_FILE), 'bytes');
		files = cloneFilesIn({ recording: dir, 'lesson-video': dir, audio: dir });
		setTempoFactor(db, c.shared, 2);
		setAnchors(db, c.shared, [4, 12]);
		setSampleStart(db, c.shared, 12);
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("makes a personal song with the teacher's count and a new file, charged to the member", async () => {
		const res = await copySong(c.shared);
		if (!('song' in res)) throw new Error('refused');
		const from = getSong(db, c.shared)!;
		const copy = res.song;
		expect(copy).toMatchObject({
			userId: 'u3',
			teamId: null,
			sharedAt: null,
			dance: 'salsa',
			status: 'ready',
			title: from.title,
			artist: from.artist,
			style: from.style,
			beatsJson: from.beatsJson,
			downbeatsJson: from.downbeatsJson,
			anchorsJson: from.anchorsJson,
			tempoFactor: 2,
			sampleStartS: 12,
			mime: from.mime,
			durationS: from.durationS,
			bpm: from.bpm,
			sizeBytes: 1000
		});
		expect(copy.id).not.toBe(from.id);
		expect(copy.audioFile).not.toBe(SHARED_FILE);
		expect(readFileSync(join(dir, copy.audioFile!), 'utf8')).toBe('bytes');
		expect(usedBytesOf(db, { userId: 'u3' })).toBe(1000);
		// Nothing logged: the copy is the member's, not a change to the group.
		expect(db.select().from(teamChanges).where(eq(teamChanges.rootId, copy.id)).all()).toEqual([]);
	});

	it('copying a song twice reuses the first copy', async () => {
		const first = await copySong(c.shared);
		if (!('song' in first)) throw new Error('refused');
		const again = await copySong(c.shared);
		expect('song' in again && again.song.id).toBe(first.song.id);
		expect(readdirSync(dir).sort()).toEqual([SHARED_FILE, first.song.audioFile].sort());
		expect(usedBytesOf(db, { userId: 'u3' })).toBe(1000);
	});

	it('an archived copy is refused with what to do: a person’s song has no restore', async () => {
		const first = await copySong(c.shared);
		if (!('song' in first)) throw new Error('refused');
		archiveSong(db, first.song.id, T + 1);
		expect(await copySong(c.shared, 'u3', T + 2)).toEqual({
			ok: false,
			reason: 'archived',
			message: ARCHIVED_SONG_COPY
		});
		expect(readdirSync(dir).sort()).toEqual([SHARED_FILE, first.song.audioFile].sort());
		expect(db.select().from(songs).where(eq(songs.userId, 'u3')).all()).toHaveLength(1);
	});

	it('refuses over the limit and under the disk floor, leaving no row and no file', async () => {
		db.update(users).set({ storageLimitBytes: 999 }).where(eq(users.id, 'u3')).run();
		const before = db.select().from(songs).all().length;
		const res = await copySong(c.shared);
		expect(res).toMatchObject({ reason: 'room', room: { ok: false, limitBytes: 999 } });
		db.update(users).set({ storageLimitBytes: null }).where(eq(users.id, 'u3')).run();
		expect(await copySong(c.shared, 'u3', T, 0)).toMatchObject({
			reason: 'room',
			room: { ok: false }
		});
		expect(db.select().from(songs).all()).toHaveLength(before);
		expect(readdirSync(dir)).toEqual([SHARED_FILE]);
	});

	it('a draft, a personal song, an outsider and an editor are denied', async () => {
		const denied = { ok: false, reason: 'denied' };
		expect(await copySong(c.draft)).toEqual(denied);
		expect(await copySong(c.shared, 'u4')).toEqual(denied);
		expect(await copySong(c.shared, 'u2')).toEqual(denied);
		const own = createSongFromUpload(
			db,
			{ userId: 'u3', dance: 'salsa' },
			{ file: SHARED_FILE.replace('c1', 'd1'), mime: 'audio/mpeg', title: 'Own', style: 'salsa' }
		);
		expect(await copySong(own.id)).toEqual(denied);
	});
});

describe('useAudioUrl', () => {
	const NEW = 'https://youtu.be/Fd8nEwF3hHk';
	function ready(space: Space = U1_SALSA) {
		const s = createSongFromUrl(db, space, { url: URL, title: 'S', style: 'salsa' });
		storeFetchedAudio(db, s.id, {
			file: `f${s.id}.m4a`,
			mime: 'audio/mp4',
			title: null,
			durationS: 60
		});
		storeAnalysis(db, s.id, { beats: [0.5, 1], downbeats: [], durationS: 60 });
		setAnchors(db, s.id, [1]);
		setSampleStart(db, s.id, 12);
		return s.id;
	}

	it('points a ready song at the new link and queues it, keeping the old file', () => {
		const id = ready();
		expect(useAudioUrl(db, id, NEW, U1_SALSA, T)).toMatchObject({ ok: true });
		expect(getSong(db, id)).toMatchObject({
			audioUrl: NEW,
			status: 'waiting_download',
			anchorsJson: '[]',
			sampleStartS: null,
			attempts: 0,
			error: null,
			claimedAt: null,
			audioFile: `f${id}.m4a`
		});
	});

	it('takes a failed song too', () => {
		const s = createSongFromUrl(db, U1_SALSA, { url: URL, title: 'S', style: 'salsa' });
		failJob(db, s.id, 'No match on YouTube', true);
		expect(useAudioUrl(db, s.id, NEW, U1_SALSA, T)).toMatchObject({ ok: true });
		expect(getSong(db, s.id)?.status).toBe('waiting_download');
	});

	it('refuses while the worker is on it, an upload, and nothing', () => {
		const waiting = createSongFromUrl(db, U1_SALSA, { url: URL, title: 'S', style: 'salsa' });
		expect(useAudioUrl(db, waiting.id, NEW, U1_SALSA, T)).toEqual({ ok: false, reason: 'busy' });
		storeFetchedAudio(db, waiting.id, {
			file: 'w.m4a',
			mime: 'audio/mp4',
			title: null,
			durationS: 1
		});
		expect(useAudioUrl(db, waiting.id, NEW, U1_SALSA, T)).toEqual({ ok: false, reason: 'busy' });
		const up = createSongFromUpload(db, U1_SALSA, {
			file: 'u.mp3',
			mime: 'audio/mpeg',
			title: 'U',
			style: 'salsa'
		});
		storeAnalysis(db, up.id, { beats: [0.5, 1], downbeats: [], durationS: 5 });
		expect(useAudioUrl(db, up.id, NEW, U1_SALSA, T)).toEqual({ ok: false, reason: 'upload' });
		expect(useAudioUrl(db, 999, NEW, U1_SALSA, T)).toEqual({ ok: false, reason: 'missing' });
	});

	it("logs a group song's swap once, as an edit of its audio", () => {
		createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
		const id = ready(T1_SALSA);
		const before = db.select().from(teamChanges).all().length;
		useAudioUrl(db, id, NEW, T1_SALSA, T);
		const logged = db.select().from(teamChanges).all().slice(before);
		expect(logged).toHaveLength(1);
		expect(logged[0]).toMatchObject({ verb: 'edit', subject: 'audio', rootId: id });
	});
});
