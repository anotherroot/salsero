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
 *
 * `move` finds moves by their own name, for New figure's Move field: no family,
 * one row per name (in its first place, naming the rest), never a name the
 * group's moves already have (the group's own row stands for it). A group you
 * only read shows a move once you read one of its figures.
 */
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { fold } from '$lib/fold';
import type {
	ElsewhereFind,
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
	lessonVideos,
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
import { foldNamed, foldVersions, storedTwinSets } from './twins';
import { looksFor } from './loops/pictures';

/** At most this many rows of a kind per place: a search narrows, a picker is not a list of everything. */
export const PER_KIND = 15;

type Found = {
	kind: ElsewhereFind;
	id: number;
	label: string;
	heading: string | null;
	short: string | null;
	groupId: number | null;
	gene: string | null;
	/** A move's live figures: a group you only read shows it once you read one. */
	figureIds?: number[];
};

/** A space's live rows of a kind, as a picker shows them. */
function rowsOf(db: Db, kind: ElsewhereFind, space: Space): Found[] {
	switch (kind) {
		case 'move': {
			const moves = new Map<number, Found>();
			const rows = db
				.select({ id: figureGroups.id, name: figureGroups.name, figureId: figures.id })
				.from(figureGroups)
				.innerJoin(figures, eq(figures.groupId, figureGroups.id))
				.where(
					and(
						ownedBy(figureGroups, space),
						isNull(figureGroups.archivedAt),
						isNull(figures.archivedAt)
					)
				)
				.orderBy(asc(figureGroups.name), asc(figureGroups.id))
				.all();
			for (const r of rows) {
				const m = moves.get(r.id);
				if (m) m.figureIds!.push(r.figureId);
				else
					moves.set(r.id, {
						...named(kind, [{ id: r.id, name: r.name, gene: null }])[0],
						figureIds: [r.figureId]
					});
			}
			return [...moves.values()];
		}
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

function named(kind: ElsewhereFind, rows: { id: number; name: string; gene: string | null }[]) {
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

/** The place shows the row to the person: a move, once they read one of its figures. */
const readsRow = (p: Place, row: Found) =>
	row.kind === 'move'
		? (row.figureIds ?? []).some((id) => p.reads('figure', id))
		: p.reads(row.kind, row.id);

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
 *
 * A fixed number of queries per kind and place, whatever the library's size:
 * the group's families and the person's twin sets are read once, and every
 * row's checks are lookups. Each place shows at most `PER_KIND` rows of each
 * kind, so a long list of one never hides the others.
 */
export function findElsewhere(
	db: Db,
	group: TeamSpace,
	kinds: ElsewhereFind[],
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
	// Per kind, what the group holds: its live rows by folded name (`sameName`)
	// and its members, archived ones too, by family.
	const sameNames = new Map<ElsewhereFind, Map<string, number>>();
	const members = new Map<ElsewhereFind, Map<string, { id: number; archived: boolean }>>();

	// Every matching row, tagged with its place (index into `places`).
	const found: { row: Found; at: number }[] = [];
	for (const kind of kinds) {
		const here = rowsOf(db, kind, group);
		const hereIds = new Set(here.map((r) => r.id));
		const hereByName = new Map<string, number>();
		for (const r of here) if (!hereByName.has(fold(r.label))) hereByName.set(fold(r.label), r.id);
		sameNames.set(kind, hereByName);
		let rows: { row: Found; at: number }[] = [];
		places.forEach((p, at) => {
			for (const row of rowsOf(db, kind, p.space)) {
				if (matches(row) && readsRow(p, row)) rows.push({ row, at });
			}
		});
		if (kind === 'move') {
			// A name only: the group's move of that name stands for it.
			found.push(...rows.filter(({ row }) => !hereByName.has(fold(row.label))));
			continue;
		}
		const byGene = familiesIn(db, kind, group);
		members.set(kind, byGene);

		// The family lives in the group: the group's row stands for it.
		rows = rows.filter(({ row }) => row.gene === null || byGene.get(row.gene)?.archived !== false);
		// A twin lives in the group: likewise. Positions have no fold in a picker.
		if (kind === 'figure' || kind === 'routine') {
			const twinned = new Set<number>();
			for (const set of storedTwinSets(db, userId, kind))
				if (set.some((id) => hereIds.has(id))) for (const id of set) twinned.add(id);
			rows = rows.filter(({ row }) => !twinned.has(row.id));
			rows = folded(db, wall, kind, rows, places);
		}
		found.push(...rows);
	}

	// One row per family, in its first place; the others are named.
	const byFamily = new Map<string, ElsewhereRow>();
	const out: ElsewhereRow[][] = places.map(() => []);
	const shown = new Map<string, number>();
	found.sort((a, b) => a.at - b.at);
	for (const { row, at } of found) {
		// A family is one row; so is a move's name.
		const key =
			row.kind === 'move'
				? `move:${fold(row.label)}`
				: row.gene === null
					? null
					: `${row.kind}:${row.gene}`;
		const first = key === null ? undefined : byFamily.get(key);
		if (first) {
			const name = placeName(places[at]);
			if (name && !first.alsoIn.includes(name)) first.alsoIn.push(name);
			continue;
		}
		const slot = `${at}:${row.kind}`;
		const n = shown.get(slot) ?? 0;
		if (n >= PER_KIND) continue;
		shown.set(slot, n + 1);
		const member = row.gene === null ? undefined : members.get(row.kind)?.get(row.gene);
		const made: ElsewhereRow = {
			kind: row.kind,
			id: row.id,
			label: row.label,
			heading: row.heading,
			short: row.short,
			alsoIn: [],
			restore: member?.archived ? member.id : null,
			sameName: sameNames.get(row.kind)?.get(fold(row.label)) ?? null
		};
		if (key !== null) byFamily.set(key, made);
		out[at].push(made);
	}
	// Picker preview: each figure's positions, length and picture, as the person reads it.
	const figureRows = out.flat().filter((r) => r.kind === 'figure');
	const looks = looksFor(
		db,
		figureRows.map((r) => r.id),
		{ viewer: userId, ownSections: true }
	);
	for (const r of figureRows) {
		const look = looks.get(r.id);
		if (look) r.look = look;
	}
	return places.flatMap((p, at) =>
		out[at].length === 0 ? [] : [{ place: p.place, readOnly: p.readOnly, rows: out[at] }]
	);
}

/** The group's members of a kind, archived ones too, by family (`memberIn` for every family at once). */
function familiesIn(
	db: Db,
	kind: ElsewhereKind,
	group: TeamSpace
): Map<string, { id: number; archived: boolean }> {
	const t = { figure: figures, routine: routines, drill: exercises, position: positions }[kind];
	const rows = db
		.select({ id: t.id, gene: t.geneId, archivedAt: t.archivedAt })
		.from(t)
		.where(
			and(
				ownedBy(t, group),
				isNotNull(t.geneId),
				kind === 'drill' ? eq(exercises.source, 'custom') : undefined
			)
		)
		.orderBy(asc(t.id))
		.all();
	const out = new Map<string, { id: number; archived: boolean }>();
	// One member per place; a live one wins if a family ever had two.
	for (const r of rows) {
		const had = out.get(r.gene!);
		if (!had || (had.archived && r.archivedAt === null))
			out.set(r.gene!, { id: r.id, archived: r.archivedAt !== null });
	}
	return out;
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
 * 0 (no section links one). With `reads`, only the lessons it passes count:
 * a group's row the person only reads counts what they reach, never a
 * draft's sections.
 */
export function staysBehind(
	db: Db,
	kind: ElsewhereKind,
	id: number,
	reads?: (lessonId: number) => boolean
): number {
	if (kind === 'routine') return 0;
	const lessonsOf =
		kind === 'position'
			? db
					.select({ lessonId: lessonVideos.lessonId })
					.from(spotPositionLinks)
					.innerJoin(videoSpots, eq(videoSpots.id, spotPositionLinks.spotId))
					.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
					.where(eq(spotPositionLinks.positionId, id))
					.all()
			: db
					.select({ lessonId: lessonVideos.lessonId })
					.from(spotLinks)
					.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
					.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
					.where(eq(kind === 'figure' ? spotLinks.figureId : spotLinks.exerciseId, id))
					.all();
	return reads ? lessonsOf.filter((r) => reads(r.lessonId)).length : lessonsOf.length;
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
