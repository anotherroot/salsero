/**
 * Twins show as one (board C7 p3, ruling 9): the Moves list and every picker
 * fold a person's twin sets so each set is one row. PURE, client-safe.
 *
 * Which member is shown: the person's own if they have one (the first, in
 * the list's order), else the first by group name. The others leave the
 * list; the shown one carries a "Twins" chip. A set with fewer than two
 * members in the list folds nothing. Group mode folds nothing: groups have
 * no twins, so its callers never ask.
 */
import type { MoveRow, TeamRef, TwinNote } from '$lib/types';
import { t } from '$lib/i18n/catalog';

/** The chip on a row that stands for its twins. */
export const twinsChip = (): string => t().clones.twins.chip;

/** The chip on a row with clones (`copies` > 0): "Clone". */
export const cloneChip = (): string => t().clones.cloneChip;

/**
 * The member a set is shown as: the person's own first (`team` null), then
 * by group name, then by the order given.
 */
function usedOf(ids: number[], teamName: (id: number) => string | null): number {
	return ids
		.map((id, i) => ({ id, i, name: teamName(id) }))
		.sort((a, b) => {
			if ((a.name === null) !== (b.name === null)) return a.name === null ? -1 : 1;
			return (a.name ?? '').localeCompare(b.name ?? '') || a.i - b.i;
		})[0].id;
}

/**
 * Each set restricted to the ids present, with the one shown and the ones
 * hidden behind it. Sets that share an id are taken as given (the table
 * keeps them apart).
 */
function folds(
	sets: number[][],
	present: (id: number) => boolean,
	teamName: (id: number) => string | null
): { shown: number; hidden: number[] }[] {
	const out: { shown: number; hidden: number[] }[] = [];
	for (const set of sets) {
		const here = [...new Set(set)].filter(present);
		if (here.length < 2) continue;
		const shown = usedOf(here, teamName);
		out.push({ shown, hidden: here.filter((id) => id !== shown) });
	}
	return out;
}

/**
 * The Figures list with the person's twin sets folded:
 * - each set shows once, as their figure if one is theirs, else the first by
 *   group name; the other members leave their sections;
 * - a move left with no figures loses its heading, and when it was a group's,
 *   that group's name goes into `also` of each move holding a shown member it
 *   folded into ("also in Salsa Tuesdays, Rueda club"), in the order of `groups`;
 * - a group left with no moves loses its section;
 * - `twinOf` maps a shown figure to the twins hidden behind it (the chip).
 */
export function foldMoves(
	mine: MoveRow[],
	groups: { team: TeamRef; moves: MoveRow[] }[],
	sets: number[][]
): {
	mine: (MoveRow & { also: string[] })[];
	groups: { team: TeamRef; moves: (MoveRow & { also: string[] })[] }[];
	twinOf: Map<number, number[]>;
} {
	// Where each figure sits: -1 for the person's own, else its group's index.
	const where = new Map<number, number>();
	for (const m of mine) for (const f of m.figures) where.set(f.id, -1);
	groups.forEach((g, gi) => {
		for (const m of g.moves) for (const f of m.figures) if (!where.has(f.id)) where.set(f.id, gi);
	});
	const nameOf = (id: number) => {
		const gi = where.get(id)!;
		return gi === -1 ? null : groups[gi].team.name;
	};
	const twinOf = new Map<number, number[]>();
	const shownFor = new Map<number, number>();
	for (const f of folds(sets, (id) => where.has(id), nameOf)) {
		twinOf.set(f.shown, [...(twinOf.get(f.shown) ?? []), ...f.hidden]);
		for (const h of f.hidden) shownFor.set(h, f.shown);
	}
	const keep = (m: MoveRow) => ({
		...m,
		figures: m.figures.filter((f) => !shownFor.has(f.id)),
		also: [] as string[]
	});
	const outMine = mine.map(keep);
	const outGroups = groups.map((g) => ({ team: g.team, moves: g.moves.map(keep) }));

	// The move each shown figure is in, to hang `also` on.
	const moveOf = new Map<number, MoveRow & { also: string[] }>();
	for (const m of [...outMine, ...outGroups.flatMap((g) => g.moves)]) {
		for (const f of m.figures) if (!moveOf.has(f.id)) moveOf.set(f.id, m);
	}
	groups.forEach((g, gi) => {
		g.moves.forEach((m, mi) => {
			if (outGroups[gi].moves[mi].figures.length > 0) return;
			for (const f of m.figures) {
				const into = moveOf.get(shownFor.get(f.id)!);
				if (into && !into.also.includes(g.team.name)) into.also.push(g.team.name);
			}
		});
	});

	return {
		mine: outMine.filter((m) => m.figures.length > 0),
		groups: outGroups
			.map((g) => ({ team: g.team, moves: g.moves.filter((m) => m.figures.length > 0) }))
			.filter((g) => g.moves.length > 0),
		twinOf
	};
}

/**
 * A flat list's rows (a picker's, the Lessons list's) with the person's twin
 * sets folded: one row per set, the one used, in the rows' order. Used: their own (`mineIds`) if they have one,
 * else the first by group name (`team`). `twins` names the ids folded behind
 * it; [] for a row with none.
 */
export function foldRows<T extends { id: number; team?: TeamRef | null }>(
	rows: T[],
	sets: number[][],
	mineIds: Set<number>
): (T & { twins: number[] })[] {
	const byId = new Map(rows.map((r) => [r.id, r]));
	const teamName = (id: number) => (mineIds.has(id) ? null : (byId.get(id)?.team?.name ?? ''));
	const behind = new Map<number, number[]>();
	const hidden = new Set<number>();
	for (const f of folds(sets, (id) => byId.has(id), teamName)) {
		behind.set(f.shown, [...(behind.get(f.shown) ?? []), ...f.hidden]);
		for (const h of f.hidden) hidden.add(h);
	}
	return rows
		.filter((r) => !hidden.has(r.id))
		.map((r) => ({ ...r, twins: behind.get(r.id) ?? [] }));
}

/** The picker name of `foldRows`. */
export const twinRows = foldRows;

/**
 * A list of the person's own rows followed by a section per group (Routines,
 * Music) with the twin sets folded: each set shows once, as the person's own
 * if they have one, else the first by group name; a group left with no rows
 * loses its section. `twinOf` maps a shown row to the twins hidden behind it
 * (the chip). Group mode folds nothing: its callers never ask.
 */
export function foldSections<R extends { id: number }>(
	mine: R[],
	groups: { team: TeamRef; rows: R[] }[],
	sets: number[][]
): { mine: R[]; groups: { team: TeamRef; rows: R[] }[]; twinOf: Map<number, number[]> } {
	// Where each row sits: -1 for the person's own, else its group's index.
	const where = new Map<number, number>();
	for (const r of mine) where.set(r.id, -1);
	groups.forEach((g, gi) => {
		for (const r of g.rows) if (!where.has(r.id)) where.set(r.id, gi);
	});
	const nameOf = (id: number) => {
		const gi = where.get(id)!;
		return gi === -1 ? null : groups[gi].team.name;
	};
	const twinOf = new Map<number, number[]>();
	const hidden = new Set<number>();
	for (const f of folds(sets, (id) => where.has(id), nameOf)) {
		twinOf.set(f.shown, [...(twinOf.get(f.shown) ?? []), ...f.hidden]);
		for (const h of f.hidden) hidden.add(h);
	}
	const keep = (r: R) => !hidden.has(r.id);
	return {
		mine: mine.filter(keep),
		groups: groups
			.map((g) => ({ team: g.team, rows: g.rows.filter(keep) }))
			.filter((g) => g.rows.length > 0),
		twinOf
	};
}

/**
 * Music's `foldSections`: only ready songs fold. A song still downloading
 * (or failed) sits under "Being added" and cannot stand for its twins, so it
 * never hides a ready twin; it shows as its own row until it is ready.
 */
export function foldSongs<R extends { id: number; status: string }>(
	mine: R[],
	groups: { team: TeamRef; rows: R[] }[],
	sets: number[][]
): { mine: R[]; groups: { team: TeamRef; rows: R[] }[]; twinOf: Map<number, number[]> } {
	const ready = new Set(
		[...mine, ...groups.flatMap((g) => g.rows)].filter((r) => r.status === 'ready').map((r) => r.id)
	);
	return foldSections(
		mine,
		groups,
		sets.map((set) => set.filter((id) => ready.has(id)))
	);
}

/**
 * A twinned picker row's meta: "Yours, twin of Salsa Tuesdays’ Básica · yours
 * is used"; without the person's own member, "Salsa Tuesdays’, twin of Rueda
 * club’s Doble · Salsa Tuesdays’ is used". `theirs` names the twins behind the
 * row as their places say them (`named`: "Salsa Tuesdays’ Básica"); when `mine`
 * is false, the first entry is the used row's group, by its name.
 */
export function twinUseMeta(theirs: string[], mine: boolean): string {
	return t().clones.twins.useMeta(theirs, mine);
}

/**
 * `twinUseMeta` for a row and the twins behind it: each twin named by its
 * place and its own name ("Salsa Tuesdays’ Básica"), or its label when it is
 * a variation of another move ("Rueda club’s Setenta · Doble").
 */
export function twinPickMeta(
	row: { figure: string | null; team?: TeamRef | null },
	twins: TwinNote[]
): string {
	const named = t().clones.twins.named;
	const names = twins.map((tw) => {
		// Routines, lessons and songs have no move above them: just the name.
		const what =
			row.figure === null || tw.figure === row.figure ? tw.name : `${tw.figure} · ${tw.name}`;
		return named(what, tw.team ? tw.team.name : null);
	});
	return row.team ? twinUseMeta([row.team.name, ...names], false) : twinUseMeta(names, true);
}
