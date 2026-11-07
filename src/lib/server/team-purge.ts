/**
 * A deleted group, gone for good once `TEAM_PURGE_MS` has passed: first its
 * members (the owner included) and former members with an added lesson keep
 * their copies in their own app (`keepFromTeam`: everything, except the
 * person who deleted it, who keeps what their own rows use), then its files
 * are deleted and its rows stay, archived and unreachable, so what was logged
 * on them keeps its name ("Tue 3 Nov · Salsa nadaljevalna (deleted)").
 *
 * Runs beside `purgeTrash`: at boot and every hour (`startTrashPurge`). A
 * system action, so nothing is written to History: the group it would be
 * filed under is gone.
 */
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { alias, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Db } from './db';
import {
	exercises,
	figureGroups,
	figures,
	lessonAdds,
	lessonCommentHearts,
	lessonComments,
	lessons,
	lessonVideos,
	links,
	positions,
	recordings,
	routines,
	songDrops,
	songLinks,
	songs,
	spotLinks,
	spotPositionLinks,
	teamMembers,
	teams,
	teamTrash,
	videoDownloads,
	videoSpots
} from './db/schema';
import { audioDir, lessonVideosDir, recordingsDir, RECORDING_FILE_RE } from './files';
import type { TrashDirs, TrashFile } from './trash';
import { TEAM_PURGE_MS } from '$lib/limits';
import type { KeepChoice } from '$lib/types';
import { cloneFilesIn, realCloneFiles, type CloneFiles } from './clones/files';
import { keepFromTeam } from './clones/keep';

/** A group deleted at least `TEAM_PURGE_MS` before `now`. */
const dueToPurge = (now: number) =>
	and(isNotNull(teams.deletedAt), lte(teams.deletedAt, now - TEAM_PURGE_MS));

/**
 * One group's rows, in one transaction with one `now`: the media rows go
 * (videos, recordings, their spots, their section and position links, links
 * and saves in flight; songs, their drops, and every entry's pick of one, which falls back
 * to count-only); the group's lessons, figures, variations, routines, drills and positions
 * are archived (their hand links and tags stay, as rows do), and so is every live entry pointing at them; its trash is marked
 * purged; `purged_at` is set; its members and the lessons people added go.
 * People's sets are never touched. Returns the files to delete, or null when
 * another run got there first or the group was restored since it was listed.
 */
function purgeRows(db: Db, teamId: number, now: number): TrashFile[] | null {
	return db.transaction((tx) => {
		const claimed = tx
			.update(teams)
			.set({ purgedAt: now })
			// Still deleted, long enough ago: a restore since the list was read wins.
			.where(and(eq(teams.id, teamId), isNull(teams.purgedAt), dueToPurge(now)))
			.run().changes;
		if (claimed === 0) return null;

		const drills = alias(exercises, 'drills');
		const lessonIds = tx.select({ id: lessons.id }).from(lessons).where(eq(lessons.teamId, teamId));
		const variationIds = tx
			.select({ id: figures.id })
			.from(figures)
			.where(eq(figures.teamId, teamId));
		const routineIds = tx
			.select({ id: routines.id })
			.from(routines)
			.where(eq(routines.teamId, teamId));
		const drillIds = tx.select({ id: drills.id }).from(drills).where(eq(drills.teamId, teamId));

		const videos = tx
			.select({ id: lessonVideos.id, file: lessonVideos.file })
			.from(lessonVideos)
			.where(inArray(lessonVideos.lessonId, lessonIds))
			.all();
		const recs = tx
			.select({ id: recordings.id, file: recordings.file })
			.from(recordings)
			.where(inArray(recordings.figureId, variationIds))
			.all();
		const files: TrashFile[] = [
			...videos.map((v) => ({ dir: 'lessonVideos' as const, file: v.file })),
			...recs.map((r) => ({ dir: 'recordings' as const, file: r.file }))
		];
		const videoIds = videos.map((v) => v.id);
		const recIds = recs.map((r) => r.id);

		const spotIds = tx
			.select({ id: videoSpots.id })
			.from(videoSpots)
			.where(
				or(inArray(videoSpots.lessonVideoId, videoIds), inArray(videoSpots.recordingId, recIds))
			);
		tx.delete(spotLinks).where(inArray(spotLinks.spotId, spotIds)).run();
		tx.delete(spotPositionLinks).where(inArray(spotPositionLinks.spotId, spotIds)).run();
		tx.update(positions)
			.set({ pictureSpotId: null })
			.where(inArray(positions.pictureSpotId, spotIds))
			.run();
		tx.delete(videoSpots)
			.where(
				or(inArray(videoSpots.lessonVideoId, videoIds), inArray(videoSpots.recordingId, recIds))
			)
			.run();
		tx.delete(lessonVideos).where(inArray(lessonVideos.id, videoIds)).run();
		tx.delete(recordings).where(inArray(recordings.id, recIds)).run();

		const ownLinks = or(
			inArray(links.lessonId, lessonIds),
			inArray(links.figureId, variationIds),
			inArray(links.exerciseId, drillIds)
		);
		const linkIds = tx.select({ id: links.id }).from(links).where(ownLinks);
		tx.delete(videoDownloads)
			.where(
				or(
					inArray(videoDownloads.linkId, linkIds),
					inArray(videoDownloads.lessonId, lessonIds),
					inArray(videoDownloads.figureId, variationIds)
				)
			)
			.run();
		tx.delete(links).where(ownLinks).run();

		// Songs: anyone's entry that picked one goes to count-only, and the file goes.
		const groupSongs = tx
			.select({ id: songs.id, file: songs.audioFile })
			.from(songs)
			.where(eq(songs.teamId, teamId))
			.all();
		const songIds = groupSongs.map((s) => s.id);
		tx.update(exercises).set({ songId: null }).where(inArray(exercises.songId, songIds)).run();
		tx.delete(songDrops).where(inArray(songDrops.songId, songIds)).run();
		tx.delete(songLinks).where(inArray(songLinks.songId, songIds)).run();
		tx.delete(songs).where(inArray(songs.id, songIds)).run();
		for (const s of groupSongs) if (s.file) files.push({ dir: 'audio', file: s.file });

		// Entries first: their targets are found by the group's ids, archived or not.
		tx.update(exercises)
			.set({ archivedAt: now })
			.where(
				and(
					isNotNull(exercises.userId),
					isNull(exercises.archivedAt),
					or(
						inArray(exercises.lessonId, lessonIds),
						inArray(exercises.routineId, routineIds),
						inArray(exercises.figureId, variationIds),
						inArray(exercises.drillId, drillIds)
					)
				)
			)
			.run();
		const live = (t: { teamId: AnySQLiteColumn; archivedAt: AnySQLiteColumn }) =>
			and(eq(t.teamId, teamId), isNull(t.archivedAt));
		tx.update(lessons).set({ archivedAt: now }).where(live(lessons)).run();
		tx.update(figureGroups).set({ archivedAt: now }).where(live(figureGroups)).run();
		tx.update(figures).set({ archivedAt: now }).where(live(figures)).run();
		tx.update(routines).set({ archivedAt: now }).where(live(routines)).run();
		tx.update(exercises).set({ archivedAt: now }).where(live(exercises)).run();
		tx.update(positions).set({ archivedAt: now }).where(live(positions)).run();

		const trashed = tx
			.update(teamTrash)
			.set({ purgedAt: now })
			.where(
				and(eq(teamTrash.teamId, teamId), isNull(teamTrash.purgedAt), isNull(teamTrash.restoredAt))
			)
			.returning({ filesJson: teamTrash.filesJson })
			.all();
		for (const t of trashed) files.push(...(JSON.parse(t.filesJson) as TrashFile[]));

		// Comments and their hearts: nobody can reach them after the purge.
		const commentIds = tx
			.select({ id: lessonComments.id })
			.from(lessonComments)
			.where(inArray(lessonComments.lessonId, lessonIds));
		tx.delete(lessonCommentHearts).where(inArray(lessonCommentHearts.commentId, commentIds)).run();
		tx.delete(lessonComments).where(inArray(lessonComments.lessonId, lessonIds)).run();

		tx.delete(lessonAdds).where(inArray(lessonAdds.lessonId, lessonIds)).run();
		tx.delete(teamMembers).where(eq(teamMembers.teamId, teamId)).run();
		return files;
	});
}

/** Delete these files; a file already gone is fine, any other failure is logged. */
async function unlinkFiles(files: TrashFile[], where: TrashDirs): Promise<void> {
	for (const f of files) {
		// Only our own names, in our own folders: never a path from a row.
		if (!RECORDING_FILE_RE.test(f.file) || !(f.dir in where)) continue;
		await unlink(join(where[f.dir], f.file)).catch((err: NodeJS.ErrnoException) => {
			if (err.code !== 'ENOENT') console.warn(`[team-purge] could not delete ${f.file}`, err);
		});
	}
}

/** Whether this group is still waiting for its purge (a restore since the list was read wins). */
function stillDue(db: Db, teamId: number, now: number): boolean {
	return (
		db
			.select({ id: teams.id })
			.from(teams)
			.where(and(eq(teams.id, teamId), isNull(teams.purgedAt), dueToPurge(now)))
			.get() !== undefined
	);
}

/**
 * Everyone the group's files matter to keeps their copies while those files
 * are still there (the copies' files are hard links under new names, so the
 * purge's unlinks never reach them): every member, the owner included, and
 * every former member who still has an added lesson of it. The person who
 * deleted the group keeps only what their own rows use, so nothing of theirs
 * dangles; everyone else keeps everything. 'restored' when the group came
 * back meanwhile; 'failed' when someone's Keep threw (logged as an error):
 * the group then waits, files and all, for the next run.
 */
async function keepForEveryone(
	db: Db,
	teamId: number,
	files: CloneFiles,
	now: number
): Promise<'kept' | 'restored' | 'failed'> {
	const deletedBy = db
		.select({ by: teams.deletedBy })
		.from(teams)
		.where(eq(teams.id, teamId))
		.get()?.by;
	const people = db
		.all<{ userId: string }>(
			sql`select user_id as userId from team_members where team_id = ${teamId}
			    union
			    select a.user_id from lesson_adds a join lessons l on l.id = a.lesson_id
			     where l.team_id = ${teamId}`
		)
		.map((r) => r.userId)
		.sort();
	for (const userId of people) {
		if (!stillDue(db, teamId, now)) return 'restored';
		const choice: KeepChoice = userId === deletedBy ? { mode: 'used' } : { mode: 'all' };
		try {
			await keepFromTeam(db, userId, teamId, choice, files, now);
		} catch (err) {
			console.error(
				`[team-purge] Keep failed for ${userId} in group ${teamId}; group kept for the next run`,
				err
			);
			return 'failed';
		}
	}
	return 'kept';
}

/**
 * Purge every group deleted at least `TEAM_PURGE_MS` ago and not purged yet,
 * one group at a time: first everyone keeps their copies, then its rows go
 * in one transaction, then its files. A group that fails is logged and the
 * purge goes on to the next, so the groups already marked purged never keep
 * their files, and a group where someone's Keep failed keeps its files for
 * the next run. Running it twice changes nothing; a file already gone is
 * fine (Keep skips it, the unlink too), any other failure to delete one is
 * logged and the purge goes on. Returns how many groups were purged. `dirs`
 * is injected so specs never touch `$DATA_DIR`; the kept copies are linked in
 * the same folders.
 */
export async function purgeTeams(db: Db, now: number, dirs?: TrashDirs): Promise<number> {
	const due = db
		.select({ id: teams.id })
		.from(teams)
		.where(and(isNull(teams.purgedAt), dueToPurge(now)))
		.all();
	let purged = 0;
	const where = () =>
		dirs ?? { lessonVideos: lessonVideosDir(), recordings: recordingsDir(), audio: audioDir() };
	const copies = dirs
		? cloneFilesIn({
				recording: dirs.recordings,
				'lesson-video': dirs.lessonVideos,
				audio: dirs.audio
			})
		: realCloneFiles();
	for (const { id } of due) {
		try {
			if ((await keepForEveryone(db, id, copies, now)) !== 'kept') continue;
			const files = purgeRows(db, id, now);
			if (files === null) continue;
			purged++;
			if (files.length === 0) continue;
			await unlinkFiles(files, where());
		} catch (err) {
			console.warn(`[team-purge] could not purge group ${id}`, err);
		}
	}
	return purged;
}
