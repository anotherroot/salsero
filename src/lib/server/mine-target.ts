/**
 * Where Mine lands from a page of one thing in a group's view (group view spec,
 * rule 6): the person's own copy of it (a live clone in its family), else their
 * twin of it, else for a figure their own first figure in the same merged move
 * (the switcher's order), else null: the client opens the tab's own list.
 */
import { and, eq, isNull } from 'drizzle-orm';
import type { CloneKind, TwinKind } from '$lib/types';
import type { RowKind } from '$lib/teams/group-view';
import type { Db } from './db';
import { exercises, figureGroups, figures, lessons, positions, routines, songs } from './db/schema';
import { geneOf, memberIn } from './clones/genes';
import { twinsOf } from './twins';
import { mergedMoveFigures } from './moves-lists';
import type { Wall } from './scope';

const TABLES = {
	lesson: lessons,
	figure: figures,
	routine: routines,
	position: positions,
	song: songs,
	drill: exercises
} as const;

const PATHS: Record<keyof typeof TABLES, string> = {
	lesson: 'lessons',
	figure: 'figures',
	routine: 'routines',
	position: 'positions',
	song: 'songs',
	drill: 'exercises'
};

type Kind = keyof typeof TABLES;

/** Whether `id` is the person's own live row of this kind, in this dance. */
function ownLive(db: Db, wall: Wall, kind: Kind, id: number): boolean {
	const t = TABLES[kind];
	return (
		db
			.select({ id: t.id })
			.from(t)
			.where(
				and(eq(t.id, id), eq(t.userId, wall.userId), eq(t.dance, wall.dance), isNull(t.archivedAt))
			)
			.get() !== undefined
	);
}

export function mineTarget(db: Db, wall: Wall, kind: RowKind, id: number): string | null {
	if (kind === 'group') return `/${wall.dance}/groups`;
	if (kind === 'move') return null;
	const at = (own: number) => `/${wall.dance}/${PATHS[kind]}/${own}`;
	const gene = geneOf(db, kind as CloneKind, id);
	if (gene !== null) {
		const copy = memberIn(db, kind as CloneKind, gene, wall);
		if (copy && !copy.archived && copy.id !== id) return at(copy.id);
	}
	if (kind !== 'drill') {
		const twin = twinsOf(db, wall.userId, kind as TwinKind, id).find((t) =>
			ownLive(db, wall, kind, t)
		);
		if (twin !== undefined) return at(twin);
	}
	if (kind === 'figure') {
		const move = db
			.select({ name: figureGroups.name })
			.from(figures)
			.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
			.where(eq(figures.id, id))
			.get();
		if (move) {
			const first = mergedMoveFigures(db, wall, move.name).figures.find((f) => f.team === null);
			if (first) return at(first.id);
		}
	}
	return null;
}
