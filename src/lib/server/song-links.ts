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
import { and, asc, eq, inArray, max, or, type SQL } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, lessons, routines, songLinks, songs } from './db/schema';
import { logChange } from './changes';
import { inSpace, isTeam, ownedBy, type Space, type Wall } from './scope';
import { practiceSong, songAccess } from './access';
import { memberIn } from './clones/genes';
import { shareSong } from './song-share';
import { songChoices, songSample } from './songs';
import type { ChangeRootKind, MusicParent, MusicRow, PickerSong } from '$lib/types';
import { t } from '$lib/i18n/catalog';

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
			shared: song.archivedAt === null && (song.teamId === null || song.sharedAt !== null),
			seen: JSON.stringify(musicSeen(link))
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
		return { ok: false, message: t().songs.music.notYours };
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
	if (!song || !allowed) return { ok: false, message: t().songs.music.cannotGo };
	const taken = db
		.select({ id: songLinks.id })
		.from(songLinks)
		.where(and(parentColumn(parent), eq(songLinks.songId, songId)))
		.get();
	if (taken) return { ok: false, message: t().songs.music.already };
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

/** The parent a Music row is on, as a key: the same for the same lesson, drill or routine. */
const parentKey = (p: MusicParent) =>
	'lessonId' in p ? `l${p.lessonId}` : 'exerciseId' in p ? `e${p.exerciseId}` : `r${p.routineId}`;

/**
 * The link, its song's title and its parent's row, when the link is `space`'s
 * and, with `on`, on that parent (a page's own lesson, drill or routine).
 * Anything else is null: a stranger's id and a missing one read the same.
 */
export function musicLinkIn(db: Db, space: Space, linkId: number, on?: MusicParent) {
	const link = db.select().from(songLinks).where(eq(songLinks.id, linkId)).get();
	const parent = link ? parentOf(link) : null;
	if (!link || !parent || (on && parentKey(on) !== parentKey(parent))) return null;
	const row = parentRow(db, parent);
	if (!row || row.dance !== space.dance || !inSpace(row, space)) return null;
	const title =
		db.select({ title: songs.title }).from(songs).where(eq(songs.id, link.songId)).get()?.title ??
		null;
	return { link, row, title };
}

/** A link's note; false when the link is not `space`'s. */
export function setMusicNote(
	db: Db,
	space: Space,
	linkId: number,
	note: string | null,
	now: number,
	on?: MusicParent
): boolean {
	const found = musicLinkIn(db, space, linkId, on);
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
export function removeMusic(
	db: Db,
	space: Space,
	linkId: number,
	now: number,
	on?: MusicParent
): boolean {
	const found = musicLinkIn(db, space, linkId, on);
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

/** Song links whose parent (a lesson, drill or routine) is the person's own. */
export function ownLinks(db: Db, wall: Wall): SQL {
	return or(
		inArray(
			songLinks.lessonId,
			db.select({ id: lessons.id }).from(lessons).where(ownedBy(lessons, wall))
		),
		inArray(
			songLinks.exerciseId,
			db.select({ id: exercises.id }).from(exercises).where(ownedBy(exercises, wall))
		),
		inArray(
			songLinks.routineId,
			db.select({ id: routines.id }).from(routines).where(ownedBy(routines, wall))
		)
	)!;
}

/**
 * The song a copy in `place` points at for `songId` (spec B, copies): the song
 * itself when it is `place`'s; else the place's live member of its family;
 * else, for a person, the same song when they may practise to it (their
 * group's shared song). Else null: the Music row is dropped. Never a clone —
 * a song link never copies audio.
 */
export function songInPlace(db: Db, songId: number, place: Space): number | null {
	const song = db.select().from(songs).where(eq(songs.id, songId)).get();
	if (!song || song.dance !== place.dance) return null;
	if (inSpace(song, place) && song.archivedAt === null) return song.id;
	if (song.geneId) {
		const member = memberIn(db, 'song', song.geneId, place);
		if (member && !member.archived) return member.id;
	}
	if (!isTeam(place) && practiceSong(db, place.userId, song)) return song.id;
	return null;
}

/** A copy's Music: the source's rows, notes and order kept, each song as `songInPlace` finds it. */
export function copyMusic(
	db: Db,
	from: MusicParent,
	to: MusicParent,
	place: Space,
	now: number
): void {
	const rows = db
		.select()
		.from(songLinks)
		.where(parentColumn(from))
		.orderBy(asc(songLinks.sortOrder), asc(songLinks.id))
		.all();
	let order = 0;
	const seen = new Set<number>();
	for (const r of rows) {
		const songId = songInPlace(db, r.songId, place);
		if (songId === null || seen.has(songId)) continue;
		seen.add(songId);
		db.insert(songLinks)
			.values({ songId, ...to, note: r.note, sortOrder: (order += 1), createdAt: now })
			.run();
	}
}

/* ── Compare, Take and Send (spec B): a parent's Music by `song:<ref>` ── */

/** The Music holder a root of `kind` is, or null for a kind without Music. */
export function musicParentOf(kind: string, id: number): MusicParent | null {
	if (kind === 'lesson') return { lessonId: id };
	if (kind === 'drill') return { exerciseId: id };
	if (kind === 'routine') return { routineId: id };
	return null;
}

const byRef = (ref: string) =>
	ref.startsWith('#') ? eq(songs.id, Number(ref.slice(1))) : eq(songs.geneId, ref);

/** The parent's Music row whose song is `ref` (a gene, or `#<id>`), with its song's id. */
export function musicByRef(
	db: Db,
	parent: MusicParent,
	ref: string
): { id: number; songId: number; note: string | null } | null {
	return (
		db
			.select({ id: songLinks.id, songId: songLinks.songId, note: songLinks.note })
			.from(songLinks)
			.innerJoin(songs, eq(songs.id, songLinks.songId))
			.where(and(parentColumn(parent), byRef(ref)))
			.get() ?? null
	);
}

/** Take or Send: `from`'s row for `ref` added to `to` in `place`, its note kept; false when `place` cannot take it. */
export function takeMusic(
	db: Db,
	from: MusicParent,
	to: MusicParent,
	place: Space,
	ref: string,
	now: number
): boolean {
	const row = musicByRef(db, from, ref);
	const songId = row ? songInPlace(db, row.songId, place) : null;
	if (!row || songId === null) return false;
	const there = db
		.select({ id: songLinks.id })
		.from(songLinks)
		.where(and(parentColumn(to), eq(songLinks.songId, songId)))
		.get();
	if (there) return true;
	const last =
		db
			.select({ n: max(songLinks.sortOrder) })
			.from(songLinks)
			.where(parentColumn(to))
			.get()?.n ?? 0;
	db.insert(songLinks)
		.values({ songId, ...to, note: row.note, sortOrder: last + 1, createdAt: now })
		.run();
	return true;
}

/** Take or Send: `parent`'s row for `ref` taken off; false when it had none. */
export function dropMusic(db: Db, parent: MusicParent, ref: string): boolean {
	const row = musicByRef(db, parent, ref);
	if (!row) return false;
	db.delete(songLinks).where(eq(songLinks.id, row.id)).run();
	return true;
}

/**
 * Whether `toId`'s place could take `fromId`'s song `ref` (Compare offers
 * nothing it could not: `songInPlace` would drop it). `actorId` acts in a group.
 */
export function musicFits(
	db: Db,
	kind: string,
	fromId: number,
	toId: number,
	ref: string,
	actorId: string
): boolean {
	const from = musicParentOf(kind, fromId);
	const to = musicParentOf(kind, toId);
	const toRow = to ? parentRow(db, to) : null;
	const row = from ? musicByRef(db, from, ref) : null;
	if (!toRow || !row) return false;
	const place: Space =
		toRow.teamId !== null
			? { dance: toRow.dance as Space['dance'], teamId: toRow.teamId, actorId }
			: { dance: toRow.dance as Space['dance'], userId: toRow.userId ?? '' };
	return songInPlace(db, row.songId, place) !== null;
}

/**
 * The differences between two members a person is shown, less a song the
 * place missing it could not take (`musicFits`): the source tabs' status,
 * the Versions list and Drop my copy read the same list (Sync filters its
 * rows the same way, `rowsOf`), so none of them shows a difference nothing
 * can resolve. `mineId` is the diff's `mine` side.
 */
export function fittingDiffs<
	D extends { key: string; side: string; mine: unknown; theirs: unknown }
>(db: Db, kind: string, mineId: number, theirsId: number, diffs: D[], actorId: string): D[] {
	return diffs.filter((d) => {
		if (!d.key.startsWith('song:')) return true;
		const ref = d.key.slice('song:'.length);
		if (d.side === 'theirs' && d.mine === null)
			return musicFits(db, kind, theirsId, mineId, ref, actorId);
		if (d.side === 'mine' && d.theirs === null)
			return musicFits(db, kind, mineId, theirsId, ref, actorId);
		return true;
	});
}
