/**
 * The position sheet's model: what a tapped position lists (where you come
 * from, where you can step, what stays and what fits anywhere) and the trail
 * of steps taken from one position to the next. PURE and client-safe.
 */

import { edgeKey, type MapData, type MapFig, type MapTone } from './map-view';

/** Moves in first-seen order: "Move ×n" for several figures, the label for one; joined with " · ". */
export function figuresShort(figs: MapFig[]): string {
	const order: string[] = [];
	const byMove = new Map<string, MapFig[]>();
	for (const f of figs) {
		const list = byMove.get(f.move);
		if (list) list.push(f);
		else {
			byMove.set(f.move, [f]);
			order.push(f.move);
		}
	}
	return order
		.map((m) => {
			const list = byMove.get(m)!;
			return list.length > 1 ? `${m} ×${list.length}` : list[0].label;
		})
		.join(' · ');
}

export interface PositionSheet {
	id: number;
	name: string;
	ins: number;
	outs: number;
	/** The loop's figures. */
	stays: MapFig[];
	/** Positions with an arrow into this one, most figures first. */
	from: { id: number; name: string }[];
	stepTo: { id: number; name: string; tone: MapTone; figs: MapFig[]; short: string }[];
	anywhere: MapFig[];
}

const byCountThenName = (
	a: { figs: MapFig[]; name: string },
	b: { figs: MapFig[]; name: string }
) => b.figs.length - a.figs.length || a.name.localeCompare(b.name, 'en');

/** Null for an id that is not drawn (an island, unused or unknown). */
export function positionSheet(data: MapData, id: number): PositionSheet | null {
	if (!data.layout.nodes.some((n) => n.id === id)) return null;
	const p = data.positions.find((q) => q.id === id);
	if (!p) return null;
	const named = (pid: number) => data.positions.find((q) => q.id === pid);

	const stays = data.edges.find((e) => e.from === id && e.to === id)?.figs ?? [];

	const stepTo: PositionSheet['stepTo'] = [];
	for (const e of data.edges) {
		if (e.from !== id || e.to === id) continue;
		const q = named(e.to);
		if (!q) continue;
		stepTo.push({
			id: q.id,
			name: q.name,
			tone: q.tone,
			figs: e.figs,
			short: figuresShort(e.figs)
		});
	}
	stepTo.sort(byCountThenName);

	const from: { id: number; name: string; figs: MapFig[] }[] = [];
	for (const e of data.edges) {
		if (e.to !== id || e.from === id) continue;
		const q = named(e.from);
		if (q) from.push({ id: q.id, name: q.name, figs: e.figs });
	}
	from.sort(byCountThenName);

	return {
		id,
		name: p.name,
		ins: p.ins,
		outs: p.outs,
		stays,
		from: from.map(({ id: i, name }) => ({ id: i, name })),
		stepTo,
		anywhere: data.anyFrom.find((a) => a.from === id)?.figs ?? []
	};
}

export interface Trail {
	picked: number | null;
	back: number[];
}

/** A step (back gains the old pick) when id is one of picked's stepTo, else a fresh pick. */
export function pick(t: Trail, id: number, data: MapData): Trail {
	if (t.picked !== null && t.picked !== id) {
		const s = positionSheet(data, t.picked);
		if (s?.stepTo.some((r) => r.id === id)) return { picked: id, back: [...t.back, t.picked] };
	}
	return { picked: id, back: [] };
}

export function stepBack(t: Trail): Trail {
	if (t.back.length === 0) return t;
	return { picked: t.back[t.back.length - 1], back: t.back.slice(0, -1) };
}

/** The edge just stepped along: back's last to picked. */
export function steppedKey(t: Trail): string | null {
	if (t.picked === null || t.back.length === 0) return null;
	return edgeKey({ from: t.back[t.back.length - 1], to: t.picked });
}
