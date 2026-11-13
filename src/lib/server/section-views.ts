/**
 * What the routine editor draws for the sections and routines its slots hold,
 * opened in place (spec 2026-11-12, routine sections): every child at any
 * depth, its size, how many routines share it, and its rows ready to draw.
 */
import type { Db } from './db';
import type { Graph } from '$lib/graph/graph';
import { routineSize, rowEdgesIn, type RoutineShape } from '$lib/routines/routines';
import { getRoutine, routineSlots } from './routines';
import { routinesHolding } from './sections';
import type { Usable } from './usable';
import type { ChildView } from '$lib/types';

export function childViews(
	db: Db,
	dance: string,
	graph: Graph,
	shapes: Map<number, RoutineShape>,
	rootChildIds: number[],
	label: (figureId: number) => string,
	usable?: Usable
): Record<number, ChildView> {
	const out: Record<number, ChildView> = {};
	const posName = (id: number) => graph.positions.find((p) => p.id === id)?.name ?? null;
	const queue = [...new Set(rootChildIds)];
	while (queue.length > 0) {
		const id = queue.shift()!;
		if (out[id]) continue;
		const routine = getRoutine(db, id);
		if (!routine) continue;
		const shape = shapes.get(id) ?? { slots: [] };
		const edges = rowEdgesIn(graph, shape);
		const slots = routineSlots(db, id, usable);
		out[id] = {
			id,
			name: routine.name,
			isSection: routine.isSection === 1,
			...routineSize(graph, shape),
			holders: routinesHolding(db, id, routine).length,
			rows: slots.map((s, i) => {
				const e = edges[i];
				const counts =
					e && e.startCounts.length > 0 && e.next !== null ? `${e.startCounts[0]}→${e.next}` : '';
				const end = e?.ends && e.ends.length > 0 ? posName(e.ends[0]) : null;
				const meta = [counts, end ? `⇥ ${end}` : ''].filter(Boolean).join(' · ');
				if (s.childId !== null) {
					queue.push(s.childId);
					const child = getRoutine(db, s.childId);
					return {
						id: s.id,
						childId: s.childId,
						title: child?.name ?? '',
						meta,
						href: `/${dance}/routines/${s.childId}?from=${s.id}`
					};
				}
				const main = s.figureIds[0];
				return {
					id: s.id,
					childId: null,
					title: main === undefined ? '' : label(main),
					meta,
					href: main === undefined ? null : `/${dance}/figures/${main}`
				};
			})
		};
	}
	return out;
}
