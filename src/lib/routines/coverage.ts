/**
 * Which routines can call each figure version — the coverage page.
 *
 * PURE and client-safe. A version is covered by a routine when it is an option
 * in any of that routine's slots, its embedded routine's slots included, so a
 * figure in an embedded "Combo A" counts for Combo A and for every routine
 * that embeds it. Base figure and variation are counted apart: each is the
 * exact id in a slot.
 *
 * Only the routines passed in count. The caller passes the live ones
 * (`listRoutines` excludes archived), so `shapes` may safely hold more.
 */
import type { RoutineShape } from './routines';

export interface CoverageRow {
	id: number;
	label: string;
	/** Alphabetical by name. */
	routines: { id: number; name: string }[];
}

export interface CoverageGroup {
	key: 'none' | 'one' | 'many';
	title: string;
	rows: CoverageRow[];
}

function idsIn(shape: RoutineShape): Set<number> {
	const ids = new Set<number>();
	for (const slot of shape.slots) {
		const options = slot.kind === 'options' ? [slot] : slot.slots;
		for (const o of options) for (const id of o.figureIds) ids.add(id);
	}
	return ids;
}

export function coverage(
	versions: { id: number; label: string }[],
	shapes: Map<number, RoutineShape>,
	routines: { id: number; name: string }[]
): CoverageRow[] {
	const byVersion = new Map<number, { id: number; name: string }[]>();
	for (const r of [...routines].sort((a, b) => a.name.localeCompare(b.name))) {
		const shape = shapes.get(r.id);
		if (!shape) continue;
		for (const id of idsIn(shape)) {
			const list = byVersion.get(id) ?? [];
			list.push({ id: r.id, name: r.name });
			byVersion.set(id, list);
		}
	}
	return versions
		.map((v) => ({ id: v.id, label: v.label, routines: byVersion.get(v.id) ?? [] }))
		.sort((a, b) => a.routines.length - b.routines.length || a.label.localeCompare(b.label));
}

export function coverageGroups(rows: CoverageRow[]): CoverageGroup[] {
	const groups: CoverageGroup[] = [
		{ key: 'none', title: 'In no routine', rows: rows.filter((r) => r.routines.length === 0) },
		{ key: 'one', title: 'In 1 routine', rows: rows.filter((r) => r.routines.length === 1) },
		{ key: 'many', title: 'In 2+ routines', rows: rows.filter((r) => r.routines.length >= 2) }
	];
	return groups.filter((g) => g.rows.length > 0);
}
