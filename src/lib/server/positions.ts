/**
 * Positions as owned rows: a person's own or a group's, one list per space.
 * A position is archived, never deleted. A group's changes are logged in the
 * same transaction (`logChange`); the clash check's side is `positionSeen`
 * (`clash.ts`).
 */
import { and, asc, eq, inArray, isNull, isNotNull } from 'drizzle-orm';
import type { Db } from './db';
import { fold } from '$lib/fold';
import {
	lessons,
	positions,
	spotPositionLinks,
	teams,
	videoSpots,
	type PositionRow
} from './db/schema';
import { addedLessonIds, reachFrom } from './access';
import { DANCES, isStyleOf, type DanceSlug } from '$lib/dances/dances';
import { TEMPLATES } from '$lib/positions/templates';
import type { ChangeValues, PositionInput, PositionSummary } from '$lib/types';
import { inSpace, isTeam, ownedBy, ownerValues, spaceOfRow, type Space } from './scope';
import { copiedFromPlaces } from './clones/genes';
import { fieldChange, logChange } from './changes';
import { reconcileEntries } from './entries';
import type { ArchiveRestore } from './trash';

export type NameRefusal = { field: 'name'; message: string };

/** The space's own positions, live (or archived), by type in the dance's order (untyped last), then folded name. */
export function listPositions(
	db: Db,
	space: Space,
	opts: { archived?: boolean } = {}
): PositionRow[] {
	const rows = db
		.select()
		.from(positions)
		.where(
			and(
				ownedBy(positions, space),
				opts.archived ? isNotNull(positions.archivedAt) : isNull(positions.archivedAt)
			)
		)
		.orderBy(asc(positions.id))
		.all();
	return sortPositions(rows, space.dance);
}

/** Positions in list order (ruling 7): by type in the dance's order, untyped last, then folded name, then id. */
export function sortPositions<T extends { id: number; name: string; styleTag: string | null }>(
	rows: T[],
	dance: DanceSlug
): T[] {
	const order = DANCES[dance].styles;
	const rank = (r: T) => {
		const i = r.styleTag === null ? -1 : order.indexOf(r.styleTag);
		return i < 0 ? order.length : i;
	};
	return rows.sort(
		(a, b) =>
			rank(a) - rank(b) ||
			(fold(a.name) < fold(b.name) ? -1 : fold(a.name) > fold(b.name) ? 1 : 0) ||
			a.id - b.id
	);
}

/** One position by id, whatever its owner: callers check access. */
export function getPosition(db: Db, id: number): PositionRow | null {
	return db.select().from(positions).where(eq(positions.id, id)).get() ?? null;
}

/** Is a LIVE position of the space already called this? Folded (accents, case); `exceptId` leaves one out. */
export function nameTaken(db: Db, space: Space, name: string, exceptId?: number): boolean {
	const want = fold(name);
	return listPositions(db, space).some((p) => p.id !== exceptId && fold(p.name) === want);
}

/** What a taken name says: "You already have a position called …", or the group's. */
export function nameRefusal(db: Db, space: Space, name: string): NameRefusal {
	if (isTeam(space)) {
		const team = db
			.select({ name: teams.name })
			.from(teams)
			.where(eq(teams.id, space.teamId))
			.get();
		return {
			field: 'name',
			message: `${team?.name ?? 'This group'} already has a position called ${name}.`
		};
	}
	return { field: 'name', message: `You already have a position called ${name}.` };
}

/** The columns an input writes; a style outside the dance's is dropped. */
function columns(dance: string, input: PositionInput, name: string, pictureSpotId: number | null) {
	return {
		name,
		styleTag: input.styleTag !== null && isStyleOf(dance, input.styleTag) ? input.styleTag : null,
		hands: input.hold.hands,
		crossed: input.hold.crossed,
		facing: input.hold.facing,
		frame: input.hold.frame,
		notes: input.notes,
		pictureSpotId
	};
}

/** A picture is a point linked to this position; anything else is no picture. */
function validPicture(tx: Db, positionId: number, spotId: number | null): number | null {
	if (spotId === null) return null;
	const ok = tx
		.select({ id: videoSpots.id })
		.from(spotPositionLinks)
		.innerJoin(videoSpots, eq(videoSpots.id, spotPositionLinks.spotId))
		.where(
			and(
				eq(spotPositionLinks.positionId, positionId),
				eq(spotPositionLinks.spotId, spotId),
				isNull(videoSpots.endMs)
			)
		)
		.get();
	return ok ? spotId : null;
}

const valuesOf = (r: PositionRow): ChangeValues => ({
	name: r.name,
	styleTag: r.styleTag,
	hands: r.hands,
	crossed: r.crossed === null ? null : r.crossed ? 1 : 0,
	facing: r.facing,
	frame: r.frame,
	notes: r.notes,
	pictureSpotId: r.pictureSpotId
});

function insert(tx: Db, space: Space, input: PositionInput, name: string, now: number) {
	const row = tx
		.insert(positions)
		.values({
			...ownerValues(space),
			slug: 'p-' + crypto.randomUUID(),
			...columns(space.dance, input, name, null),
			createdAt: now
		})
		.returning()
		.get();
	logChange(
		tx,
		space,
		{ rootKind: 'position', rootId: row.id, verb: 'add', subject: 'position', after: { name } },
		now
	);
	return row;
}

/** Add a position to the space. A taken or empty name is a refusal, not a throw. */
export function createPosition(
	db: Db,
	space: Space,
	input: PositionInput,
	now: number
): PositionRow | NameRefusal {
	const name = input.name.trim();
	if (!name) return { field: 'name', message: 'Give it a name.' };
	return db.transaction((tx) => {
		if (nameTaken(tx, space, name)) return nameRefusal(tx, space, name);
		return insert(tx, space, input, name, now);
	});
}

/**
 * Edit a position. Null when gone. A group's row needs `by` (History names the actor;
 * `verb` is 'restore' when History's Restore puts a field back).
 */
export function updatePosition(
	db: Db,
	id: number,
	input: PositionInput,
	by?: { actorId: string; now: number; verb?: 'change' | 'restore' }
): PositionRow | NameRefusal | null {
	return db.transaction((tx) => {
		const current = getPosition(tx, id);
		if (!current) return null;
		const space = spaceOfRow(current, by?.actorId ?? '');
		const name = input.name.trim();
		if (!name) return { field: 'name', message: 'Give it a name.' } as NameRefusal;
		if (fold(name) !== fold(current.name) && nameTaken(tx, space, name, id))
			return nameRefusal(tx, space, name);
		const row = tx
			.update(positions)
			.set(columns(current.dance, input, name, validPicture(tx, id, input.pictureSpotId)))
			.where(eq(positions.id, id))
			.returning()
			.get();
		const change = fieldChange(valuesOf(current), valuesOf(row), 'position');
		if (change) {
			logChange(
				tx,
				space,
				{ rootKind: 'position', rootId: id, verb: by?.verb ?? 'change', ...change },
				by?.now ?? Date.now()
			);
		}
		return row;
	});
}

/**
 * Archive a position (its tags and links stay). False when gone or already
 * archived. A group's leaves its members' reach (ruling 12 reads live ones
 * only): what their own figures, lessons and sections used of it is rescued
 * into their app (`reconcileEntries`), after the archive, in its transaction.
 */
export function archivePosition(
	db: Db,
	id: number,
	now: number,
	by?: { actorId: string }
): boolean {
	return db.transaction((tx) => {
		const row = getPosition(tx, id);
		if (!row || row.archivedAt !== null) return false;
		tx.update(positions).set({ archivedAt: now }).where(eq(positions.id, id)).run();
		if (row.teamId !== null) reconcileEntries(tx, row.teamId, now);
		logChange(
			tx,
			spaceOfRow(row, by?.actorId ?? ''),
			{
				rootKind: 'position',
				rootId: id,
				verb: 'archive',
				subject: 'position',
				after: { name: row.name }
			},
			now
		);
		return true;
	});
}

/** Bring one back. False when gone, live, or a live position has taken its name. */
export function restorePosition(
	db: Db,
	id: number,
	now: number,
	by?: { actorId: string }
): boolean {
	return db.transaction((tx) => {
		const row = getPosition(tx, id);
		if (!row || row.archivedAt === null) return false;
		const space = spaceOfRow(row, by?.actorId ?? '');
		if (nameTaken(tx, space, row.name, id)) return false;
		tx.update(positions).set({ archivedAt: null }).where(eq(positions.id, id)).run();
		logChange(
			tx,
			space,
			{
				rootKind: 'position',
				rootId: id,
				verb: 'restore',
				subject: 'position',
				after: { name: row.name }
			},
			now
		);
		return true;
	});
}

/**
 * `restorePosition` of a position of `space`, answered as the other kinds'
 * restores are: `taken` (with what a taken name says) when a live position
 * of the space has its name, `gone` when it is not the space's or not
 * archived.
 */
export function restorePositionIn(db: Db, space: Space, id: number, now: number): ArchiveRestore {
	const row = getPosition(db, id);
	if (!row || row.archivedAt === null || !inSpace(row, space)) return { ok: false, reason: 'gone' };
	if (nameTaken(db, space, row.name, id))
		return { ok: false, reason: 'taken', message: nameRefusal(db, space, row.name).message };
	const actorId = isTeam(space) ? space.actorId : undefined;
	return restorePosition(db, id, now, actorId === undefined ? undefined : { actorId })
		? { ok: true }
		: { ok: false, reason: 'gone' };
}

/**
 * Add the named templates of a type to the space, skipping names it already
 * has (folded). Each row's type is `type`, its notes the template's
 * description and its hold the template's.
 */
export function addTemplates(
	db: Db,
	space: Space,
	dance: DanceSlug,
	type: string,
	names: string[],
	now: number
): PositionRow[] {
	const templates = TEMPLATES[dance]?.[type] ?? [];
	return db.transaction((tx) => {
		const made: PositionRow[] = [];
		for (const name of names) {
			const t = templates.find((x) => x.name === name);
			if (!t || nameTaken(tx, space, t.name)) continue;
			made.push(
				insert(
					tx,
					space,
					{ name: t.name, styleTag: type, hold: t.hold, notes: t.description, pictureSpotId: null },
					t.name,
					now
				)
			);
		}
		return made;
	});
}

/**
 * Which of the person's added lessons of a group brought each of these
 * positions (their figures' tags, hand links, or links on their videos): the
 * list's "from Week 6". The earliest lesson by day wins; a position no added
 * lesson reaches (the person's own rows use it) is left out.
 */
export function positionsFrom(
	db: Db,
	userId: string,
	teamId: number,
	ids: number[]
): Map<number, string> {
	const out = new Map<number, string>();
	if (ids.length === 0) return out;
	const want = new Set(ids);
	const added = addedLessonIds(db, userId, teamId);
	if (added.length === 0) return out;
	const byDay = db
		.select({ id: lessons.id, title: lessons.title })
		.from(lessons)
		.where(inArray(lessons.id, added))
		.orderBy(asc(lessons.lessonDay), asc(lessons.id))
		.all();
	for (const l of byDay) {
		for (const id of reachFrom(db, teamId, [l.id]).positions) {
			if (want.has(id) && !out.has(id)) out.set(id, l.title);
		}
		if (out.size === want.size) break;
	}
	return out;
}

/** A row as lists and pickers see it; `teamId` is null for the viewer's own space's rows. */
export function positionSummary(row: PositionRow, viewerSpace: Space): PositionSummary {
	return {
		id: row.id,
		name: row.name,
		styleTag: row.styleTag,
		hold: {
			hands: row.hands as PositionSummary['hold']['hands'],
			crossed: row.crossed,
			facing: row.facing as PositionSummary['hold']['facing'],
			frame: row.frame as PositionSummary['hold']['frame']
		},
		teamId: isTeam(viewerSpace) ? null : row.teamId,
		archived: row.archivedAt !== null
	};
}

/** `rows` with where each copy came from (`copiedFromPlaces`), for a picker that draws a same name apart. */
export function withCopiedFrom<T extends PositionSummary>(db: Db, userId: string, rows: T[]): T[] {
	const from = copiedFromPlaces(
		db,
		userId,
		'position',
		rows.map((r) => r.id)
	);
	return rows.map((r) => ({ ...r, copiedFrom: from.get(r.id) ?? null }));
}
