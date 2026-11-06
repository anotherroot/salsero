/**
 * Music with notes (spec Part B, 2026-11-05): a lesson's, a drill's or a
 * routine's suggested songs, each with an optional note, in the order added.
 *
 * Which songs a row takes: a group's row only its group's ready, live songs
 * (adding a draft shares it, in the same transaction); a person's row their
 * own ready songs, or a group's shared song of a group they are in
 * (`practiceSong`). Who sees a row: whoever may open its song (`songAccess`),
 * so a member stops seeing an unshared song while the link stays; an editor
 * sees it marked not `shared`. A group's add, note change and remove are
 * logged (`logChange`, subject `song`). Remove is a hard delete, not trashed.
 */
import { and, asc, eq, max, type SQL } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, lessons, routines, songLinks, songs } from './db/schema';
import { logChange } from './changes';
import { inSpace, isTeam, type Space } from './scope';
import { practiceSong, songAccess } from './access';
import { shareSong } from './song-share';
import { songChoices, songSample } from './songs';
import type { ChangeRootKind, MusicParent, MusicRow, PickerSong } from '$lib/types';

/** Up to 500 characters (spec B). */
export const MUSIC_NOTE_MAX = 500;

/** A posted note: trimmed, '' → null, over 500 characters → undefined (refused). */
export function musicNote(raw: FormDataEntryValue | null): string | null | undefined {
	const text = typeof raw === 'string' ? raw.trim() : '';
	if (text === '') return null;
	return text.length > MUSIC_NOTE_MAX ? undefined : text;
}

const parentColumn = (parent: MusicParent): SQL =>
	'lessonId' in parent
		? eq(songLinks.lessonId, parent.lessonId)
		: 'exerciseId' in parent
			? eq(songLinks.exerciseId, parent.exerciseId)
			: eq(songLinks.routineId, parent.routineId);

/** The parent row, with what History files it under; null when missing or not a Music holder. */
function parentRow(
	db: Db,
	parent: MusicParent
): {
	userId: string | null;
	teamId: number | null;
	dance: string;
	rootKind: ChangeRootKind;
	rootId: number;
} | null {
	if ('lessonId' in parent) {
		const r = db
			.select({ userId: lessons.userId, teamId: lessons.teamId, dance: lessons.dance })
			.from(lessons)
			.where(eq(lessons.id, parent.lessonId))
			.get();
		return r ? { ...r, rootKind: 'lesson', rootId: parent.lessonId } : null;
	}
	if ('routineId' in parent) {
		const r = db
			.select({ userId: routines.userId, teamId: routines.teamId, dance: routines.dance })
			.from(routines)
			.where(eq(routines.id, parent.routineId))
			.get();
		return r ? { ...r, rootKind: 'routine', rootId: parent.routineId } : null;
	}
	const r = db
		.select({
			userId: exercises.userId,
			teamId: exercises.teamId,
			dance: exercises.dance,
			source: exercises.source
		})
		.from(exercises)
		.where(eq(exercises.id, parent.exerciseId))
		.get();
	// Only a drill holds Music, never an entry (`added`) or a figure's or routine's exercise.
	if (!r || r.source !== 'custom') return null;
	return {
		userId: r.userId,
		teamId: r.teamId,
		dance: r.dance,
		rootKind: 'drill',
		rootId: parent.exerciseId
	};
}

/** The link's parent as a `MusicParent`. */
function parentOf(link: {
	lessonId: number | null;
	exerciseId: number | null;
	routineId: number | null;
}): MusicParent | null {
	if (link.lessonId !== null) return { lessonId: link.lessonId };
	if (link.exerciseId !== null) return { exerciseId: link.exerciseId };
	if (link.routineId !== null) return { routineId: link.routineId };
	return null;
}

/** A parent's Music, in the order added, as `viewerId` may see it. */
export function listMusic(db: Db, parent: MusicParent, viewerId: string): MusicRow[] {
	const rows = db
		.select({ link: songLinks, song: songs })
		.from(songLinks)
		.innerJoin(songs, eq(songs.id, songLinks.songId))
		.where(parentColumn(parent))
		.orderBy(asc(songLinks.sortOrder), asc(songLinks.id))
		.all();
	const out: MusicRow[] = [];
	for (const { link, song } of rows) {
		if (song.status !== 'ready' || songAccess(db, viewerId, song) === null) continue;
		const sample = songSample(song);
		if (!sample) continue;
		out.push({
			id: link.id,
			songId: song.id,
			title: song.title,
			artist: song.artist,
			bpm: song.bpm ? Math.round(song.bpm * song.tempoFactor) : null,
			durationS: song.durationS,
			sample,
			note: link.note,
			shared: song.archivedAt === null && (song.teamId === null || song.sharedAt !== null)
		});
	}
	return out;
}

/**
 * What "+ Add" in Music offers: a person their song popup's songs
 * (`songChoices`); a group its own ready, live songs, drafts included.
 */
export function musicChoices(db: Db, space: Space): PickerSong[] {
	if (!isTeam(space)) return songChoices(db, space);
	return db
		.select()
		.from(songs)
		.where(
			and(eq(songs.teamId, space.teamId), eq(songs.dance, space.dance), eq(songs.status, 'ready'))
		)
		.orderBy(asc(songs.title))
		.all()
		.flatMap((s) => {
			if (s.archivedAt !== null) return [];
			const sample = songSample(s);
			if (!sample) return [];
			return [
				{
					id: s.id,
					title: s.title,
					artist: s.artist,
					style: s.style,
					bpm: s.bpm ? Math.round(s.bpm * s.tempoFactor) : null,
					durationS: s.durationS,
					sample,
					recentRank: null,
					group: null,
					groupId: null
				}
			];
		});
}

type Added = { ok: true; id: number } | { ok: false; message: string };

/** Adds `songId` to `parent`'s Music with `note`, last. */
export function addMusic(
	db: Db,
	space: Space,
	parent: MusicParent,
	songId: number,
	note: string | null,
	now: number
): Added {
	const row = parentRow(db, parent);
	if (!row || row.dance !== space.dance || !inSpace(row, space)) {
		return { ok: false, message: 'That is not yours to change.' };
	}
	const song = db.select().from(songs).where(eq(songs.id, songId)).get();
	const allowed =
		!!song &&
		song.status === 'ready' &&
		song.archivedAt === null &&
		song.dance === space.dance &&
		(isTeam(space)
			? song.teamId === space.teamId && song.userId === null
			: practiceSong(db, space.userId, song));
	if (!song || !allowed) return { ok: false, message: 'That song cannot go here.' };
	const taken = db
		.select({ id: songLinks.id })
		.from(songLinks)
		.where(and(parentColumn(parent), eq(songLinks.songId, songId)))
		.get();
	if (taken) return { ok: false, message: 'Already in Music' };
	return db.transaction((tx) => {
		// A group's draft is shared by the add: members can always play what a row points at.
		if (isTeam(space) && song.sharedAt === null) shareSong(tx, space, songId, now);
		const last =
			tx
				.select({ n: max(songLinks.sortOrder) })
				.from(songLinks)
				.where(parentColumn(parent))
				.get()?.n ?? 0;
		const id = tx
			.insert(songLinks)
			.values({ songId, ...parent, note, sortOrder: last + 1, createdAt: now })
			.returning({ id: songLinks.id })
			.get().id;
		logChange(
			tx,
			space,
			{
				rootKind: row.rootKind,
				rootId: row.rootId,
				verb: 'add',
				subject: 'song',
				subjectId: songId,
				after: { name: song.title }
			},
			now
		);
		return { ok: true as const, id };
	});
}

/** The link, its song's title and its parent, when the link is `space`'s. */
function linkIn(db: Db, space: Space, linkId: number) {
	const link = db.select().from(songLinks).where(eq(songLinks.id, linkId)).get();
	const parent = link ? parentOf(link) : null;
	const row = parent ? parentRow(db, parent) : null;
	if (!link || !row || row.dance !== space.dance || !inSpace(row, space)) return null;
	const title = db
		.select({ title: songs.title })
		.from(songs)
		.where(eq(songs.id, link.songId))
		.get()?.title;
	return { link, row, title: title ?? null };
}

/** A link's note; false when the link is not `space`'s. */
export function setMusicNote(
	db: Db,
	space: Space,
	linkId: number,
	note: string | null,
	now: number
): boolean {
	const found = linkIn(db, space, linkId);
	if (!found) return false;
	db.transaction((tx) => {
		tx.update(songLinks).set({ note }).where(eq(songLinks.id, linkId)).run();
		logChange(
			tx,
			space,
			{
				rootKind: found.row.rootKind,
				rootId: found.row.rootId,
				verb: 'change',
				subject: 'song',
				subjectId: found.link.songId,
				// No `before`: History offers no Restore for it.
				after: { name: found.title }
			},
			now
		);
	});
	return true;
}

/** Takes a song off a parent's Music; false when the link is gone or not `space`'s. */
export function removeMusic(db: Db, space: Space, linkId: number, now: number): boolean {
	const found = linkIn(db, space, linkId);
	if (!found) return false;
	db.transaction((tx) => {
		tx.delete(songLinks).where(eq(songLinks.id, linkId)).run();
		logChange(
			tx,
			space,
			{
				rootKind: found.row.rootKind,
				rootId: found.row.rootId,
				verb: 'remove',
				subject: 'song',
				subjectId: found.link.songId,
				before: { name: found.title }
			},
			now
		);
	});
	return true;
}

/** What a note save saw (the clash check): the note. */
export function musicSeen(link: { note: string | null }): Record<string, string | null> {
	return { note: link.note };
}
