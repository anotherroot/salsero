import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, sets, songLinks, songs, teamMembers, teams, type Song } from './db/schema';
import { songGrid } from './grid';
import { sampleStart } from '$lib/songs/sample';
import { shownExercise } from '$lib/exercises/name';
import { bpmOf, cleanBeats } from '$lib/beatgrid/beatgrid';
import { isTeam, ownedBy, ownerValues, type Space, type Wall } from './scope';
import { shadowedIds } from './clones/shadow';
import { fieldChange, logChange } from './changes';
import type { TempoFactor } from '$lib/labels';
import type { ChangeValues, PickerSong, SampleSong, SongItem, TeamRef } from '$lib/types';

/** A claim older than this is presumed dead (laptop slept, worker crashed) and can be retaken. */
export const LEASE_MS = 15 * 60_000;
export const MAX_ATTEMPTS = 5;

const WAITING = ['waiting_download', 'waiting_analysis'] as const;

/** A song in this space, and a group's `add` in its History. */
function insertSong(db: Db, space: Space, values: typeof songs.$inferInsert, now: number): Song {
	return db.transaction((tx) => {
		const song = tx
			.insert(songs)
			.values({ ...values, ...ownerValues(space) })
			.returning()
			.get();
		logChange(
			tx,
			space,
			{
				rootKind: 'song',
				rootId: song.id,
				verb: 'add',
				subject: 'song',
				after: { name: song.title }
			},
			now
		);
		return song;
	});
}

/** A song in this space: a person's, or a group's draft (`shared_at` null). */
export function createSongFromUrl(
	db: Db,
	space: Space,
	input: { url: string; title: string; style: string },
	now = Date.now()
): Song {
	return insertSong(
		db,
		space,
		{
			sourceUrl: input.url,
			title: input.title,
			style: input.style,
			status: 'waiting_download'
		},
		now
	);
}

export function createSongFromUpload(
	db: Db,
	space: Space,
	input: { file: string; mime: string; title: string; style: string; sizeBytes?: number },
	now = Date.now()
): Song {
	return insertSong(
		db,
		space,
		{
			audioFile: input.file,
			mime: input.mime,
			title: input.title,
			style: input.style,
			sizeBytes: input.sizeBytes ?? null,
			status: 'waiting_analysis'
		},
		now
	);
}

/**
 * Write a song's fields and, for a group's song edited in its space, log
 * the `edit` (only the fields that changed; nothing when none did).
 * `subject` names the change (`anchors`, `tempoFactor`) in place of the one
 * field that changed. Null when there is no such song.
 */
function editSong(
	db: Db,
	id: number,
	set: Partial<typeof songs.$inferInsert>,
	space: Space | undefined,
	now: number,
	subject?: string
): Song | null {
	return db.transaction((tx) => {
		const before = tx.select().from(songs).where(eq(songs.id, id)).get();
		if (!before) return null;
		const after = tx.update(songs).set(set).where(eq(songs.id, id)).returning().get();
		if (space && isTeam(space) && before.teamId === space.teamId) {
			const fields = (s: Song): ChangeValues =>
				Object.fromEntries(
					Object.keys(set).map((k) => [k, s[k as keyof Song] as string | number | null])
				);
			const change = fieldChange(fields(before), fields(after), 'song');
			if (change) {
				logChange(
					tx,
					space,
					{
						rootKind: 'song',
						rootId: id,
						verb: 'edit',
						...change,
						subject: subject ?? change.subject
					},
					now
				);
			}
		}
		return after;
	});
}

export function songSample(song: Song): SampleSong | null {
	if (!song.audioFile) return null;
	// A malformed `beats_json` must not take every page that lists songs down.
	let beats: number[] = [];
	let counts: ReturnType<typeof songGrid>['counts'] = [];
	try {
		({ beats, counts } = songGrid(song));
	} catch {
		/* unsnapped start */
	}
	return {
		id: song.id,
		audioFile: song.audioFile,
		startS: sampleStart({ durationS: song.durationS, beats, counts, customS: song.sampleStartS })
	};
}

/**
 * The live songs of one space, newest first. A group's: its drafts first, then
 * the shared ones. Recency is a person's own practice, so a group's list has none.
 */
export function listSongs(db: Db, space: Space): SongItem[] {
	const recent = isTeam(space) ? [] : recentSongIds(db, space);
	return db
		.select()
		.from(songs)
		.where(and(isNull(songs.archivedAt), ownedBy(songs, space)))
		.orderBy(
			// Drafts (no shared_at) first; a person's songs are all drafts by this rule.
			sql`${songs.sharedAt} is not null`,
			desc(songs.createdAt),
			desc(songs.id)
		)
		.all()
		.map((s) => songItem(s, recent));
}

/** A song as Music lists it; `recent` ranks a person's own (none for a group's). */
function songItem(s: Song, recent: number[]): SongItem {
	const r = recent.indexOf(s.id);
	return {
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
		sample: s.status === 'ready' ? songSample(s) : null,
		recentRank: s.status === 'ready' && r >= 0 ? r : null,
		sharedAt: s.sharedAt
	};
}

/**
 * The class playlists in a person's Music: the shared, live songs of each
 * live group of this dance they belong to now, a section per group by name,
 * each A–Z. Never a draft, editors included: drafts show only in group mode.
 */
export function listSharedSongs(
	db: Db,
	userId: string,
	dance: Space['dance']
): { team: TeamRef; songs: SongItem[] }[] {
	const rows = db
		.select({ song: songs, teamId: teams.id, teamName: teams.name })
		.from(songs)
		.innerJoin(teams, eq(teams.id, songs.teamId))
		.innerJoin(
			teamMembers,
			and(eq(teamMembers.teamId, songs.teamId), eq(teamMembers.userId, userId))
		)
		.where(
			and(
				isNull(songs.archivedAt),
				isNotNull(songs.sharedAt),
				isNull(songs.userId),
				eq(songs.dance, dance),
				eq(teams.dance, dance),
				isNull(teams.deletedAt),
				isNull(teams.purgedAt)
			)
		)
		.orderBy(teams.name, teams.id, songs.title, songs.id)
		.all();
	const out: { team: TeamRef; songs: SongItem[] }[] = [];
	// Yours replaces theirs: a class song you made your own copy of shows in your list.
	const hidden = shadowedIds(
		db,
		{ userId, dance },
		'song',
		rows.map((r) => r.song.id)
	);
	for (const r of rows) {
		if (hidden.has(r.song.id)) continue;
		let section = out.at(-1);
		if (section?.team.id !== r.teamId) {
			section = { team: { id: r.teamId, name: r.teamName }, songs: [] };
			out.push(section);
		}
		section.songs.push(songItem(r.song, []));
	}
	return out;
}

/**
 * The songs most recently practised in this dance's player, newest first and
 * distinct, ready and unarchived only (so a song the picker will not show
 * cannot eat a slot). The window is the latest 200 sets of the dance, bounded
 * first; song ids are read from their JSON in code, so a malformed row is
 * skipped rather than throwing. The person's own songs, or with `among`, the
 * songs the caller offers (the picker's, a group's shared ones included).
 */
export function recentSongIds(db: Db, wall: Wall, limit = 5, among?: Set<number>): number[] {
	const rows = db
		.select({ playerJson: sets.playerJson })
		.from(sets)
		.innerJoin(exercises, eq(exercises.id, sets.exerciseId))
		.where(and(eq(exercises.dance, wall.dance), eq(exercises.userId, wall.userId)))
		.orderBy(desc(sets.doneAt), desc(sets.id))
		.limit(200)
		.all();
	const seen: number[] = [];
	for (const r of rows) {
		const id = songIdOf(r.playerJson);
		if (id !== null && !seen.includes(id)) seen.push(id);
	}
	if (seen.length === 0) return [];
	const visible =
		among ??
		new Set(
			db
				.select({ id: songs.id })
				.from(songs)
				.where(
					and(
						inArray(songs.id, seen),
						isNull(songs.archivedAt),
						eq(songs.status, 'ready'),
						eq(songs.dance, wall.dance),
						eq(songs.userId, wall.userId)
					)
				)
				.all()
				.map((x) => x.id)
		);
	return seen.filter((id) => visible.has(id)).slice(0, limit);
}

function songIdOf(json: string | null): number | null {
	if (!json) return null;
	try {
		const v = (JSON.parse(json) as { songId?: unknown } | null)?.songId;
		return typeof v === 'number' && Number.isInteger(v) ? v : null;
	} catch {
		return null;
	}
}

/**
 * The song popup's songs, ready and unarchived, with their sample and
 * recency: the person's own by title, then the shared songs of each group of
 * this dance they are in now, by group name and title, `group` naming it.
 * Never a draft, editors included: only a shared song may go in a person's
 * practice (`practiceSong`), and the player's `?song=` checks this list.
 */
export function songChoices(db: Db, wall: Wall): PickerSong[] {
	const own = db
		.select()
		.from(songs)
		.where(
			and(
				isNull(songs.archivedAt),
				eq(songs.status, 'ready'),
				eq(songs.dance, wall.dance),
				eq(songs.userId, wall.userId)
			)
		)
		.orderBy(songs.title)
		.all()
		.map((song) => ({ song, group: null as string | null, groupId: null as number | null }));
	const shared = db
		.select({ song: songs, group: teams.name, groupId: teams.id })
		.from(songs)
		.innerJoin(teams, eq(teams.id, songs.teamId))
		.innerJoin(
			teamMembers,
			and(eq(teamMembers.teamId, songs.teamId), eq(teamMembers.userId, wall.userId))
		)
		.where(
			and(
				isNull(songs.archivedAt),
				eq(songs.status, 'ready'),
				eq(songs.dance, wall.dance),
				isNotNull(songs.sharedAt),
				isNull(songs.userId),
				eq(teams.dance, wall.dance),
				isNull(teams.deletedAt),
				isNull(teams.purgedAt)
			)
		)
		.orderBy(teams.name, teams.id, songs.title)
		.all();
	const rows = [...own, ...shared];
	const recent = recentSongIds(db, wall, 5, new Set(rows.map((r) => r.song.id)));
	const out: PickerSong[] = [];
	for (const { song: s, group, groupId } of rows) {
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
			recentRank: rank < 0 ? null : rank,
			group,
			groupId
		});
	}
	return out;
}

/**
 * Where the user wants the sample to start, or null for automatic. False, and
 * nothing written, when out of range. A group's song, edited in its space, is
 * logged (`editSong`).
 */
export function setSampleStart(
	db: Db,
	id: number,
	startS: number | null,
	space?: Space,
	now = Date.now()
): boolean {
	const song = getSong(db, id);
	if (!song) return false;
	if (startS !== null) {
		if (!Number.isFinite(startS) || startS < 0) return false;
		if (song.durationS !== null && startS >= song.durationS) return false;
	}
	return editSong(db, id, { sampleStartS: startS }, space, now) !== null;
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
	input: { title: string; artist: string | null; style: string },
	space?: Space,
	now = Date.now()
): Song | null {
	return editSong(db, id, input, space, now);
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

/** The count's anchors (a tap, a removal, Reset). False when there is no such song. */
export function setAnchors(
	db: Db,
	id: number,
	anchors: number[],
	space?: Space,
	now = Date.now()
): boolean {
	const set = { anchorsJson: JSON.stringify(anchors) };
	return editSong(db, id, set, space, now, 'anchors') !== null;
}

/** Beat indices mean something different at another tempo factor, so the anchors go too. */
export function setTempoFactor(
	db: Db,
	id: number,
	factor: TempoFactor,
	space?: Space,
	now = Date.now()
): boolean {
	const set = { tempoFactor: factor, anchorsJson: '[]' };
	return editSong(db, id, set, space, now, 'tempoFactor') !== null;
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
	input: {
		file: string;
		mime: string;
		title: string | null;
		durationS: number | null;
		sizeBytes?: number;
	}
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
				sizeBytes: input.sizeBytes ?? null,
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

/**
 * Delete a person's song for good (songs are one of the hard deletes, to free
 * space). Null when it is not theirs. Refused while a live exercise uses it;
 * archived exercises lose the link in the same transaction. The caller
 * unlinks the audio file once the row is gone.
 */
export function deleteSong(
	db: Db,
	userId: string,
	id: number
): { ok: true; file: string | null } | { ok: false; usedBy: string[]; busy?: true } | null {
	return db.transaction((tx) => {
		const song = tx
			.select()
			.from(songs)
			.where(and(eq(songs.id, id), eq(songs.userId, userId)))
			.get();
		if (!song) return null;
		// The worker is still on it: it would write into a row that is gone.
		if ((WAITING as readonly string[]).includes(song.status)) {
			return { ok: false as const, usedBy: [], busy: true as const };
		}
		const users = tx
			.select({ name: exercises.name, source: exercises.source, archivedAt: exercises.archivedAt })
			.from(exercises)
			.where(eq(exercises.songId, id))
			.orderBy(asc(exercises.name))
			.all();
		// As drawn: a lesson's own drill in the reader's language.
		const live = users.filter((e) => e.archivedAt === null).map((e) => shownExercise(e).name);
		if (live.length) return { ok: false as const, usedBy: live };
		tx.update(exercises).set({ songId: null }).where(eq(exercises.songId, id)).run();
		// Music rows suggesting it go with it (spec B): they never block a Delete.
		tx.delete(songLinks).where(eq(songLinks.songId, id)).run();
		tx.delete(songs).where(eq(songs.id, id)).run();
		return { ok: true as const, file: song.audioFile };
	});
}
