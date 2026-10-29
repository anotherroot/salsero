import { describe, expect, it } from 'vitest';
import {
	doneTarget,
	editStack,
	levelOf,
	loopOf,
	openingStack,
	prune,
	sheetOf,
	type Stack
} from './screens';

const full = { kind: 'full' } as const;
const section = (spotId: number) => ({ kind: 'section', spotId }) as const;
const edit = (spotId: number) => ({ kind: 'edit', spotId }) as const;
const spots = [
	{ id: 4, endMs: 9000 },
	{ id: 5, endMs: null }
];

describe('openingStack', () => {
	it('is the full video, or a section above it', () => {
		expect(openingStack()).toEqual([full]);
		expect(openingStack(4)).toEqual([full, section(4)]);
	});
});

describe('levelOf and sheetOf', () => {
	const s: Stack = [full, section(4), { kind: 'sheet', sheet: 'delete' }];
	it('see through a sheet to the level under it', () => {
		expect(levelOf(s)).toEqual(section(4));
		expect(sheetOf(s)).toBe('delete');
	});
	it('report no sheet when none is open', () => {
		expect(sheetOf([full])).toBeNull();
		expect(levelOf([full])).toEqual(full);
	});
});

describe('doneTarget', () => {
	it('pops back to a section view directly below', () => {
		expect(doneTarget([full, section(4), edit(4)], { id: 4, endMs: 9000 })).toBe('pop');
	});
	it('turns a section editor opened from the full video into its section view', () => {
		expect(doneTarget([full, edit(4)], { id: 4, endMs: 9000 })).toEqual(section(4));
	});
	it('pops a point back to the full video', () => {
		expect(doneTarget([full, edit(5)], { id: 5, endMs: null })).toBe('pop');
	});
});

describe('loopOf', () => {
	it('is nothing at the full video', () => {
		expect(loopOf([full], spots, false)).toBeNull();
	});
	it('is the open section, in its view and its editor', () => {
		expect(loopOf([full, section(4)], spots, false)).toBe(spots[0]);
		expect(loopOf([full, section(4), edit(4)], spots, false)).toBe(spots[0]);
	});
	it('pauses only in the editor', () => {
		expect(loopOf([full, section(4), edit(4)], spots, true)).toBeNull();
	});
	it('is nothing for a point', () => {
		expect(loopOf([full, edit(5)], spots, false)).toBeNull();
	});
	it('keeps looping under a sheet', () => {
		expect(loopOf([full, section(4), { kind: 'sheet', sheet: 'rename' }], spots, false)).toBe(
			spots[0]
		);
	});
});

describe('prune', () => {
	it('drops every screen from the first whose spot is gone', () => {
		expect(prune([full, section(4), edit(4)], [{ id: 5 }])).toEqual([full]);
	});
	it('is the same stack when nothing is missing', () => {
		const s: Stack = [full, section(4), edit(4)];
		expect(prune(s, [{ id: 4 }])).toBe(s);
	});
});

describe('the list panel', () => {
	it('is a sheet over the full video', () => {
		const s: Stack = [full, { kind: 'sheet', sheet: 'list' }];
		expect(sheetOf(s)).toBe('list');
		expect(levelOf(s)).toEqual(full);
	});
});

describe('editStack', () => {
	const F = { kind: 'full' } as const;
	const sec = (id: number) => ({ kind: 'section', spotId: id }) as const;
	const ed = (id: number) => ({ kind: 'edit', spotId: id }) as const;
	const list = { kind: 'sheet', sheet: 'list' } as const;

	it('opens over the full video', () => {
		expect(editStack([F], 7)).toEqual([F, ed(7)]);
		expect(editStack([F, list], 7)).toEqual([F, ed(7)]);
	});
	it('opens over its own section view, so Done pops back to it', () => {
		expect(editStack([F, sec(7)], 7)).toEqual([F, sec(7), ed(7)]);
	});
	it('drops a sheet open over its own section view', () => {
		expect(editStack([F, sec(7), list], 7)).toEqual([F, sec(7), ed(7)]);
	});
	it('drops another section view', () => {
		expect(editStack([F, sec(3), list], 7)).toEqual([F, ed(7)]);
		expect(editStack([F, sec(3)], 7)).toEqual([F, ed(7)]);
	});
});

describe('loopOf while arriving', () => {
	const a = { id: 1, endMs: 5000 };
	const b = { id: 2, endMs: 9000 };
	const p = { id: 3, endMs: null };
	const stack = [{ kind: 'full' }, { kind: 'section', spotId: 1 }] as const;
	it('loops the screen on its way, not the one still on the stack', () => {
		expect(loopOf(stack, [a, b, p], false, { kind: 'section', spotId: 2 })).toBe(b);
		expect(loopOf(stack, [a, b, p], false, { kind: 'edit', spotId: 3 })).toBeNull();
	});
	it('is the stack when nothing is on its way', () => {
		expect(loopOf(stack, [a, b, p], false, null)).toBe(a);
	});
});
