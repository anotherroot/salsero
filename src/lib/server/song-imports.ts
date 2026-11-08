/**
 * A pasted playlist or album: its life from the box to the pick list. The
 * worker reads it (a third queue beside songs and videos, with the songs'
 * lease and attempts); the person then adds the songs they tick. Nothing
 * downloads by itself, and nothing here is a group mutation: creating,
 * reading, retrying and dismissing change no content (the songs Add makes are
 * logged as song adds). See
 * docs/superpowers/specs/2026-11-08-spotify-and-playlists-design.md.
 */
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from './db';
import { songImports, songs, teamMembers, teams, type SongImport } from './db/schema';
import { ownedBy, ownerValues, type Space } from './scope';
import { createSongFromUrl, LEASE_MS, MAX_ATTEMPTS } from './songs';
import { serverNow } from '$lib/server/server-clock';
import { classifyLink, songKeyOf } from '$lib/songs/source';
import type { DanceSlug } from '$lib/dances/dances';
import type { SongImportKind } from '$lib/labels';
import type { ImportItem, PickItem, SongImportRow, TeamRef } from '$lib/types';

/** The most songs one list brings: the worker stops there, and the server refuses more. */
export const MAX_IMPORT_ITEMS = 200;

const LIVE = and(isNull(songImports.addedAt), isNull(songImports.dismissedAt));

export function createImport(
	db: Db,
	space: Space,
	input: { url: string; kind: SongImportKind },
	now = serverNow()
): SongImport {
	return db
		.insert(songImports)
		.values({
			...ownerValues(space),
			dance: space.dance,
			url: input.url,
			kind: input.kind,
			status: 'reading',
			createdAt: now
		})
		.returning()
		.get();
}

export function getImport(db: Db, id: number): SongImport | null {
	return db.select().from(songImports).where(eq(songImports.id, id)).get() ?? null;
}

/**
 * Hand the oldest reading import to the worker and lease it, as `claimJob`
 * does for songs: a stale claim past MAX_ATTEMPTS fails instead.
 */
export function claimImportJob(db: Db, now: number): { id: number; url: string } | null {
	return db.transaction((tx) => {
		const stale = or(isNull(songImports.claimedAt), lt(songImports.claimedAt, now - LEASE_MS));
		const reading = and(LIVE, eq(songImports.status, 'reading'), stale);
		tx.update(songImports)
			.set({
				status: 'failed',
				error: `Gave up after ${MAX_ATTEMPTS} attempts.`,
				claimedAt: null
			})
			.where(and(reading, sql`${songImports.attempts} >= ${MAX_ATTEMPTS}`))
			.run();
		const next = tx
			.select()
			.from(songImports)
			.where(reading)
			.orderBy(asc(songImports.createdAt), asc(songImports.id))
			.limit(1)
			.get();
		if (!next) return null;
		tx.update(songImports)
			.set({ claimedAt: now, attempts: next.attempts + 1 })
			.where(eq(songImports.id, next.id))
			.run();
		return { id: next.id, url: next.url };
	});
}

const text = (v: unknown, max: number): string | null =>
	typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : null;

/** One reported item, kept only when it is one YouTube video or one Spotify track. */
function cleanItem(raw: unknown): ImportItem | null {
	if (raw === null || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const title = text(r.title, 200);
	if (!title || typeof r.url !== 'string') return null;
	const k = classifyLink(r.url);
	const url =
		k.kind === 'youtube-video'
			? `https://www.youtube.com/watch?v=${k.id}`
			: k.kind === 'spotify-track'
				? `https://open.spotify.com/track/${k.id}`
				: null;
	if (!url) return null;
	const d = r.durationS;
	return {
		title,
		artist: text(r.artist, 200),
		durationS: typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : null,
		url
	};
}

/**
 * The worker's read: the list's name and its songs, written once. `bad` for a
 * report that is not a list or is longer than MAX_IMPORT_ITEMS (nothing
 * written); `gone` when the import is no longer reading (dismissed, added,
 * already read). Items that are no video or track are dropped; a list left
 * with none fails.
 */
export function storeImportItems(
	db: Db,
	id: number,
	input: { name: unknown; items: unknown; truncated: unknown }
): 'stored' | 'gone' | 'bad' {
	if (!Array.isArray(input.items) || input.items.length > MAX_IMPORT_ITEMS) return 'bad';
	const imp = getImport(db, id);
	if (!imp || imp.status !== 'reading' || imp.addedAt !== null || imp.dismissedAt !== null)
		return 'gone';
	const items = input.items.map(cleanItem).filter((i): i is ImportItem => i !== null);
	const set =
		items.length === 0
			? { status: 'failed' as const, error: 'No songs found in this list.' }
			: { status: 'ready' as const, error: null };
	db.update(songImports)
		.set({
			...set,
			name: text(input.name, 200),
			itemsJson: JSON.stringify(items),
			truncated: input.truncated === true ? 1 : 0,
			claimedAt: null
		})
		.where(eq(songImports.id, id))
		.run();
	return 'stored';
}

/** As `failJob`: a transient failure keeps its lease (the backoff); a permanent one, or the last, fails. */
export function failImportJob(db: Db, id: number, error: string, permanent: boolean): void {
	const imp = getImport(db, id);
	if (!imp || imp.status !== 'reading') return;
	const giveUp = permanent || imp.attempts >= MAX_ATTEMPTS;
	db.update(songImports)
		.set(
			giveUp
				? { error: error.slice(0, 500), claimedAt: null, status: 'failed' }
				: { error: error.slice(0, 500) }
		)
		.where(eq(songImports.id, id))
		.run();
}

/** A failed read back in the queue. False for anything else. */
export function retryImport(db: Db, id: number): boolean {
	return (
		db
			.update(songImports)
			.set({ status: 'reading', attempts: 0, error: null, claimedAt: null })
			.where(and(eq(songImports.id, id), eq(songImports.status, 'failed'), LIVE))
			.run().changes > 0
	);
}

/** Cancel (while reading) and Dismiss (after): the list goes, nothing downloaded. */
export function dismissImport(db: Db, id: number, now = serverNow()): boolean {
	return (
		db
			.update(songImports)
			.set({ dismissedAt: now })
			.where(and(eq(songImports.id, id), LIVE))
			.run().changes > 0
	);
}

function countOf(json: string | null): number {
	try {
		const v = JSON.parse(json ?? '[]');
		return Array.isArray(v) ? v.length : 0;
	} catch {
		return 0;
	}
}

function rowOf(imp: SongImport, group: TeamRef | null): SongImportRow {
	return {
		id: imp.id,
		kind: imp.kind,
		name: imp.name,
		status: imp.status,
		error: imp.error,
		count: countOf(imp.itemsJson),
		truncated: imp.truncated === 1,
		group
	};
}

/** The live imports of one space (reading, ready, failed), newest first. */
export function listImports(db: Db, space: Space): SongImportRow[] {
	return db
		.select()
		.from(songImports)
		.where(and(ownedBy(songImports, space), eq(songImports.dance, space.dance), LIVE))
		.orderBy(desc(songImports.createdAt), desc(songImports.id))
		.all()
		.map((imp) => rowOf(imp, null));
}

/** The groups of this dance a person edits (owner or editor), live. */
function editedGroups(db: Db, userId: string, dance: DanceSlug): TeamRef[] {
	return db
		.select({ id: teams.id, name: teams.name, role: teamMembers.role })
		.from(teamMembers)
		.innerJoin(teams, eq(teams.id, teamMembers.teamId))
		.where(
			and(
				eq(teamMembers.userId, userId),
				eq(teams.dance, dance),
				isNull(teams.deletedAt),
				isNull(teams.purgedAt)
			)
		)
		.orderBy(asc(teams.name), asc(teams.id))
		.all()
		.filter((r) => r.role === 'owner' || r.role === 'editor')
		.map(({ id, name }) => ({ id, name }));
}

/**
 * The ready lists of the groups a person edits, each named by its group: shown
 * under To pick in their own Music too, so the dot always points at a row.
 */
export function groupImportsToPick(db: Db, userId: string, dance: DanceSlug): SongImportRow[] {
	const groups = editedGroups(db, userId, dance);
	if (groups.length === 0) return [];
	const byId = new Map(groups.map((g) => [g.id, g]));
	return db
		.select()
		.from(songImports)
		.where(
			and(
				inArray(songImports.teamId, [...byId.keys()]),
				eq(songImports.dance, dance),
				eq(songImports.status, 'ready'),
				LIVE
			)
		)
		.orderBy(desc(songImports.createdAt), desc(songImports.id))
		.all()
		.map((imp) => rowOf(imp, byId.get(imp.teamId!)!));
}

/** The Music dot: a ready, live list the person may pick, their own or a group's they edit. */
export function importsWaiting(db: Db, userId: string, dance: DanceSlug): boolean {
	const own = db
		.select({ id: songImports.id })
		.from(songImports)
		.where(
			and(
				eq(songImports.userId, userId),
				eq(songImports.dance, dance),
				eq(songImports.status, 'ready'),
				LIVE
			)
		)
		.limit(1)
		.get();
	return own !== undefined || groupImportsToPick(db, userId, dance).length > 0;
}

/** One ticked song as the pick list sends it (`readPicks`): an item's index and what was typed. */
export type Pick = { i: number; title: string; artist: string | null; style: string };

/** The import's items; null when unreadable. */
export function itemsOf(imp: SongImport): ImportItem[] {
	try {
		const v = JSON.parse(imp.itemsJson ?? '[]');
		return Array.isArray(v) ? (v as ImportItem[]) : [];
	} catch {
		return [];
	}
}

/**
 * The pick list's rows: each item with `already` when a live song of the
 * import's space has the same link (its own, or the one chosen for its audio).
 */
export function pickItems(db: Db, imp: SongImport): PickItem[] {
	const space =
		imp.teamId !== null
			? { dance: imp.dance as DanceSlug, teamId: imp.teamId, actorId: '' }
			: { dance: imp.dance as DanceSlug, userId: imp.userId! };
	const have = new Set<string>();
	for (const s of db
		.select({ sourceUrl: songs.sourceUrl, audioUrl: songs.audioUrl })
		.from(songs)
		.where(and(ownedBy(songs, space), isNull(songs.archivedAt)))
		.all())
		for (const url of [s.sourceUrl, s.audioUrl]) {
			const key = songKeyOf(url);
			if (key) have.add(key);
		}
	return itemsOf(imp).map((item, i) => {
		const key = songKeyOf(item.url);
		return { ...item, i, already: key !== null && have.has(key) };
	});
}

/**
 * Add: the ticked songs as `waiting_download` songs of `space` (the import's:
 * the caller passes it), one insert and, in a group, one History line each, in
 * one transaction that first marks the import added, so a second Add (a double
 * tap, another tab) finds it gone.
 */
export function addFromImport(
	db: Db,
	space: Space,
	id: number,
	picks: Pick[],
	now = serverNow()
): { ok: true; songIds: number[] } | { ok: false; reason: 'gone' | 'empty' } {
	if (picks.length === 0) return { ok: false, reason: 'empty' };
	return db.transaction((t) => {
		const tx = t as unknown as Db;
		const imp = getImport(tx, id);
		if (!imp || imp.status !== 'ready' || imp.addedAt !== null || imp.dismissedAt !== null)
			return { ok: false as const, reason: 'gone' as const };
		tx.update(songImports).set({ addedAt: now }).where(eq(songImports.id, id)).run();
		const items = itemsOf(imp);
		const songIds = picks.map(
			(p) =>
				createSongFromUrl(
					tx,
					space,
					{ url: items[p.i].url, title: p.title, artist: p.artist, style: p.style },
					now
				).id
		);
		return { ok: true as const, songIds };
	});
}
