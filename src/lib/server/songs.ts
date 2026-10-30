import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, sets, songs, type Song } from './db/schema';
import { songGrid } from './grid';
import { sampleStart } from '$lib/songs/sample';
import { bpmOf, cleanBeats } from '$lib/beatgrid/beatgrid';
import type { DanceSlug } from '$lib/dances/dances';
import type { TempoFactor } from '$lib/labels';
import type { PickerSong, SampleSong, SongItem } from '$lib/types';

/** A claim older than this is presumed dead (laptop slept, worker crashed) and can be retaken. */
export const LEASE_MS = 15 * 60_000;
export const MAX_ATTEMPTS = 5;

const WAITING = ['waiting_download', 'waiting_analysis'] as const;

export function createSongFromUrl(
	db: Db,
	dance: DanceSlug,
	input: { url: string; title: string; style: string }
): Song {
	return db
		.insert(songs)
		.values({
			sourceUrl: input.url,
			title: input.title,
			style: input.style,
			status: 'waiting_download',
			dance
		})
		.returning()
		.get();
}

export function createSongFromUpload(
	db: Db,
	dance: DanceSlug,
	input: { file: string; mime: string; title: string; style: string }
): Song {
	return db
		.insert(songs)
		.values({
			audioFile: input.file,
			mime: input.mime,
			title: input.title,
			style: input.style,
			status: 'waiting_analysis',
			dance
		})
		.returning()
		.get();
}

export function songSample(song: Song): SampleSong | null {
	if (!song.audioFile) return null;
	const { beats, counts } = songGrid(song);
	return {
		id: song.id,
		audioFile: song.audioFile,
		startS: sampleStart({ durationS: song.durationS, beats, counts, customS: song.sampleStartS })
	};
}

export function listSongs(db: Db, dance: DanceSlug): SongItem[] {
	return db
		.select()
		.from(songs)
		.where(and(isNull(songs.archivedAt), eq(songs.dance, dance)))
		.orderBy(desc(songs.createdAt), desc(songs.id))
		.all()
		.map((s) => ({
			id: s.id,
			title: s.title,
			artist: s.artist,
			style: s.style,
			sourceUrl: s.sourceUrl,
			status: s.status,
			error: s.error,
			durationS: s.durationS,
			bpm: s.bpm,
			tempoFactor: s.tempoFactor as TempoFactor,
			createdAt: s.createdAt,
			sample: s.status === 'ready' ? songSample(s) : null
		}));
}

/**
 * The songs most recently practised in this dance's player, newest first and
 * distinct. Reads the latest 200 sets that name a song, which is far more than
 * five distinct songs need.
 */
export function recentSongIds(db: Db, dance: DanceSlug, limit = 5): number[] {
	const songId = sql<number | null>`json_extract(${sets.playerJson}, '$.songId')`;
	const rows = db
		.select({ songId })
		.from(sets)
		.innerJoin(exercises, eq(exercises.id, sets.exerciseId))
		.where(and(eq(exercises.dance, dance), sql`${songId} is not null`))
		.orderBy(desc(sets.doneAt), desc(sets.id))
		.limit(200)
		.all();
	const ids: number[] = [];
	for (const r of rows) {
		if (r.songId === null || ids.includes(r.songId)) continue;
		ids.push(r.songId);
		if (ids.length >= limit) break;
	}
	return ids;
}

/** Ready, unarchived songs of one dance, for the song popup: by title, with their sample and recency. */
export function songChoices(db: Db, dance: DanceSlug): PickerSong[] {
	const recent = recentSongIds(db, dance);
	const rows = db
		.select()
		.from(songs)
		.where(and(isNull(songs.archivedAt), eq(songs.status, 'ready'), eq(songs.dance, dance)))
		.orderBy(songs.title)
		.all();
	const out: PickerSong[] = [];
	for (const s of rows) {
		const sample = songSample(s);
		if (!sample) continue;
		const rank = recent.indexOf(s.id);
		out.push({
			id: s.id,
			title: s.title,
			artist: s.artist,
			style: s.style,
			bpm: s.bpm ? Math.round(s.bpm * s.tempoFactor) : null,
			durationS: s.durationS,
			sample,
			recentRank: rank < 0 ? null : rank
		});
	}
	return out;
}

/** Where the user wants the sample to start, or null for automatic. False, and nothing written, when out of range. */
export function setSampleStart(db: Db, id: number, startS: number | null): boolean {
	const song = getSong(db, id);
	if (!song) return false;
	if (startS !== null) {
		if (!Number.isFinite(startS) || startS < 0) return false;
		if (song.durationS !== null && startS >= song.durationS) return false;
	}
	db.update(songs).set({ sampleStartS: startS }).where(eq(songs.id, id)).run();
	return true;
}

export function getSong(db: Db, id: number): Song | null {
	return db.select().from(songs).where(eq(songs.id, id)).get() ?? null;
}

export function getSongByAudioFile(db: Db, file: string): Song | null {
	return db.select().from(songs).where(eq(songs.audioFile, file)).get() ?? null;
}

export function updateSongMeta(
	db: Db,
	id: number,
	input: { title: string; artist: string | null; style: string }
): Song | null {
	return db.update(songs).set(input).where(eq(songs.id, id)).returning().get() ?? null;
}

export function archiveSong(db: Db, id: number, now: number): boolean {
	return (
		db
			.update(songs)
			.set({ archivedAt: now })
			.where(and(eq(songs.id, id), isNull(songs.archivedAt)))
			.run().changes > 0
	);
}

/**
 * Put a failed song back in the queue: re-download if there is no audio yet.
 * Anything else (waiting, ready, archived) is left alone and gives null.
 */
export function retrySong(db: Db, id: number): Song | null {
	const song = getSong(db, id);
	if (!song || song.status !== 'failed' || song.archivedAt !== null) return null;
	return (
		db
			.update(songs)
			.set({
				status: song.audioFile ? 'waiting_analysis' : 'waiting_download',
				attempts: 0,
				error: null,
				claimedAt: null
			})
			.where(eq(songs.id, id))
			.returning()
			.get() ?? null
	);
}

export function setAnchors(db: Db, id: number, anchors: number[]): void {
	db.update(songs)
		.set({ anchorsJson: JSON.stringify(anchors) })
		.where(eq(songs.id, id))
		.run();
}

/** Beat indices mean something different at another tempo factor, so the anchors go too. */
export function setTempoFactor(db: Db, id: number, factor: TempoFactor): void {
	db.update(songs).set({ tempoFactor: factor, anchorsJson: '[]' }).where(eq(songs.id, id)).run();
}

export interface Job {
	id: number;
	kind: 'download' | 'analyze';
	url: string | null;
}

/**
 * Hand the oldest waiting song to the worker and lease it. A song whose last
 * claim went stale after MAX_ATTEMPTS tries is failed here instead, so a song
 * that crashes the worker every time cannot block the queue forever.
 */
export function claimJob(db: Db, now: number): Job | null {
	return db.transaction((tx) => {
		const stale = or(isNull(songs.claimedAt), lt(songs.claimedAt, now - LEASE_MS));
		tx.update(songs)
			.set({
				status: 'failed',
				error: `Gave up after ${MAX_ATTEMPTS} attempts.`,
				claimedAt: null
			})
			.where(
				and(
					isNull(songs.archivedAt),
					inArray(songs.status, WAITING),
					stale,
					sql`${songs.attempts} >= ${MAX_ATTEMPTS}`
				)
			)
			.run();

		const next = tx
			.select()
			.from(songs)
			.where(and(isNull(songs.archivedAt), inArray(songs.status, WAITING), stale))
			.orderBy(asc(songs.createdAt), asc(songs.id))
			.limit(1)
			.get();
		if (!next) return null;

		tx.update(songs)
			.set({ claimedAt: now, attempts: next.attempts + 1 })
			.where(eq(songs.id, next.id))
			.run();
		return {
			id: next.id,
			kind: next.status === 'waiting_download' ? 'download' : 'analyze',
			url: next.status === 'waiting_download' ? next.sourceUrl : null
		};
	});
}

/**
 * The worker downloaded the audio. Release the lease and move on to analysis;
 * the worker claims the analysis job next, normally straight away.
 * Only a song still waiting for its download takes audio this way; anything
 * else is left untouched and gives false.
 */
export function storeFetchedAudio(
	db: Db,
	id: number,
	input: { file: string; mime: string; title: string | null; durationS: number | null }
): boolean {
	const song = getSong(db, id);
	if (!song || song.status !== 'waiting_download') return false;
	return (
		db
			.update(songs)
			.set({
				audioFile: input.file,
				mime: input.mime,
				durationS: input.durationS,
				title: song.title === '' && input.title ? input.title.slice(0, 200) : song.title,
				status: 'waiting_analysis',
				claimedAt: null,
				error: null
			})
			.where(and(eq(songs.id, id), eq(songs.status, 'waiting_download')))
			.run().changes > 0
	);
}

export function storeAnalysis(
	db: Db,
	id: number,
	input: { beats: number[]; downbeats: number[]; durationS: number }
): void {
	const beats = cleanBeats(input.beats);
	db.update(songs)
		.set({
			beatsJson: JSON.stringify(beats),
			downbeatsJson: JSON.stringify(input.downbeats),
			bpm: bpmOf(beats),
			durationS: input.durationS,
			status: 'ready',
			claimedAt: null,
			error: null
		})
		.where(eq(songs.id, id))
		.run();
}

/**
 * A transient failure stays in the queue but keeps its lease: the lease is the
 * backoff, so the next try comes LEASE_MS after the claim rather than seconds
 * later. A permanent one (or the last attempt) fails the song and clears it.
 * A report about a song that is no longer waiting (a stale worker) is ignored.
 */
export function failJob(db: Db, id: number, error: string, permanent: boolean): void {
	const song = getSong(db, id);
	if (!song || !(WAITING as readonly string[]).includes(song.status)) return;
	const giveUp = permanent || song.attempts >= MAX_ATTEMPTS;
	db.update(songs)
		.set(
			giveUp
				? { error: error.slice(0, 500), claimedAt: null, status: 'failed' }
				: { error: error.slice(0, 500) }
		)
		.where(eq(songs.id, id))
		.run();
}
