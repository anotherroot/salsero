import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from './db';
import { songs, type Song } from './db/schema';
import { bpmOf, cleanBeats } from '$lib/beatgrid/beatgrid';
import type { Style, TempoFactor } from '$lib/labels';
import type { SongItem } from '$lib/types';

/** A claim older than this is presumed dead (laptop slept, worker crashed) and can be retaken. */
export const LEASE_MS = 15 * 60_000;
export const MAX_ATTEMPTS = 5;

const WAITING = ['waiting_download', 'waiting_analysis'] as const;

export function createSongFromUrl(
	db: Db,
	input: { url: string; title: string; style: Style }
): Song {
	return db
		.insert(songs)
		.values({
			sourceUrl: input.url,
			title: input.title,
			style: input.style,
			status: 'waiting_download'
		})
		.returning()
		.get();
}

export function createSongFromUpload(
	db: Db,
	input: { file: string; mime: string; title: string; style: Style }
): Song {
	return db
		.insert(songs)
		.values({
			audioFile: input.file,
			mime: input.mime,
			title: input.title,
			style: input.style,
			status: 'waiting_analysis'
		})
		.returning()
		.get();
}

export function listSongs(db: Db): SongItem[] {
	return db
		.select({
			id: songs.id,
			title: songs.title,
			artist: songs.artist,
			style: songs.style,
			sourceUrl: songs.sourceUrl,
			status: songs.status,
			error: songs.error,
			durationS: songs.durationS,
			bpm: songs.bpm,
			tempoFactor: songs.tempoFactor,
			createdAt: songs.createdAt
		})
		.from(songs)
		.where(isNull(songs.archivedAt))
		.orderBy(desc(songs.createdAt), desc(songs.id))
		.all() as SongItem[];
}

/** Ready, unarchived songs, for the practice-mode song picker. */
export function listReadySongs(db: Db): { id: number; title: string }[] {
	return db
		.select({ id: songs.id, title: songs.title })
		.from(songs)
		.where(and(isNull(songs.archivedAt), eq(songs.status, 'ready')))
		.orderBy(songs.title)
		.all();
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
	input: { title: string; artist: string | null; style: Style }
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
