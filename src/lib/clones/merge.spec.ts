import { describe, expect, it } from 'vitest';
import type { Flat, MergeRow, PairBase } from '$lib/types';
import { initialBase } from './diff';
import { fieldLabel } from './flat';
import { mergeRows, mergeTargets, unresolved, type MergePair } from './merge';
import { DEFAULT_SYNC } from './sync';

const hash = (v: string) => `h(${v})`;

/** A Flat from [key, value] pairs; labels come from `fieldLabel`. */
function flat(...fields: [string, string][]): Flat {
	const out: Flat = {};
	for (const [key, value] of fields)
		out[key] = { key, value, show: value, label: fieldLabel(key, value) };
	return out;
}

/** `f` with some keys changed (value) or gone (null). */
function edit(f: Flat, changes: Record<string, string | null>): Flat {
	const out: Flat = { ...f };
	for (const [key, value] of Object.entries(changes)) {
		if (value === null) delete out[key];
		else out[key] = { key, value, show: value, label: fieldLabel(key, value) };
	}
	return out;
}

const T = 1; // the teacher's own copy: the page
const G1 = 2; // Salsa Tuesdays' copy
const G2 = 3; // Sreda 17:30's copy

/** What all three held when T was copied into both clubs. */
const ORIGIN = flat(
	['name', 'Basic'],
	['notes', 'n0'],
	['partner', 'p0'],
	['timing', 't0'],
	['link:https://a', '1'],
	['rec:r1', 'video|100'],
	['rec:r1:note', 'note0'],
	['rec:r1:spot:s1', '0|1000|Turn']
);

const base = (f: Flat = ORIGIN, skip: string[] = []): PairBase => initialBase(f, skip, hash);

/** T–G1 and T–G2 in step at the origin; G1 and G2 never directly. */
const PAIRS: MergePair[] = [
	{ a: T, b: G1, at: 10, base: base() },
	{ a: T, b: G2, at: 20, base: base() }
];

function rows(t: Flat, g1: Flat, g2: Flat, pairs = PAIRS, page = DEFAULT_SYNC): MergeRow[] {
	const members = [
		{ id: T, flat: t },
		{ id: G1, flat: g1 },
		{ id: G2, flat: g2 }
	];
	return mergeRows(members, pairs, hash, page);
}

const row = (rs: MergeRow[], key: string) => rs.find((r) => r.key === key);

describe('mergeRows', () => {
	it('copies that agree have no rows', () => {
		expect(rows(ORIGIN, ORIGIN, ORIGIN)).toEqual([]);
	});

	it('a field only G1 changed starts on G1’s value', () => {
		const rs = rows(ORIGIN, edit(ORIGIN, { timing: 't1' }), ORIGIN);
		expect(rs).toEqual([
			{
				key: 'timing',
				label: 'Timing',
				kind: 'field',
				pick: 'h(t1)',
				values: [
					{ hash: 'h(t0)', field: ORIGIN.timing, holders: [T, G2], changed: false },
					{
						hash: 'h(t1)',
						field: edit(ORIGIN, { timing: 't1' }).timing,
						holders: [G1],
						changed: true
					}
				]
			}
		]);
	});

	it('a field only the page changed starts on the page’s value', () => {
		const rs = rows(edit(ORIGIN, { notes: 'n1' }), ORIGIN, ORIGIN);
		expect(rs.map((r) => [r.key, r.pick, r.kind])).toEqual([['notes', 'h(n1)', 'field']]);
		expect(row(rs, 'notes')!.values.map((v) => [v.holders, v.changed])).toEqual([
			[[T], true],
			[[G1, G2], false]
		]);
	});

	it('two copies that changed a field differently leave it open', () => {
		const rs = rows(ORIGIN, edit(ORIGIN, { partner: 'p1' }), edit(ORIGIN, { partner: 'p2' }));
		const r = row(rs, 'partner')!;
		expect(r.pick).toBeUndefined();
		expect(r.kind).toBe('field');
		expect(r.values.map((v) => [v.hash, v.changed])).toEqual([
			['h(p0)', false],
			['h(p1)', true],
			['h(p2)', true]
		]);
	});

	it('two copies never in step that differ are open', () => {
		const rs = mergeRows(
			[
				{ id: T, flat: ORIGIN },
				{ id: G1, flat: edit(ORIGIN, { timing: 't1' }) }
			],
			[],
			hash,
			DEFAULT_SYNC
		);
		expect(rs.map((r) => [r.key, r.pick])).toEqual([['timing', undefined]]);
		expect(rs[0].values.every((v) => !v.changed)).toBe(true);
	});

	it('a key the pair left out (skip) is not agreed by that pair: open', () => {
		// T and G2 agree; T–G1's snapshot skipped the recording, so G1's note is unknown.
		const pairs: MergePair[] = [
			{ a: T, b: G1, at: 10, base: base(ORIGIN, ['rec:r1']) },
			{ a: T, b: G2, at: 20, base: base() }
		];
		const rs = rows(ORIGIN, edit(ORIGIN, { 'rec:r1:note': 'other' }), ORIGIN, pairs);
		expect(rs.map((r) => [r.key, r.pick])).toEqual([['rec:r1:note', undefined]]);
	});

	it('a key held by one copy with no snapshot at all is open', () => {
		const g3 = edit(ORIGIN, { 'link:https://z': '1' });
		const rs = mergeRows(
			[
				{ id: T, flat: ORIGIN },
				{ id: G1, flat: ORIGIN },
				{ id: G2, flat: ORIGIN },
				{ id: 4, flat: g3 }
			],
			PAIRS,
			hash,
			DEFAULT_SYNC
		);
		expect(rs.map((r) => [r.key, r.pick, r.kind])).toEqual([
			['link:https://z', undefined, 'field']
		]);
		// One copy changed it, but a copy with no snapshot holds a third value: still open.
		const rs2 = mergeRows(
			[
				{ id: T, flat: ORIGIN },
				{ id: G1, flat: edit(ORIGIN, { timing: 't1' }) },
				{ id: G2, flat: ORIGIN },
				{ id: 4, flat: edit(ORIGIN, { timing: 't9' }) }
			],
			PAIRS,
			hash,
			DEFAULT_SYNC
		);
		expect(rs2.map((r) => [r.key, r.pick])).toEqual([['timing', undefined]]);
	});

	it('a copy only behind another is not a change, even when its pair is older', () => {
		// T changed timing and synced with G2 only (a later snapshot); G1 is just behind.
		const t1 = edit(ORIGIN, { timing: 't1' });
		const pairs: MergePair[] = [
			{ a: T, b: G1, at: 10, base: base() },
			{ a: T, b: G2, at: 20, base: base(t1) }
		];
		const rs = rows(t1, ORIGIN, t1, pairs);
		expect(rs.map((r) => [r.key, r.pick])).toEqual([['timing', 'h(t1)']]);
	});

	it('a piece the page added is an add, ticked when the page carries media', () => {
		const t = edit(ORIGIN, { 'rec:r2': 'video|200', 'rec:r2:spot:s9': '0|5|Hi' });
		const on = rows(t, ORIGIN, ORIGIN, PAIRS, { ...DEFAULT_SYNC, media: true });
		// The piece goes whole: its section is not a row of its own.
		expect(on.map((r) => [r.key, r.kind, r.pick])).toEqual([['rec:r2', 'add', 'h(video|200)']]);
		const off = rows(t, ORIGIN, ORIGIN);
		expect(off.map((r) => [r.key, r.kind, r.pick])).toEqual([['rec:r2', 'add', null]]);
	});

	it('a section added starts ticked only with sections on; a link always', () => {
		const t = edit(ORIGIN, { 'rec:r1:spot:s2': '5|9|Dip', 'link:https://b': '1' });
		const off = rows(t, ORIGIN, ORIGIN);
		expect(off.map((r) => [r.key, r.kind, r.pick])).toEqual([
			['link:https://b', 'add', 'h(1)'],
			['rec:r1:spot:s2', 'add', null]
		]);
		const on = rows(t, ORIGIN, ORIGIN, PAIRS, { ...DEFAULT_SYNC, sections: true });
		expect(row(on, 'rec:r1:spot:s2')!.pick).toBe('h(5|9|Dip)');
	});

	it('a removal is a remove row that starts on keep', () => {
		const rs = rows(ORIGIN, edit(ORIGIN, { 'link:https://a': null }), ORIGIN);
		expect(rs).toEqual([
			{
				key: 'link:https://a',
				label: 'Link · 1',
				kind: 'remove',
				pick: 'h(1)',
				values: [
					{ hash: 'h(1)', field: ORIGIN['link:https://a'], holders: [T, G2], changed: false },
					{ hash: null, field: null, holders: [G1], changed: true }
				]
			}
		]);
	});

	it('a piece missing on one copy is one row; its parts are not listed', () => {
		const rs = rows(
			edit(ORIGIN, { 'rec:r1:note': 'note1' }),
			edit(ORIGIN, { 'rec:r1': null, 'rec:r1:note': null, 'rec:r1:spot:s1': null }),
			ORIGIN
		);
		expect(rs.map((r) => [r.key, r.kind, r.pick])).toEqual([['rec:r1', 'remove', 'h(video|100)']]);
	});

	it('two copies that changed a field to the same value: one change, held by both', () => {
		const t1 = edit(ORIGIN, { timing: 't1' });
		const r = row(rows(ORIGIN, t1, t1), 'timing')!;
		expect(r.pick).toBe('h(t1)');
		expect(r.values.map((v) => [v.hash, v.holders, v.changed])).toEqual([
			['h(t0)', [T], false],
			['h(t1)', [G1, G2], true]
		]);
	});

	it('a section renamed beside a copy without it adds nowhere unless sections are on', () => {
		// T renamed s1; G2 never got s1 (in step without it).
		const t = edit(ORIGIN, { 'rec:r1:spot:s1': '0|1000|Spin' });
		const g2 = edit(ORIGIN, { 'rec:r1:spot:s1': null });
		const pairs: MergePair[] = [
			{ a: T, b: G1, at: 10, base: base() },
			{ a: T, b: G2, at: 20, base: base(g2) }
		];
		const off = rows(t, ORIGIN, g2, pairs);
		expect(off.map((r) => [r.key, r.kind, r.pick])).toEqual([
			['rec:r1:spot:s1', 'field', undefined]
		]);
		expect(
			mergeTargets(
				off,
				{},
				new Map([
					[T, t],
					[G1, ORIGIN],
					[G2, g2]
				])
			)
		).toEqual(new Map());
		const on = rows(t, ORIGIN, g2, pairs, { ...DEFAULT_SYNC, sections: true });
		expect(row(on, 'rec:r1:spot:s1')!.pick).toBe('h(0|1000|Spin)');
	});

	it('a removal beside two different present values never starts on removing', () => {
		// T removed r1; G1 and G2 hold it with different presence values. Media on or off.
		const t = edit(ORIGIN, { 'rec:r1': null, 'rec:r1:note': null, 'rec:r1:spot:s1': null });
		const g2 = edit(ORIGIN, { 'rec:r1': 'video|150' });
		const pairs: MergePair[] = [
			{ a: T, b: G1, at: 10, base: base() },
			{ a: T, b: G2, at: 20, base: base(g2) }
		];
		for (const page of [DEFAULT_SYNC, { ...DEFAULT_SYNC, media: true }]) {
			const rs = rows(t, ORIGIN, g2, pairs, page);
			expect(rs.map((r) => [r.key, r.kind, r.pick])).toEqual([['rec:r1', 'field', undefined]]);
			expect(
				mergeTargets(
					rs,
					{},
					new Map([
						[T, t],
						[G1, ORIGIN],
						[G2, g2]
					])
				)
			).toEqual(new Map());
		}
	});

	it('a copy’s suffixed name picks the plain name', () => {
		const suffixed = edit(ORIGIN, { name: 'Basic (Sreda 17:30)' });
		// Never in step: the plain rule would leave it open.
		const two = mergeRows(
			[
				{ id: T, flat: ORIGIN },
				{ id: G2, flat: suffixed }
			],
			[],
			hash,
			DEFAULT_SYNC
		);
		expect(two.map((r) => [r.key, r.pick])).toEqual([['name', 'h(Basic)']]);
		// In step at the plain name: the suffix reads as G2's change, still the plain name wins.
		const rs = rows(ORIGIN, ORIGIN, suffixed);
		expect(rs.map((r) => [r.key, r.pick])).toEqual([['name', 'h(Basic)']]);
	});

	it('orders rows as diff does: root fields, set members, pieces', () => {
		const t = edit(ORIGIN, { notes: 'n1', 'rec:r1:note': 'note1', 'link:https://b': '1' });
		const g1 = edit(ORIGIN, { name: 'Basico', timing: 't1' });
		const rs = rows(t, g1, ORIGIN);
		expect(rs.map((r) => r.key)).toEqual([
			'name',
			'notes',
			'timing',
			'link:https://b',
			'rec:r1:note'
		]);
	});

	it('labels come from the page’s field, else the first copy holding it', () => {
		const g1 = edit(ORIGIN, { 'link:https://b': '1' });
		g1['link:https://b'] = { ...g1['link:https://b'], label: 'Link · From G1' };
		const rs = rows(ORIGIN, g1, ORIGIN);
		expect(row(rs, 'link:https://b')!.label).toBe('Link · From G1');
	});
});

describe('mergeTargets', () => {
	const flats = (t: Flat, g1: Flat, g2: Flat) =>
		new Map([
			[T, t],
			[G1, g1],
			[G2, g2]
		]);

	it('each copy that differs gets the picked value from a copy holding it', () => {
		const t = edit(ORIGIN, { notes: 'n1' });
		const g1 = edit(ORIGIN, { timing: 't1' });
		const rs = rows(t, g1, ORIGIN);
		const out = mergeTargets(rs, {}, flats(t, g1, ORIGIN));
		expect(out).toEqual(
			new Map([
				[T, [{ giver: G1, keys: ['timing'] }]],
				[G1, [{ giver: T, keys: ['notes'] }]],
				[
					G2,
					[
						{ giver: T, keys: ['notes'] },
						{ giver: G1, keys: ['timing'] }
					]
				]
			])
		);
	});

	it('a pick overrides the preselection; an open row with no pick lands nothing', () => {
		const g1 = edit(ORIGIN, { partner: 'p1', timing: 't1' });
		const g2 = edit(ORIGIN, { partner: 'p2' });
		const rs = rows(ORIGIN, g1, g2);
		expect(unresolved(rs, {})).toEqual(['partner']);
		const none = mergeTargets(rs, {}, flats(ORIGIN, g1, g2));
		expect([...none.values()].flat().flatMap((g) => g.keys)).not.toContain('partner');
		const out = mergeTargets(rs, { partner: 'h(p2)', timing: 'h(t0)' }, flats(ORIGIN, g1, g2));
		expect(out).toEqual(
			new Map([
				[T, [{ giver: G2, keys: ['partner'] }]],
				[G1, [{ giver: G2, keys: ['partner', 'timing'] }]]
			])
		);
	});

	it('a pick that is none of the row’s values is unresolved and lands nothing', () => {
		const g1 = edit(ORIGIN, { timing: 't1' });
		const rs = rows(ORIGIN, g1, ORIGIN);
		expect(unresolved(rs, { timing: 'h(nope)' })).toEqual(['timing']);
		expect(mergeTargets(rs, { timing: 'h(nope)' }, flats(ORIGIN, g1, ORIGIN))).toEqual(new Map());
	});

	it('a ticked removal lands on the copies holding it, from a copy without it', () => {
		const g1 = edit(ORIGIN, { 'link:https://a': null });
		const rs = rows(ORIGIN, g1, ORIGIN);
		const out = mergeTargets(rs, { 'link:https://a': null }, flats(ORIGIN, g1, ORIGIN));
		expect(out).toEqual(
			new Map([
				[T, [{ giver: G1, keys: ['link:https://a'] }]],
				[G2, [{ giver: G1, keys: ['link:https://a'] }]]
			])
		);
	});

	it('throws when the flats are not the rows’ copies as the rows saw them', () => {
		const g1 = edit(ORIGIN, { timing: 't1' });
		const rs = rows(ORIGIN, g1, ORIGIN);
		// G1 saved again since the rows were read.
		const stale = flats(ORIGIN, edit(ORIGIN, { timing: 't2' }), ORIGIN);
		expect(() => mergeTargets(rs, {}, stale)).toThrow(/does not hold/);
		// A holder missing.
		const missing = new Map([
			[T, ORIGIN],
			[G1, g1]
		]);
		expect(() => mergeTargets(rs, {}, missing)).toThrow(/does not hold/);
		// A copy the rows never merged.
		const extra = new Map([...flats(ORIGIN, g1, ORIGIN), [4, ORIGIN]]);
		expect(() => mergeTargets(rs, {}, extra)).toThrow(/not timing's copies/);
	});

	it('an unticked box lands nothing: keep never restores, an unticked add never removes', () => {
		const g1 = edit(ORIGIN, { 'link:https://a': null });
		const t = edit(ORIGIN, { 'rec:r2': 'video|200' });
		const rs = rows(t, g1, ORIGIN);
		expect(rs.map((r) => [r.key, r.kind, r.pick])).toEqual([
			['link:https://a', 'remove', 'h(1)'],
			['rec:r2', 'add', null]
		]);
		expect(unresolved(rs, {})).toEqual([]);
		expect(mergeTargets(rs, {}, flats(t, g1, ORIGIN))).toEqual(new Map());
		// Ticked, the add lands on the copies without it.
		const out = mergeTargets(rs, { 'rec:r2': 'h(video|200)' }, flats(t, g1, ORIGIN));
		expect(out).toEqual(
			new Map([
				[G1, [{ giver: T, keys: ['rec:r2'] }]],
				[G2, [{ giver: T, keys: ['rec:r2'] }]]
			])
		);
	});

	it('takes as many keys as it can from one giver, the page first on a tie', () => {
		// G2 needs notes (T and G1 hold the pick) and timing (only G1): one landing from G1.
		const t = edit(ORIGIN, { notes: 'n1' });
		const g1 = edit(ORIGIN, { notes: 'n1', timing: 't1' });
		const rs = rows(t, g1, ORIGIN);
		const out = mergeTargets(rs, {}, flats(t, g1, ORIGIN));
		expect(out.get(G2)).toEqual([{ giver: G1, keys: ['notes', 'timing'] }]);
		// T needs only timing from G1.
		expect(out.get(T)).toEqual([{ giver: G1, keys: ['timing'] }]);
		// Notes alone: T and G1 tie, the page gives.
		const rs2 = rows(t, t, ORIGIN);
		expect(mergeTargets(rs2, {}, flats(t, t, ORIGIN)).get(G2)).toEqual([
			{ giver: T, keys: ['notes'] }
		]);
		// Two givers needed: the earlier member's group comes first.
		const t3 = edit(ORIGIN, { timing: 't1' });
		const g23 = edit(ORIGIN, { notes: 'n1' });
		const rs3 = rows(t3, ORIGIN, g23);
		expect(mergeTargets(rs3, {}, flats(t3, ORIGIN, g23)).get(G1)).toEqual([
			{ giver: T, keys: ['timing'] },
			{ giver: G2, keys: ['notes'] }
		]);
	});
});
