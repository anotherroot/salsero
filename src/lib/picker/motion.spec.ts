import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Slot } from './preview';

/** A tile in a fake page: a place in list order, a box 70 px below the last one. */
class Tile {
	constructor(public i: number) {}
	compareDocumentPosition(o: Tile) {
		return this.i < o.i ? 4 : 2; // DOCUMENT_POSITION_FOLLOWING : PRECEDING
	}
	getBoundingClientRect() {
		return { left: 0, top: this.i * 70, width: 64, height: 64 };
	}
	contains(x: unknown) {
		return x === this;
	}
}

let notify: (entries: { target: Tile; isIntersecting: boolean }[]) => void;
/** What is on top at a point: the tile there, unless a sheet covers it. */
let coveredFrom = Infinity;
const sheet = { sheet: true };

beforeEach(() => {
	vi.useFakeTimers();
	vi.resetModules();
	coveredFrom = Infinity;
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(cb: typeof notify) {
				notify = cb;
			}
			observe() {}
			unobserve() {}
		}
	);
	vi.stubGlobal('Node', { DOCUMENT_POSITION_FOLLOWING: 4 });
	vi.stubGlobal('requestAnimationFrame', (f: () => void) => setTimeout(f, 0));
	vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
	vi.stubGlobal('navigator', { hardwareConcurrency: 8, deviceMemory: 8 });
	vi.stubGlobal('document', {
		addEventListener: () => {},
		elementFromPoint: (_x: number, y: number) =>
			y >= coveredFrom ? sheet : tiles.find((t) => y >= t.i * 70 && y < t.i * 70 + 64)
	});
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

let tiles: Tile[] = [];
async function mount(n: number) {
	const { playSlot } = await import('./motion');
	tiles = Array.from({ length: n }, (_, i) => new Tile(i));
	const state = new Map<number, Slot>();
	const undo = tiles.map((t) => playSlot((s) => state.set(t.i, s))(t as unknown as Element));
	notify(tiles.map((t) => ({ target: t, isIntersecting: true })));
	vi.advanceTimersByTime(1);
	const playing = () => [...state].filter(([, s]) => s === 'play').map(([i]) => i);
	return { undo, state, playing };
}

describe('which tiles play (review)', () => {
	it('the first four on screen', async () => {
		const { playing } = await mount(6);
		expect(playing()).toEqual([0, 1, 2, 3]);
	});

	it('a late notice for a tile already gone never brings it back to take a slot', async () => {
		const { undo, playing } = await mount(6);
		(undo[0] as () => void)();
		vi.advanceTimersByTime(1);
		notify([{ target: tiles[0], isIntersecting: true }]);
		vi.advanceTimersByTime(1);
		// Of the tiles still there, four play: a ghost of tile 0 would have taken one.
		expect(playing().filter((i) => i !== 0)).toEqual([1, 2, 3, 4]);
	});

	it('a tile under a sheet does not play; one that a sheet covers later stops within a second', async () => {
		coveredFrom = 140; // tiles 2 and up sit under the sheet
		const { playing } = await mount(6);
		expect(playing()).toEqual([0, 1]);
		coveredFrom = 0; // the sheet now covers everything
		vi.advanceTimersByTime(1000);
		expect(playing()).toEqual([]);
	});
});
