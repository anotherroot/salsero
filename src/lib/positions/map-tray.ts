/**
 * The map's tray at rest: one chip per thing the map can't show on its own.
 * PURE and client-safe; `MapTray.svelte` draws them.
 */

import type { MapData, MapTone } from './map-view';

export type TrayChip =
	/** "N nothing gets to": picks the first such position on the map. */
	| { kind: 'orphans'; count: number; pick: number }
	/** "N dead ends": the same. */
	| { kind: 'deadEnds'; count: number; pick: number }
	/** "N unused" (positions with no figures, not on the map): opens the first one. */
	| { kind: 'unused'; count: number; open: number }
	/** "N with no position": a link to No position. */
	| { kind: 'noPosition'; count: number }
	/** One island: a link to it. */
	| { kind: 'island'; id: number; name: string; tone: MapTone };

/**
 * The chips in order: nothing gets to, dead ends, unused, no position, then
 * one per island. "The first" is by name, the order `layoutMap` keeps nodes
 * and the tray in. Group mode has no gap chips: the gap report is the
 * person's own.
 */
export function trayChips(map: MapData): TrayChip[] {
	const chips: TrayChip[] = [];
	if (!map.inGroupMode) {
		const orphans = map.layout.nodes.filter((n) => n.mark === 'orphan');
		const deadEnds = map.layout.nodes.filter((n) => n.mark === 'dead end');
		if (orphans.length > 0)
			chips.push({ kind: 'orphans', count: orphans.length, pick: orphans[0].id });
		if (deadEnds.length > 0)
			chips.push({ kind: 'deadEnds', count: deadEnds.length, pick: deadEnds[0].id });
	}
	const unused = map.layout.tray.unused;
	if (unused.length > 0) chips.push({ kind: 'unused', count: unused.length, open: unused[0] });
	if (map.noPosition > 0) chips.push({ kind: 'noPosition', count: map.noPosition });
	const byId = new Map(map.positions.map((p) => [p.id, p]));
	for (const id of map.layout.tray.islands) {
		const p = byId.get(id);
		if (p) chips.push({ kind: 'island', id, name: p.name, tone: p.tone });
	}
	return chips;
}
