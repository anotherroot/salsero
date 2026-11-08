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
import type { Graph } from '$lib/graph/graph';
import { loops, type RoutineShape } from './routines';
import { t } from '$lib/i18n/catalog';

export interface CoverageRow {
	id: number;
	label: string;
	/** The place of the copy's source when the viewer reads it; drawn beside a same label. */
	from?: string | null;
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
	versions: { id: number; label: string; from?: string | null }[],
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
		.map((v) => ({
			id: v.id,
			label: v.label,
			from: v.from ?? null,
			routines: byVersion.get(v.id) ?? []
		}))
		.sort((a, b) => a.routines.length - b.routines.length || a.label.localeCompare(b.label));
}

export function coverageGroups(rows: CoverageRow[]): CoverageGroup[] {
	const w = t().moves.coverage;
	const groups: CoverageGroup[] = [
		{ key: 'none', title: w.none, rows: rows.filter((r) => r.routines.length === 0) },
		{ key: 'one', title: w.one, rows: rows.filter((r) => r.routines.length === 1) },
		{ key: 'many', title: w.many, rows: rows.filter((r) => r.routines.length >= 2) }
	];
	return groups.filter((g) => g.rows.length > 0);
}

export interface RoutineUse {
	id: number;
	name: string;
	/** 1-based positions among the routine's own top-level slots, ascending. */
	slots: number[];
	slotCount: number;
	loops: boolean;
}

/**
 * The routines that call one version, and at which of their slots — the figure
 * page's "In routines". An embedded routine's slot counts as the embedding
 * slot's position. Derived per request, never stored.
 */
export function routinesUsing(
	g: Graph,
	versionId: number,
	shapes: Map<number, RoutineShape>,
	routines: { id: number; name: string }[]
): RoutineUse[] {
	const out: RoutineUse[] = [];
	for (const r of routines) {
		const shape = shapes.get(r.id);
		if (!shape) continue;
		const slots: number[] = [];
		shape.slots.forEach((slot, i) => {
			const options = slot.kind === 'options' ? [slot] : slot.slots;
			if (options.some((o) => o.figureIds.includes(versionId))) slots.push(i + 1);
		});
		if (slots.length === 0) continue;
		out.push({
			id: r.id,
			name: r.name,
			slots,
			slotCount: shape.slots.length,
			loops: loops(g, shape)
		});
	}
	return out.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}
