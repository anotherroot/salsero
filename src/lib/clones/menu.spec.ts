import { describe, expect, it } from 'vitest';
import { cloneMenuItems, type CloneSheet } from './menu';
import type { CopyOffer, DetachOffer, DropOptions, MoveOffer, TwinOffer } from '$lib/types';

const COPY: CopyOffer = { kind: 'position', title: 'Cerrada', fromMine: true, targets: [] };
const DETACH: DetachOffer = { place: 'Sreda 17:30', group: false };
const DROP: DropOptions = {
	kind: 'position',
	choices: [],
	preselected: 0,
	onlyInMine: [],
	sendable: []
};
const TWIN: TwinOffer = { kind: 'position', title: 'Cerrada', candidates: [] };
const MOVE: MoveOffer = { title: 'Week 3', targets: [] };

describe('cloneMenuItems', () => {
	it('offers each copy action exactly when its offer is set, in order', () => {
		const items = cloneMenuItems(
			{ copy: COPY, sameAs: null, move: null, detach: DETACH, drop: DROP },
			() => {}
		);
		expect(items.map((i) => i.key)).toEqual(['copy', 'detach', 'drop']);
		expect(items.map((i) => i.label)).toEqual(['Copy to…', 'Detach', 'Drop my copy']);
		expect(items.find((i) => i.key === 'drop')?.danger).toBe(true);
		expect(items.filter((i) => i.danger).map((i) => i.key)).toEqual(['drop']);
	});

	it('orders all five as the button row did', () => {
		const items = cloneMenuItems(
			{ copy: COPY, sameAs: TWIN, move: MOVE, detach: DETACH, drop: DROP },
			() => {}
		);
		expect(items.map((i) => i.key)).toEqual(['copy', 'sameAs', 'move', 'detach', 'drop']);
		expect(items.map((i) => i.icon)).toEqual(['copy', 'link', 'move-to', 'unlink', 'undo']);
	});

	it('opens its sheet', () => {
		const opened: CloneSheet[] = [];
		cloneMenuItems({ sameAs: TWIN }, (s) => opened.push(s))[0].onclick?.();
		expect(opened).toEqual(['sameAs']);
	});

	it('no offers, no items', () => {
		expect(cloneMenuItems({}, () => {})).toEqual([]);
	});
});
