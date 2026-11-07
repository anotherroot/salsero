import { describe, expect, it } from 'vitest';
import type { FieldDiff, Flat } from '$lib/types';
import { fieldLabel } from './flat';
import {
	allows,
	changedKeys,
	classOf,
	DEFAULT_SYNC,
	flowKeys,
	holdLinkRemovals,
	suffixOnly
} from './sync';

const h = (v: string) => `h(${v})`;

function flat(...fields: [string, string][]): Flat {
	const out: Flat = {};
	for (const [key, value] of fields)
		out[key] = { key, value, show: value, label: fieldLabel(key, value) };
	return out;
}

function d(key: string, mine: string | null, theirs: string | null, side: FieldDiff['side']) {
	const f = (v: string | null) => (v === null ? null : { key, value: v, show: v, label: key });
	const removal = side === 'theirs' ? theirs === null : side === 'mine' ? mine === null : false;
	return { key, label: key, mine: f(mine), theirs: f(theirs), side, removal } as FieldDiff;
}

describe('classOf', () => {
	it('classes keys', () => {
		expect(classOf('name', false)).toBe('name');
		expect(classOf('title', false)).toBe('name');
		expect(classOf('notes', false)).toBe('always');
		expect(classOf('link:https://x', false)).toBe('always');
		expect(classOf('link:https://x', true)).toBe('small');
		expect(classOf('start:g1', true)).toBe('small');
		expect(classOf('rec:g2:spot:s1:links', true)).toBe('small');
		expect(classOf('rec:g2:spot:s1', false)).toBe('sections');
		expect(classOf('video:g3:spot:s1', true)).toBe('sections');
		expect(classOf('rec:g2', false)).toBe('media');
		expect(classOf('rec:g2:note', false)).toBe('always');
	});
});

describe('allows', () => {
	it('defaults carry names and small removals, not sections or media', () => {
		expect(allows(DEFAULT_SYNC, 'name', false)).toBe(true);
		expect(allows(DEFAULT_SYNC, 'link:a', true)).toBe(true);
		expect(allows(DEFAULT_SYNC, 'rec:g:spot:s', false)).toBe(false);
		expect(allows(DEFAULT_SYNC, 'video:g', true)).toBe(false);
		expect(allows({ ...DEFAULT_SYNC, on: false }, 'notes', false)).toBe(false);
	});
	it('each option opens its own class', () => {
		const off = { ...DEFAULT_SYNC, names: false, small: false };
		expect(allows(off, 'name', false)).toBe(false);
		expect(allows(off, 'link:a', true)).toBe(false);
		expect(allows({ ...DEFAULT_SYNC, sections: true }, 'rec:g:spot:s', false)).toBe(true);
		expect(allows({ ...DEFAULT_SYNC, media: true }, 'video:g', true)).toBe(true);
	});
});

describe('changedKeys', () => {
	it('none without a mark; keys whose hash moved, added or gone', () => {
		const mark = { notes: h('a'), timing: h('8'), gone: h('x') };
		const f = flat(['notes', 'b'], ['timing', '8'], ['link:x', '1']);
		expect(changedKeys(mark, f, h)).toEqual(['gone', 'link:x', 'notes']);
		expect(changedKeys(null, f, h)).toEqual([]);
	});
});

describe('flowKeys', () => {
	it('takes only what this save changed and the receiver did not', () => {
		const pair = [
			d('notes', 'a', 'b', 'theirs'),
			d('timing', '8', '16', 'both'),
			d('partner', 'x', 'y', 'theirs')
		];
		expect(flowKeys(['notes', 'timing'], pair, DEFAULT_SYNC)).toEqual(['notes']);
	});
	it('respects the receiver settings and removals', () => {
		const pair = [d('link:u', '1', null, 'theirs'), d('rec:g', '1', null, 'theirs')];
		expect(flowKeys(['link:u', 'rec:g'], pair, DEFAULT_SYNC)).toEqual(['link:u']);
		expect(flowKeys(['link:u', 'rec:g'], pair, { ...DEFAULT_SYNC, small: false })).toEqual([]);
		expect(flowKeys(['link:u'], pair, { ...DEFAULT_SYNC, on: false })).toEqual([]);
	});
	it('a name differing only by a copy suffix never flows', () => {
		const pair = [d('name', 'Basic (Sreda 17:30)', 'Basic', 'theirs')];
		expect(suffixOnly(pair[0])).toBe(true);
		expect(flowKeys(['name'], pair, DEFAULT_SYNC)).toEqual([]);
		const real = [d('name', 'Basic', 'Basic step', 'theirs')];
		expect(suffixOnly(real[0])).toBe(false);
		expect(flowKeys(['name'], real, DEFAULT_SYNC)).toEqual(['name']);
	});
});

describe('holdLinkRemovals', () => {
	// A saved video: in one save the link goes and the recording (or lesson video) arrives.
	const became = (piece: string) => [
		d('link:https://youtu.be/x', '1', null, 'theirs'),
		d(piece, null, 'video/mp4|1', 'theirs'),
		d('link:https://other', '1', null, 'theirs')
	];
	const saved = (piece: string) => ['link:https://youtu.be/x', piece, 'link:https://other'];

	it("holds back the save's link removals when a new piece it brings is refused", () => {
		for (const piece of ['rec:g1', 'video:g2']) {
			expect(holdLinkRemovals(saved(piece), became(piece), DEFAULT_SYNC)).toEqual([
				'link:https://youtu.be/x',
				'link:https://other'
			]);
			expect(flowKeys(saved(piece), became(piece), DEFAULT_SYNC)).toEqual([]);
		}
	});
	it('holds nothing when the receiver takes the piece', () => {
		const media = { ...DEFAULT_SYNC, media: true };
		expect(holdLinkRemovals(saved('rec:g1'), became('rec:g1'), media)).toEqual([]);
		expect(flowKeys(saved('rec:g1'), became('rec:g1'), media)).toEqual([
			'link:https://youtu.be/x',
			'rec:g1',
			'link:https://other'
		]);
	});
	it('holds nothing without a refused new piece in this save', () => {
		const pair = became('rec:g1');
		// The recording is not this save's change (or is not new on the giver's side).
		expect(holdLinkRemovals(['link:https://youtu.be/x'], pair, DEFAULT_SYNC)).toEqual([]);
		const gone = [
			d('link:https://youtu.be/x', '1', null, 'theirs'),
			d('rec:g1', '1', null, 'theirs')
		];
		expect(holdLinkRemovals(['link:https://youtu.be/x', 'rec:g1'], gone, DEFAULT_SYNC)).toEqual([]);
		// Other removals are not held: only links.
		const tag = [d('start:p', '1', null, 'theirs'), d('rec:g1', null, 'v', 'theirs')];
		expect(holdLinkRemovals(['start:p', 'rec:g1'], tag, DEFAULT_SYNC)).toEqual([]);
		expect(flowKeys(['start:p', 'rec:g1'], tag, DEFAULT_SYNC)).toEqual(['start:p']);
	});
});
