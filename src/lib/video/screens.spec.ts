import { describe, expect, it } from 'vitest';
import { doneTarget, levelOf, loopOf, openingStack, prune, sheetOf, type Stack } from './screens';

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
