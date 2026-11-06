/**
 * A group's Recently deleted (risk 10).
 *
 * The hard-delete kinds (a video, a section, a link, a section link, a
 * recording, a position link) stay real deletes: no reader of those tables learns about a
 * `deleted_at`. A group's delete first writes a snapshot of the rows it is
 * about to remove into `team_trash`, and the file stays on disk. For 30 days
 * (`TRASH_MS`) Restore re-inserts the rows with their own ids, parents first,
 * in one transaction (`AUTOINCREMENT` never hands an id out twice); then
 * `purgeTrash` deletes the file for good. Until then the bytes count against
 * the group (`storage.ts`).
 *
 * The archived kinds (a lesson, a variation, a routine, a drill, a song) are
 * listed here from their own `archived_at` and restored by their module
 * (`restoreLesson`, `restoreVariation`, `restoreRoutine`, `restoreDrill`,
 * `restoreSong`). Of those only a song is purged: `TRASH_MS` after its
 * delete, its row and its audio file go for good ("Recently deleted for 30
 * days with its file"). The others hold no file and stay archived.
 *
 * A person's own deletes never come here: theirs remove the file at once.
 */
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { and, desc, eq, inArray, isNotNull, isNull, lte, ne, sql, type SQL } from 'drizzle-orm';
import type { Db } from './db';
import {
	exercises,
	figureGroups,
	figures,
	lessonExercises,
	lessonFigures,
	lessonPositions,
	lessons,
	lessonVideos,
	links,
	positions,
	opens,
	recordings,
	routines,
	songDrops,
	songs,
	spotLinks,
	spotPositionLinks,
	teamChanges,
	teamTrash,
	videoSpots
} from './db/schema';
import { autoAddPending } from './auto-add';
import { logChange, teamNames } from './changes';
import { reviveEntries } from './entries';
import { audioDir, lessonVideosDir, recordingsDir, RECORDING_FILE_RE } from './files';
import { restoreLesson } from './lessons';
import { labelFor, restoreVariation } from './figures';
import { restoreRoutine } from './routines';
import { restoreDrill } from './exercises';
import { restoreSong } from './song-share';
import { restorePositionIn } from './positions';
import { purgeTeams } from './team-purge';
import { realCloneFiles } from './clones/files';
import { settleFormerMembers } from './clones/settle';
import { getTeam, roleOf } from './teams';
import type { TeamSpace } from './scope';
import { localDay } from '$lib/day/day';
import { clock } from '$lib/format';
import { TRASH_MS } from '$lib/limits';
import { trashRefusalLine, type TrashRefusal } from '$lib/teams/deleted';
import type { ChangeRootKind, DeletedItem, DeletedKind, TrashKind } from '$lib/types';

/** Where a trashed or purged file lives: a lesson video's folder, a recording's, or a song's. */
export type TrashDir = 'lessonVideos' | 'recordings' | 'audio';
export type TrashDirs = Record<TrashDir, string>;
export type TrashFile = { dir: TrashDir; file: string };

/** The tables a snapshot may hold rows of, by their SQL names. */
const TABLES = {
	lesson_videos: lessonVideos,
	recordings,
	video_spots: videoSpots,
	spot_links: spotLinks,
	spot_position_links: spotPositionLinks,
	links,
	lesson_figures: lessonFigures,
	lesson_exercises: lessonExercises,
	lesson_positions: lessonPositions
} as const;
export type TrashTable = keyof typeof TABLES;
export type TrashRows = Partial<Record<TrashTable, Record<string, unknown>[]>>;

/** Parents before children: the order a restore inserts in. */
const ORDER: TrashTable[] = [
	'lesson_videos',
	'recordings',
	'video_spots',
	'spot_links',
	'spot_position_links',
	'links',
	'lesson_figures',
	'lesson_exercises',
	'lesson_positions'
];

/** A lesson's hand link made again since is no reason to refuse; it is left as it is. */
const JOINS = new Set<TrashTable>(['lesson_figures', 'lesson_exercises', 'lesson_positions']);

/** The row a kind is about: its History line names it. */
const MAIN: Record<TrashKind, TrashTable> = {
	video: 'lesson_videos',
	recording: 'recordings',
	section: 'video_spots',
	link: 'links',
	'spot-link': 'spot_links',
	'position-link': 'spot_position_links'
};

/** The History subject a restore of each kind logs, as its delete did. */
function subjectOf(kind: TrashKind, main: Record<string, unknown> | undefined): string {
	if (kind === 'section') return main?.endMs === null ? 'point' : 'section';
	return kind === 'spot-link' || kind === 'position-link' ? 'section-link' : kind;
}

/**
 * Keep what a group's delete is about to remove, inside the delete's own
 * transaction, before the rows go. Returns the trash id: the delete's History
 * row carries it, and the route leaves the file on disk (risk 19).
 */
export function trashRows(
	tx: Db,
	space: TeamSpace,
	kind: TrashKind,
	label: string,
	root: { rootKind: ChangeRootKind; rootId: number },
	rows: TrashRows,
	files: TrashFile[],
	sizeBytes: number,
	now: number
): number {
	if (!space.actorId) throw new Error(`a group's delete needs who made it (${kind})`);
	return tx
		.insert(teamTrash)
		.values({
			teamId: space.teamId,
			kind,
			label,
			rootKind: root.rootKind,
			rootId: root.rootId,
			rowsJson: JSON.stringify(rows),
			filesJson: JSON.stringify(files),
			sizeBytes,
			deletedBy: space.actorId,
			deletedAt: now
		})
		.returning({ id: teamTrash.id })
		.get().id;
}

/** What a trash entry's root is called: its lesson's title, its figure's or drill's name. */
export function rootTitle(tx: Db, rootKind: ChangeRootKind, rootId: number): string {
	switch (rootKind) {
		case 'lesson':
			return (
				tx.select({ t: lessons.title }).from(lessons).where(eq(lessons.id, rootId)).get()?.t ??
				'Lesson'
			);
		case 'figure':
			return (
				tx
					.select({ t: figureGroups.name })
					.from(figureGroups)
					.where(eq(figureGroups.id, rootId))
					.get()?.t ?? 'Figure'
			);
		case 'drill':
			return (
				tx.select({ t: exercises.name }).from(exercises).where(eq(exercises.id, rootId)).get()?.t ??
				'Drill'
			);
		case 'position':
			return (
				tx.select({ t: positions.name }).from(positions).where(eq(positions.id, rootId)).get()?.t ??
				'Position'
			);
		default:
			return '';
	}
}

/** A section or point as a row names it: its name, else where it starts ("0:05"). */
export function spotWords(spot: { label: string | null; startMs: number }): string {
	return spot.label ? `'${spot.label}'` : clock(spot.startMs / 1000);
}

/** A unique or primary key clash, or a missing parent, as a refusal; null for anything else. */
function constraintReason(e: unknown): TrashRefusal | null {
	for (let err: unknown = e; err; err = (err as { cause?: unknown }).cause) {
		const code = (err as { code?: unknown }).code;
		if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return 'parent-gone';
		if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
			return 'exists';
		}
		if (err === (err as { cause?: unknown }).cause) break;
	}
	return null;
}

export type TrashRestore = { ok: true } | { ok: false; reason: TrashRefusal };

/**
 * Whether a snapshot's recording, video or section would give its parent a
 * second member of its family: another row there (a recording on the same
 * figure, a video in the same lesson, a section on the same video) with its
 * gene, put there since by a Send. Pieces are matched inside their parent
 * only. A snapshot from before genes has none: a family of one, never a clash.
 */
function familyThere(db: Db, rows: TrashRows): boolean {
	const gene = (r: Record<string, unknown>) => (typeof r.geneId === 'string' ? r.geneId : null);
	const other = (
		table: typeof recordings | typeof lessonVideos | typeof videoSpots,
		r: Record<string, unknown>,
		inParent: SQL
	) =>
		db
			.select({ id: table.id })
			.from(table)
			.where(and(inParent, eq(table.geneId, gene(r)!), ne(table.id, r.id as number)))
			.get() !== undefined;
	for (const r of rows.recordings ?? []) {
		if (gene(r) && other(recordings, r, eq(recordings.figureId, r.figureId as number))) return true;
	}
	for (const r of rows.lesson_videos ?? []) {
		if (gene(r) && other(lessonVideos, r, eq(lessonVideos.lessonId, r.lessonId as number)))
			return true;
	}
	for (const r of rows.video_spots ?? []) {
		if (!gene(r)) continue;
		const inParent =
			typeof r.recordingId === 'number'
				? eq(videoSpots.recordingId, r.recordingId)
				: eq(videoSpots.lessonVideoId, r.lessonVideoId as number);
		if (other(videoSpots, r, inParent)) return true;
	}
	return false;
}

/**
 * An archived lesson, variation, routine or drill brought back: refused when
 * it is not archived in this space (`gone`), or its name is another's now.
 */
export type ArchiveRestore =
	{ ok: true } | { ok: false; reason: 'gone' } | { ok: false; reason: 'taken'; message: string };

/**
 * Put a trash entry back: its rows with their own ids, parents first, in one
 * transaction, and the members' entries its delete took off Today (those
 * archived at the delete's time; `reviveEntries`). Refused, changing nothing,
 * when what it lived in is gone (a section whose video is in the trash:
 * `parent-gone`), its file was purged, it is back already, the same
 * section link was made again since (`exists`), or a recording, video or
 * section of the same family is in its parent again (`family`: a Send put
 * one back). Logged as a `restore`.
 */
export function restoreTrash(db: Db, space: TeamSpace, trashId: number, now: number): TrashRestore {
	const row = db.select().from(teamTrash).where(eq(teamTrash.id, trashId)).get();
	if (!row || row.teamId !== space.teamId) return { ok: false, reason: 'not-found' };
	if (row.purgedAt !== null) return { ok: false, reason: 'purged' };
	if (row.restoredAt !== null) return { ok: false, reason: 'restored' };
	const kind = row.kind as TrashKind;
	const rows = JSON.parse(row.rowsJson) as TrashRows;
	const main = rows[MAIN[kind]]?.[0];
	if (familyThere(db, rows)) return { ok: false, reason: 'family' };
	try {
		db.transaction((tx) => {
			for (const table of ORDER) {
				const list = rows[table];
				if (!list || list.length === 0) continue;
				const insert = tx.insert(TABLES[table]).values(list as never);
				if (JOINS.has(table)) insert.onConflictDoNothing().run();
				else insert.run();
			}
			tx.update(teamTrash).set({ restoredAt: now }).where(eq(teamTrash.id, row.id)).run();
			reviveEntries(tx, row.teamId, row.deletedAt);
			// A drill's link on a class lesson's section grows that lesson, as linkInSpace does.
			const drillLinks = (rows.spot_links ?? []).filter((l) => typeof l.exerciseId === 'number');
			if (kind === 'spot-link' && drillLinks.length > 0) {
				const lessonIds = tx
					.select({ id: lessonVideos.lessonId })
					.from(videoSpots)
					.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
					.where(
						inArray(
							videoSpots.id,
							drillLinks.map((l) => l.spotId as number)
						)
					)
					.all()
					.map((r) => r.id);
				autoAddPending(tx, row.teamId, lessonIds, now);
			}
			logChange(
				tx,
				space,
				{
					rootKind: row.rootKind as ChangeRootKind,
					rootId: row.rootId,
					verb: 'restore',
					subject: subjectOf(kind, main),
					subjectId: typeof main?.id === 'number' ? main.id : null,
					trashId: row.id
				},
				now
			);
		});
	} catch (e) {
		const reason = constraintReason(e);
		if (reason) return { ok: false, reason };
		throw e;
	}
	return { ok: true };
}

/**
 * The trash entry a section went into, by the section's id: its own delete,
 * or its video's or recording's. Only for someone who edits that group (a
 * save from anyone else stays the stranger's 404). Who deleted it and when,
 * for a save that arrives afterwards (410 gone). A spot that is there is in
 * no live trash entry, so the scan runs only for a missing one; a purged
 * entry is gone for good, and its save is the plain 404.
 */
export function trashedSpot(
	db: Db,
	userId: string,
	spotId: number
): { by: string | null; at: number } | null {
	const live = db
		.select({ id: videoSpots.id })
		.from(videoSpots)
		.where(eq(videoSpots.id, spotId))
		.get();
	if (live) return null;
	const row = db
		.select({ teamId: teamTrash.teamId, by: teamTrash.deletedBy, at: teamTrash.deletedAt })
		.from(teamTrash)
		.where(
			and(
				isNull(teamTrash.restoredAt),
				isNull(teamTrash.purgedAt),
				inArray(teamTrash.kind, ['section', 'video', 'recording']),
				sql`exists (select 1 from json_each(${teamTrash.rowsJson}, '$.video_spots') where json_extract(value, '$.id') = ${spotId})`
			)
		)
		.orderBy(desc(teamTrash.deletedAt), desc(teamTrash.id))
		.get();
	if (!row || !editsTeam(db, userId, row.teamId)) return null;
	return { by: teamNames(db, row.teamId, [row.by]).get(row.by) ?? null, at: row.at };
}

/** Whether the person is an editor or the owner of a group that lives. */
export function editsTeam(db: Db, userId: string, teamId: number): boolean {
	const team = getTeam(db, teamId);
	const role = team && team.deletedAt === null ? roleOf(db, userId, teamId) : null;
	return role === 'editor' || role === 'owner';
}

/**
 * The group a trash entry is in, acted in by this person, and the entry's
 * kind, when they edit that group; null for anyone else (the stranger's
 * 404). The player's Undo restores through this.
 */
export function trashSpace(
	db: Db,
	userId: string,
	trashId: number
): { space: TeamSpace; kind: TrashKind } | null {
	const row = db
		.select({ teamId: teamTrash.teamId, kind: teamTrash.kind })
		.from(teamTrash)
		.where(eq(teamTrash.id, trashId))
		.get();
	const team = row ? getTeam(db, row.teamId) : null;
	if (!row || !team || !editsTeam(db, userId, team.id)) return null;
	return {
		space: { dance: team.dance as TeamSpace['dance'], teamId: team.id, actorId: userId },
		kind: row.kind as TrashKind
	};
}

/**
 * Recently deleted: the group's trash entries not yet restored or purged,
 * and its archived lessons, variations, routines, drills and songs, newest
 * first.
 * Each says who and when; a trash entry also the day it goes for good, in
 * `timeZone`.
 */
export function listTrash(db: Db, teamId: number, timeZone = 'UTC'): DeletedItem[] {
	const items: (Omit<DeletedItem, 'by'> & { actorId: string | null })[] = [];
	for (const t of db
		.select()
		.from(teamTrash)
		.where(
			and(eq(teamTrash.teamId, teamId), isNull(teamTrash.restoredAt), isNull(teamTrash.purgedAt))
		)
		.all()) {
		items.push({
			kind: t.kind as TrashKind,
			id: t.id,
			label: t.label,
			actorId: t.deletedBy,
			at: t.deletedAt,
			purgeOn: localDay(t.deletedAt + TRASH_MS, timeZone)
		});
	}

	// Who archived what: the newest `archive` row per thing (a variation is its figure's
	// subject); a song's is a `delete`.
	const archivers = new Map<string, string>();
	for (const c of db
		.select()
		.from(teamChanges)
		.where(and(eq(teamChanges.teamId, teamId), inArray(teamChanges.verb, ['archive', 'delete'])))
		.orderBy(teamChanges.at, teamChanges.id)
		.all()) {
		const key =
			c.subject === 'variation' ? `variation:${c.subjectId}` : `${c.rootKind}:${c.rootId}`;
		archivers.set(key, c.actorId);
	}
	const archived = (kind: DeletedKind, id: number, label: string, at: number) =>
		items.push({
			kind,
			id,
			label,
			at,
			actorId: archivers.get(`${kind === 'variation' ? 'variation' : kind}:${id}`) ?? null,
			purgeOn: null
		});

	for (const l of db
		.select({ id: lessons.id, title: lessons.title, at: lessons.archivedAt })
		.from(lessons)
		.where(and(eq(lessons.teamId, teamId), isNotNull(lessons.archivedAt)))
		.all())
		archived('lesson', l.id, l.title, l.at!);
	for (const v of db
		.select({
			id: figures.id,
			figure: figureGroups.name,
			name: figures.name,
			at: figures.archivedAt
		})
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(and(eq(figures.teamId, teamId), isNotNull(figures.archivedAt)))
		.all())
		archived('variation', v.id, labelFor(v.figure, v.name), v.at!);
	for (const r of db
		.select({ id: routines.id, name: routines.name, at: routines.archivedAt })
		.from(routines)
		.where(and(eq(routines.teamId, teamId), isNotNull(routines.archivedAt)))
		.all())
		archived('routine', r.id, r.name, r.at!);
	for (const d of db
		.select({ id: exercises.id, name: exercises.name, at: exercises.archivedAt })
		.from(exercises)
		.where(
			and(
				eq(exercises.teamId, teamId),
				eq(exercises.source, 'custom'),
				isNotNull(exercises.archivedAt)
			)
		)
		.all())
		archived('drill', d.id, d.name, d.at!);
	for (const s of db
		.select({ id: songs.id, title: songs.title, at: songs.archivedAt })
		.from(songs)
		.where(and(eq(songs.teamId, teamId), isNotNull(songs.archivedAt)))
		.all())
		archived('song', s.id, s.title || 'Untitled song', s.at!);

	for (const p of db
		.select({ id: positions.id, name: positions.name, at: positions.archivedAt })
		.from(positions)
		.where(and(eq(positions.teamId, teamId), isNotNull(positions.archivedAt)))
		.all())
		archived('position', p.id, p.name, p.at!);

	const actors = [...new Set(items.map((i) => i.actorId).filter((a): a is string => a !== null))];
	const names = teamNames(db, teamId, actors);
	return items
		.sort((a, b) => b.at - a.at || b.id - a.id)
		.map(({ actorId, ...item }) => ({
			...item,
			by: actorId === null ? null : (names.get(actorId) ?? null)
		}));
}

/**
 * Restore one row of Recently deleted, whichever kind: a trash entry, or an
 * archived lesson, variation, routine, drill or song of this group. A refusal
 * comes with its words; null when there is no such thing in the group.
 */
export function restoreDeleted(
	db: Db,
	space: TeamSpace,
	kind: DeletedKind,
	id: number,
	now: number
): { ok: true } | { ok: false; message: string } | null {
	if (
		kind === 'lesson' ||
		kind === 'variation' ||
		kind === 'routine' ||
		kind === 'drill' ||
		kind === 'song' ||
		kind === 'position'
	) {
		// Positions have no entries, so there is nothing for `reviveEntries` to bring back.
		const restore = {
			lesson: restoreLesson,
			variation: restoreVariation,
			routine: restoreRoutine,
			drill: restoreDrill,
			song: restoreSong,
			position: restorePositionIn
		}[kind];
		const done = restore(db, space, id, now);
		if (done.ok) return done;
		return done.reason === 'gone' ? null : { ok: false, message: done.message };
	}
	const row = db.select().from(teamTrash).where(eq(teamTrash.id, id)).get();
	if (!row || row.teamId !== space.teamId || row.kind !== kind) return null;
	const done = restoreTrash(db, space, id, now);
	if (done.ok) return done;
	if (done.reason === 'not-found') return null;
	return { ok: false, message: trashRefusalLine(kind, done.reason) };
}

/** The real folders, read from `$DATA_DIR` only when a purge has a file to delete. */
function dataDirs(): TrashDirs {
	return { lessonVideos: lessonVideosDir(), recordings: recordingsDir(), audio: audioDir() };
}

/**
 * Delete for good what has been in the trash for `TRASH_MS`: each entry is
 * marked purged first, in one statement, so a Restore that arrives while its
 * file is being deleted is refused (`purged`) rather than bringing back a row
 * with no file; then the files go. The rows' snapshot stays (History links
 * to it). Group songs deleted as long ago go too (`purgeSongs`). Returns how
 * many entries and songs were purged. `dirs` is injected so specs
 * never touch `$DATA_DIR`.
 */
export async function purgeTrash(db: Db, now: number, dirs?: TrashDirs): Promise<number> {
	const due = db
		.update(teamTrash)
		.set({ purgedAt: now })
		.where(
			and(
				isNull(teamTrash.purgedAt),
				isNull(teamTrash.restoredAt),
				lte(teamTrash.deletedAt, now - TRASH_MS)
			)
		)
		.returning({ filesJson: teamTrash.filesJson })
		.all();
	const files = due.flatMap((r) => JSON.parse(r.filesJson) as TrashFile[]);
	const songFiles = purgeSongs(db, now);
	files.push(...songFiles.files);
	if (files.length > 0) {
		const where = dirs ?? dataDirs();
		for (const f of files) {
			// Only our own names, in our own folders: never a path from the row.
			if (!RECORDING_FILE_RE.test(f.file) || !(f.dir in where)) continue;
			await unlink(join(where[f.dir], f.file)).catch(() => {});
		}
	}
	return due.length + songFiles.count;
}

/**
 * A group song deleted (archived) `TRASH_MS` ago goes for good, in one
 * transaction: every entry that still picks it drops to count only, its drops
 * and opens go, then the row. Returns the files to unlink once the transaction
 * has landed. A person's own archived song is never touched here: its delete
 * is `deleteSong`'s and carries no Recently deleted.
 */
function purgeSongs(db: Db, now: number): { count: number; files: TrashFile[] } {
	return db.transaction((tx) => {
		const due = tx
			.select({ id: songs.id, file: songs.audioFile })
			.from(songs)
			.where(
				and(
					isNotNull(songs.teamId),
					isNotNull(songs.archivedAt),
					lte(songs.archivedAt, now - TRASH_MS)
				)
			)
			.all();
		if (due.length === 0) return { count: 0, files: [] };
		const ids = due.map((s) => s.id);
		tx.update(exercises).set({ songId: null }).where(inArray(exercises.songId, ids)).run();
		tx.delete(songDrops).where(inArray(songDrops.songId, ids)).run();
		tx.delete(opens)
			.where(and(eq(opens.kind, 'song'), inArray(opens.itemId, ids)))
			.run();
		tx.delete(songs).where(inArray(songs.id, ids)).run();
		return {
			count: due.length,
			files: due.flatMap((s) => (s.file ? [{ dir: 'audio' as const, file: s.file }] : []))
		};
	});
}

const HOUR = 60 * 60 * 1000;
const timer = globalThis as { __salsaTrashPurge?: ReturnType<typeof setInterval> };

/**
 * Purge now and every hour after, once per process: the dev server's module
 * reloads must not start a second timer (nor run `afterSettle` again). At
 * boot, before the first purge, the people who left a group before Keep
 * shipped get their copies (`settleFormerMembers`), then `afterSettle` runs
 * (the integrity checks, which would otherwise report what the settling is
 * about to fix). Then the trash, then the groups deleted 30 days ago
 * (`purgeTeams`). A failure is logged and never reaches a request or stops
 * the boot: a failed settling still runs `afterSettle`, and a throwing
 * `afterSettle` still purges.
 */
export function startTrashPurge(db: () => Db, afterSettle: () => void = () => {}): void {
	if (timer.__salsaTrashPurge) return;
	const run = () => {
		const now = Date.now();
		void purgeTrash(db(), now)
			.catch((err) => console.warn('[trash] purge failed', err))
			.then(() => purgeTeams(db(), now))
			.catch((err) => console.warn('[team-purge] purge failed', err));
	};
	const settle = async () => {
		const n = await settleFormerMembers(db(), realCloneFiles(), Date.now());
		console.log(`[clones] settled ${n} former group members`);
	};
	void settle()
		.catch((err) => console.warn('[clones] settling former members failed', err))
		.then(afterSettle)
		.catch((err) => console.warn('[integrity] checks failed', err))
		.then(run);
	timer.__salsaTrashPurge = setInterval(run, HOUR);
	timer.__salsaTrashPurge.unref?.();
}
