/**
 * Link from other places (spec 2026-11-10-link-from-other-places-design.md):
 * what a group's linking pickers find, while searching, in the person's own
 * app and in their other groups of the dance, for Copy and link.
 *
 * Places in order: yours, the groups you own or edit (by name), then the ones
 * you only read (by name, only what you read of them). A row is left out when
 * its family already lives in the group, or when a twin of it does; a family
 * found in several places is one row, in the first, naming the others. A row
 * whose family's member in the group is archived carries it (Restore and
 * link); one whose name the group already has, from another family, carries
 * that row (Link the group's one).
 */
import { and, asc, count, eq, isNotNull, isNull } from 'drizzle-orm';
import { fold } from '$lib/fold';
import type {
	ElsewhereKind,
	ElsewherePlace,
	ElsewhereRow,
	FigureVersion,
	TeamRef
} from '$lib/types';
import type { Db } from './db';
import {
	exercises,
	figureGroups,
	figures,
	positions,
	routines,
	spotLinks,
	spotPositionLinks,
	videoSpots
} from './db/schema';
import { ownedBy, type Space, type TeamSpace, type Wall } from './scope';
import { listMyTeams } from './teams';
import type { DanceSlug } from '$lib/dances/dances';
import { teamReader } from './access';
import { memberIn } from './clones/genes';
import { foldNamed, foldVersions, twinsOf } from './twins';

/** At most this many rows in all: a search narrows, a picker is not a list of everything. */
const MAX_ROWS = 50;

type Found = {
	kind: ElsewhereKind;
	id: number;
	label: string;
	heading: string | null;
	short: string | null;
	groupId: number | null;
	gene: string | null;
};

/** A space's live rows of a kind, as a picker shows them. */
function rowsOf(db: Db, kind: ElsewhereKind, space: Space): Found[] {
	switch (kind) {
		case 'figure':
			return db
				.select({
					id: figures.id,
					name: figures.name,
					move: figureGroups.name,
					groupId: figureGroups.id,
					gene: figures.geneId
				})
				.from(figures)
				.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
				.where(
					and(ownedBy(figures, space), isNull(figures.archivedAt), isNull(figureGroups.archivedAt))
				)
				.orderBy(asc(figureGroups.name), asc(figures.name), asc(figures.id))
				.all()
				.map((r) => ({
					kind,
					id: r.id,
					label: `${r.move} · ${r.name}`,
					heading: r.move,
					short: r.name,
					groupId: r.groupId,
					gene: r.gene
				}));
		case 'routine':
			return named(
				kind,
				db
					.select({ id: routines.id, name: routines.name, gene: routines.geneId })
					.from(routines)
					.where(and(ownedBy(routines, space), isNull(routines.archivedAt)))
					.orderBy(asc(routines.name), asc(routines.id))
					.all()
			);
		case 'drill':
			return named(
				kind,
				db
					.select({ id: exercises.id, name: exercises.name, gene: exercises.geneId })
					.from(exercises)
					.where(
						and(
							ownedBy(exercises, space),
							eq(exercises.source, 'custom'),
							isNull(exercises.archivedAt)
						)
					)
					.orderBy(asc(exercises.name), asc(exercises.id))
					.all()
			);
		case 'position':
			return named(
				kind,
				db
					.select({ id: positions.id, name: positions.name, gene: positions.geneId })
					.from(positions)
					.where(and(ownedBy(positions, space), isNull(positions.archivedAt)))
					.orderBy(asc(positions.name), asc(positions.id))
					.all()
			);
	}
}

function named(kind: ElsewhereKind, rows: { id: number; name: string; gene: string | null }[]) {
	return rows.map((r) => ({
		kind,
		id: r.id,
		label: r.name,
		heading: null,
		short: null,
		groupId: null,
		gene: r.gene
	}));
}

type Place = {
	place: ElsewherePlace['place'];
	readOnly: boolean;
	space: Space;
	reads: (kind: ElsewhereKind, id: number) => boolean;
};

/** Yours, the groups you edit, then the groups you only read; never `group` itself, never a deleted one. */
function placesFor(db: Db, group: TeamSpace): Place[] {
	const userId = group.actorId;
	const wall: Wall = { userId, dance: group.dance };
	const teams = listMyTeams(db, userId, group.dance).filter(
		(t) => t.deletedAt === null && t.id !== group.teamId
	);
	const team = (t: (typeof teams)[number], readOnly: boolean): Place => ({
		place: { kind: 'team', teamId: t.id, name: t.name },
		readOnly,
		space: { dance: group.dance, teamId: t.id, actorId: userId },
		reads: readOnly ? teamReader(db, userId, t.id) : () => true
	});
	return [
		{ place: { kind: 'mine' }, readOnly: false, space: wall, reads: () => true },
		...teams.filter((t) => t.role === 'owner' || t.role === 'editor').map((t) => team(t, false)),
		...teams.filter((t) => t.role === 'member').map((t) => team(t, true))
	];
}

const placeName = (p: Place) => (p.place.kind === 'team' ? p.place.name : '');

/**
 * What a group's pickers find elsewhere for `query`, per place, in place
 * order; places with nothing are left out. Empty for an empty query. The
 * caller has checked that `group.actorId` edits the group.
 */
export function findElsewhere(
	db: Db,
	group: TeamSpace,
	kinds: ElsewhereKind[],
	query: string
): ElsewherePlace[] {
	const words = fold(query).split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];
	const matches = (r: Found) => {
		const hay = fold(`${r.heading ?? ''} ${r.label}`);
		return words.every((w) => hay.includes(w));
	};
	const userId = group.actorId;
	const wall: Wall = { userId, dance: group.dance };
	const places = placesFor(db, group);
	// Per kind, the group's live rows by folded name, for `sameName`.
	const sameNames = new Map<ElsewhereKind, Map<string, number>>();

	// Every matching row, tagged with its place (index into `places`).
	const found: { row: Found; at: number }[] = [];
	for (const kind of kinds) {
		const here = rowsOf(db, kind, group);
		const hereIds = new Set(here.map((r) => r.id));
		const hereByName = new Map<string, number>();
		for (const r of here) if (!hereByName.has(fold(r.label))) hereByName.set(fold(r.label), r.id);

		let rows: { row: Found; at: number }[] = [];
		places.forEach((p, at) => {
			for (const row of rowsOf(db, kind, p.space)) {
				if (matches(row) && p.reads(kind, row.id)) rows.push({ row, at });
			}
		});
		// The family lives in the group: the group's row stands for it.
		rows = rows.filter(({ row }) => {
			if (row.gene === null) return true;
			const m = memberIn(db, kind, row.gene, group);
			return m === null || m.archived;
		});
		// A twin lives in the group: likewise. Positions have no fold in a picker.
		if (kind === 'figure' || kind === 'routine') {
			rows = rows.filter(
				({ row }) => !twinsOf(db, userId, kind, row.id).some((id) => hereIds.has(id))
			);
			rows = folded(db, wall, kind, rows, places);
		}
		found.push(...rows);
		sameNames.set(kind, hereByName);
	}

	// One row per family, in its first place; the others are named.
	const byGene = new Map<string, ElsewhereRow>();
	const out: ElsewhereRow[][] = places.map(() => []);
	found.sort((a, b) => a.at - b.at);
	let total = 0;
	for (const { row, at } of found) {
		const key = row.gene === null ? null : `${row.kind}:${row.gene}`;
		const first = key === null ? undefined : byGene.get(key);
		if (first) {
			const name = placeName(places[at]);
			if (name && !first.alsoIn.includes(name)) first.alsoIn.push(name);
			continue;
		}
		if (total >= MAX_ROWS) continue;
		const archived = row.gene === null ? null : memberIn(db, row.kind, row.gene, group);
		const made: ElsewhereRow = {
			kind: row.kind,
			id: row.id,
			label: row.label,
			heading: row.heading,
			short: row.short,
			alsoIn: [],
			restore: archived?.archived ? archived.id : null,
			sameName: sameNames.get(row.kind)?.get(fold(row.label)) ?? null
		};
		if (key !== null) byGene.set(key, made);
		out[at].push(made);
		total += 1;
	}
	return places.flatMap((p, at) =>
		out[at].length === 0 ? [] : [{ place: p.place, readOnly: p.readOnly, rows: out[at] }]
	);
}

/** Twin sets folded as a person's pickers fold them: one row per set. */
function folded(
	db: Db,
	wall: Wall,
	kind: 'figure' | 'routine',
	rows: { row: Found; at: number }[],
	places: Place[]
): { row: Found; at: number }[] {
	const teamOf = (at: number): TeamRef | undefined => {
		const p = places[at].place;
		return p.kind === 'team' ? { id: p.teamId, name: p.name } : undefined;
	};
	const byId = new Map(rows.map((r) => [r.row.id, r]));
	const kept =
		kind === 'figure'
			? foldVersions(
					db,
					wall,
					rows.map(({ row, at }): FigureVersion => ({
						id: row.id,
						groupId: row.groupId!,
						figure: row.heading!,
						name: row.short!,
						label: row.label,
						team: teamOf(at)
					}))
				)
			: foldNamed(
					db,
					wall,
					'routine',
					rows.map(({ row, at }) => ({ id: row.id, name: row.label, team: teamOf(at) }))
				);
	return kept.map((k) => byId.get(k.id)!);
}

/**
 * What links to a row from lesson videos, which a copy never brings: a
 * figure's or drill's sections, a position's sections and points. A routine:
 * 0 (no section links one).
 */
export function staysBehind(db: Db, kind: ElsewhereKind, id: number): number {
	if (kind === 'routine') return 0;
	if (kind === 'position') {
		return (
			db
				.select({ n: count() })
				.from(spotPositionLinks)
				.innerJoin(videoSpots, eq(videoSpots.id, spotPositionLinks.spotId))
				.where(and(eq(spotPositionLinks.positionId, id), isNotNull(videoSpots.lessonVideoId)))
				.get()?.n ?? 0
		);
	}
	const col = kind === 'figure' ? spotLinks.figureId : spotLinks.exerciseId;
	return (
		db
			.select({ n: count() })
			.from(spotLinks)
			.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
			.where(and(eq(col, id), isNotNull(videoSpots.lessonVideoId)))
			.get()?.n ?? 0
	);
}

/**
 * The group a person may copy into and link in, as the space they act in:
 * a live group of `dance` they own or edit. Null otherwise (a member, another
 * dance, a deleted or missing group): the routes answer it with a 404.
 */
export function elsewhereGroup(
	db: Db,
	userId: string,
	dance: DanceSlug,
	teamId: number
): TeamSpace | null {
	const team = listMyTeams(db, userId, dance).find((t) => t.id === teamId);
	if (!team || team.deletedAt !== null) return null;
	if (team.role !== 'owner' && team.role !== 'editor') return null;
	return { teamId, actorId: userId, dance };
}
