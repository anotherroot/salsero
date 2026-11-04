import { describe, expect, it } from 'vitest';
import type { FieldDiff, Flat, PairBase, Picks } from '$lib/types';
import { defaultPicks, diff, initialBase, nextBase, sendPicks, standing, unpicked } from './diff';
import { fieldLabel, pieceOf } from './flat';

const hash = (v: string) => v;

/** A Flat from [key, value, show?] triples; labels come from `fieldLabel`. */
function flat(...fields: [string, string, string?][]): Flat {
	const out: Flat = {};
	for (const [key, value, show = value] of fields)
		out[key] = { key, value, show, label: fieldLabel(key, show) };
	return out;
}

/** `flat` with some keys changed (value) or gone (null). */
function edit(f: Flat, changes: Record<string, string | null>): Flat {
	const out: Flat = { ...f };
	for (const [key, value] of Object.entries(changes)) {
		if (value === null) delete out[key];
		else out[key] = { key, value, show: value, label: fieldLabel(key, value) };
	}
	return out;
}

/**
 * Test-only: apply the picked keys from `giver` onto `receiver`, as a server
 * would. A piece goes whole: its parts travel (or go) with it.
 */
function applyPicks(receiver: Flat, giver: Flat, keys: string[]): Flat {
	const out: Flat = { ...receiver };
	for (const key of keys) {
		const whole = pieceOf(key) === key;
		const touched = (k: string) => k === key || (whole && pieceOf(k) === key);
		for (const k of Object.keys(out)) if (touched(k)) delete out[k];
		for (const k of Object.keys(giver)) if (touched(k)) out[k] = giver[k];
	}
	return out;
}

/** A Take into `mine` from `theirs`: defaults, then `extra` picks on top. */
function take(mine: Flat, theirs: Flat, base: PairBase | null, extra: Picks = {}) {
	const diffs = diff(base, mine, theirs, hash);
	const picks = { ...defaultPicks(diffs, 'take'), ...extra };
	expect(unpicked(diffs, picks)).toEqual([]);
	const keys = diffs.filter((d) => picks[d.key] === 'theirs').map((d) => d.key);
	const after = applyPicks(mine, theirs, keys);
	return { after, base: nextBase(after, theirs, base?.skip ?? [], hash) };
}

/** A Send from `mine` into `theirs`: defaults, then `extra` picks on top. */
function send(mine: Flat, theirs: Flat, base: PairBase | null, extra: Picks = {}) {
	const diffs = diff(base, mine, theirs, hash);
	const picks = { ...defaultPicks(diffs, 'send'), ...extra };
	expect(unpicked(diffs, picks)).toEqual([]);
	const keys = diffs.filter((d) => picks[d.key] === 'mine').map((d) => d.key);
	const after = applyPicks(theirs, mine, keys);
	return { after, base: nextBase(after, mine, base?.skip ?? [], hash) };
}

const only = (diffs: FieldDiff[]) => {
	expect(diffs).toHaveLength(1);
	return diffs[0];
};

const A0 = flat(
	['name', 'Doble'],
	['notes', 'n0'],
	['timing', '1|16'],
	['rec:g1', 'video/mp4|100', 'Ana, 3 Nov'],
	['rec:g1:note', 'lead early'],
	['rec:g1:spot:s1', '1000|2000|Turn', 'Turn']
);
const base0 = initialBase(A0, [], hash);

describe('diff: two members', () => {
	it('1: B changes notes', () => {
		const B = edit(A0, { notes: 'nB' });
		const d = only(diff(base0, A0, B, hash));
		expect(d).toMatchObject({ key: 'notes', label: 'Notes', side: 'theirs', removal: false });
		expect(defaultPicks([d], 'take')).toEqual({ notes: 'theirs' });
	});

	it('2: A and B both change notes', () => {
		const A = edit(A0, { notes: 'nA' });
		const B = edit(A0, { notes: 'nB' });
		const diffs = diff(base0, A, B, hash);
		expect(only(diffs)).toMatchObject({ key: 'notes', side: 'both' });
		expect(unpicked(diffs, defaultPicks(diffs, 'take'))).toEqual(['notes']);
		expect(unpicked(diffs, { notes: 'mine' })).toEqual([]);
	});

	it('3: no base, timing differs', () => {
		const B = edit(A0, { timing: '3|8' });
		expect(only(diff(null, A0, B, hash))).toMatchObject({ key: 'timing', side: 'both' });
	});

	it('4: B adds rec:g2 (not in base)', () => {
		const B = { ...A0, ...flat(['rec:g2', 'video/mp4|50', 'Marko, 4 Nov']) };
		const d = only(diff(base0, A0, B, hash));
		expect(d).toMatchObject({
			key: 'rec:g2',
			label: 'Recording · Marko, 4 Nov',
			side: 'theirs',
			removal: false,
			mine: null
		});
	});

	it('5: B deletes rec:g1 (in base)', () => {
		const B = edit(A0, { 'rec:g1': null, 'rec:g1:note': null, 'rec:g1:spot:s1': null });
		const d = only(diff(base0, A0, B, hash));
		expect(d).toMatchObject({ key: 'rec:g1', side: 'theirs', removal: true, theirs: null });
		expect(defaultPicks([d], 'take')).toEqual({ 'rec:g1': 'mine' });
	});

	it('6: A deletes rec:g1; send mode', () => {
		const A = edit(A0, { 'rec:g1': null, 'rec:g1:note': null, 'rec:g1:spot:s1': null });
		const d = only(diff(base0, A, A0, hash));
		expect(d).toMatchObject({ key: 'rec:g1', side: 'mine', removal: true });
		expect(defaultPicks([d], 'send')).toEqual({ 'rec:g1': 'theirs' });
	});

	it('7: rec:g1 and its rec:g1:spot:s in skip, absent on A', () => {
		const A = edit(A0, { 'rec:g1': null, 'rec:g1:note': null, 'rec:g1:spot:s1': null });
		const base = initialBase(A0, ['rec:g1'], hash);
		expect(diff(base, A, A0, hash)).toEqual([]);
		expect(diff(base, A0, A, hash)).toEqual([]);
	});

	it('8: B adds rec:g1:spot:s9 under a piece both have', () => {
		const B = { ...A0, ...flat(['rec:g1:spot:s9', '3000|4000|Dip', 'Dip']) };
		expect(only(diff(base0, A0, B, hash))).toMatchObject({
			key: 'rec:g1:spot:s9',
			label: 'Section · Dip',
			side: 'theirs',
			removal: false
		});
	});

	it('8b: B adds a section with links under a piece both have: one difference', () => {
		const B = {
			...A0,
			...flat(['rec:g1:spot:s9', '3000|4000|Dip', 'Dip'], ['rec:g1:spot:s9:links', 'fig:g7', 'Dip'])
		};
		expect(only(diff(base0, A0, B, hash))).toMatchObject({
			key: 'rec:g1:spot:s9',
			side: 'theirs',
			removal: false
		});
		expect(only(diff(null, A0, B, hash)).key).toBe('rec:g1:spot:s9');
	});

	it('8c: B deletes a section with links: one difference, a removal', () => {
		const A = { ...A0, ...flat(['rec:g1:spot:s1:links', 'fig:g7', 'Turn']) };
		const base = initialBase(A, [], hash);
		const B = edit(A, { 'rec:g1:spot:s1': null, 'rec:g1:spot:s1:links': null });
		const d = only(diff(base, A, B, hash));
		expect(d).toMatchObject({ key: 'rec:g1:spot:s1', side: 'theirs', removal: true });
		expect(defaultPicks([d], 'take')).toEqual({ 'rec:g1:spot:s1': 'mine' });
	});

	it('8d: a section both have still lists its own links', () => {
		const A = { ...A0, ...flat(['rec:g1:spot:s1:links', 'fig:g7', 'Turn']) };
		const B = edit(A, { 'rec:g1:spot:s1:links': 'fig:g7,fig:g8' });
		expect(only(diff(initialBase(A, [], hash), A, B, hash))).toMatchObject({
			key: 'rec:g1:spot:s1:links',
			side: 'theirs'
		});
	});

	it('9: B lacks rec:g1 entirely while A has rec:g1 and rec:g1:note', () => {
		const B = edit(A0, { 'rec:g1': null, 'rec:g1:note': null, 'rec:g1:spot:s1': null });
		expect(only(diff(null, A0, B, hash)).key).toBe('rec:g1');
		expect(only(diff(base0, A0, B, hash)).key).toBe('rec:g1');
	});

	it("10: after take with notes kept 'mine': nextBase(A, B) then compare again", () => {
		const A = edit(A0, { notes: 'nA' });
		const B = edit(A0, { notes: 'nB' });
		const t = take(A, B, base0, { notes: 'mine' });
		expect(t.after.notes.value).toBe('nA');
		const d = only(diff(t.base, t.after, B, hash));
		expect(d).toMatchObject({ key: 'notes', side: 'mine' });
		// and from B's side the same pair reads as B's partner having changed it
		expect(only(diff(t.base, B, t.after, hash)).side).toBe('theirs');
	});
});

describe('nextBase', () => {
	it('a key the giver lacks stays out: a kept piece reads as mine afterwards', () => {
		const B = edit(A0, { 'rec:g1': null, 'rec:g1:note': null, 'rec:g1:spot:s1': null });
		const t = take(A0, B, base0);
		expect(t.after['rec:g1']).toBeDefined();
		expect(t.base.fields['rec:g1']).toBeUndefined();
		expect(only(diff(t.base, t.after, B, hash))).toMatchObject({
			key: 'rec:g1',
			side: 'mine',
			removal: false
		});
	});
});

describe('diff: three members', () => {
	/** A→B and A→C copies, then B edits notes and A takes it. */
	function afterTake(cEdits: Record<string, string | null> = {}) {
		let B = { ...A0 };
		let C = { ...A0 };
		const AB = initialBase(A0, [], hash);
		const AC = initialBase(A0, [], hash);
		B = edit(B, { notes: 'nB' });
		C = edit(C, cEdits);
		const t = take(A0, B, AB);
		return { A: t.after, B, C, AB: t.base, AC };
	}

	it('11: A takes B’s notes, then A vs C', () => {
		const { A, C, AC } = afterTake();
		expect(A.notes.value).toBe('nB');
		const d = only(diff(AC, A, C, hash));
		expect(d).toMatchObject({ key: 'notes', side: 'mine' });
		expect(defaultPicks([d], 'send')).toEqual({ notes: 'mine' });
	});

	it('12: as 11 but C also edited notes before the send', () => {
		const { A, C, AC } = afterTake({ notes: 'nC' });
		expect(only(diff(AC, A, C, hash))).toMatchObject({ key: 'notes', side: 'both' });
	});

	it('13: B vs C never synced directly (no base), equal after 11', () => {
		const { A, B, C, AC } = afterTake();
		const s = send(A, C, AC);
		expect(s.after.notes.value).toBe('nB');
		expect(diff(null, B, s.after, hash)).toEqual([]);
		expect(diff(s.base, A, s.after, hash)).toEqual([]);
	});

	it('14: B and C both change timing; A takes B’s; A vs C', () => {
		const AB = initialBase(A0, [], hash);
		const AC = initialBase(A0, [], hash);
		const B = edit(A0, { timing: '3|8' });
		const C = edit(A0, { timing: '5|8' });
		const t = take(A0, B, AB);
		expect(t.after.timing.value).toBe('3|8');
		expect(only(diff(AC, t.after, C, hash))).toMatchObject({ key: 'timing', side: 'both' });
	});

	it('15: rename on arrival: clone’s name differs from the base', () => {
		const base = initialBase(A0, [], hash);
		const clone = edit(A0, { name: 'Doble (Salsa nadaljevalna)' });
		const diffs = diff(base, clone, A0, hash);
		expect(only(diffs)).toMatchObject({ key: 'name', side: 'mine', removal: false });
		expect(unpicked(diffs, defaultPicks(diffs, 'take'))).toEqual([]);
		expect(defaultPicks(diffs, 'take')).toEqual({ name: 'mine' });
	});

	it('16: a name or title never travels by default, in either mode, whoever changed it', () => {
		const base = initialBase(A0, [], hash);
		const theirs = edit(A0, { name: 'Doble (Rueda club)' });
		const renamed = diff(base, A0, theirs, hash);
		expect(only(renamed)).toMatchObject({ key: 'name', side: 'theirs' });
		// Take keeps mine; Send (theirs receives) keeps theirs.
		expect(defaultPicks(renamed, 'take')).toEqual({ name: 'mine' });
		expect(defaultPicks(diff(base, theirs, A0, hash), 'send')).toEqual({ name: 'theirs' });
		// Both renamed: still the receiver's own, and nothing is left to pick.
		const both = diff(base, edit(A0, { name: 'Mine' }), theirs, hash);
		expect(defaultPicks(both, 'take')).toEqual({ name: 'mine' });
		expect(unpicked(both, defaultPicks(both, 'take'))).toEqual([]);
		const titles: FieldDiff[] = [
			{ key: 'title', label: 'Title', mine: null, theirs: null, side: 'theirs', removal: false }
		];
		expect(defaultPicks(titles, 'send')).toEqual({ title: 'theirs' });
	});
});

describe('diff: order and skip', () => {
	it('lists root fields in grammar order, then set members, then pieces by label', () => {
		const A = flat(
			['name', 'x'],
			['timing', '1|8'],
			['rec:gz', 'v|1', 'Ana'],
			['rec:gz:spot:s1', 'a', 'B section'],
			['rec:gz:spot:s1:links', 'r1'],
			['rec:gz:spot:s2', 'a', 'A section'],
			['link:https://b', '1', 'b'],
			['fig:g1', '1', 'Enchufla']
		);
		const B = flat(
			['name', 'y'],
			['notes', 'n'],
			['timing', '3|8'],
			['rec:gz', 'v|2', 'Ana'],
			['rec:gz:note', 'hi', 'Ana'],
			['rec:gz:spot:s1', 'b', 'B section'],
			['rec:gz:spot:s1:links', 'r2'],
			['rec:gz:spot:s2', 'b', 'A section'],
			['rec:ga', 'v|1', 'Zoe'],
			['video:g9', 'v|1', 'Bob'],
			['link:https://a', '1', 'a'],
			['drill:g2', '1', 'Shines']
		);
		expect(diff(null, A, B, hash).map((d) => d.key)).toEqual([
			'name',
			'notes',
			'timing',
			'link:https://a',
			'link:https://b',
			'fig:g1',
			'drill:g2',
			'rec:gz',
			'rec:gz:note',
			'rec:gz:spot:s2',
			'rec:gz:spot:s1',
			'rec:gz:spot:s1:links',
			'rec:ga',
			'video:g9'
		]);
	});

	it('nextBase drops a skipped piece once both sides have it', () => {
		const A = edit(A0, { 'rec:g1': null, 'rec:g1:note': null, 'rec:g1:spot:s1': null });
		const base = initialBase(A, ['rec:g1', 'rec:g7'], hash);
		// the recording is skipped: the compare never offers it
		expect(diff(base, A, A0, hash)).toEqual([]);
		// once it arrives some other way, the next snapshot stops skipping it
		const next = nextBase(A0, A0, base.skip, hash);
		expect(next.skip).toEqual(['rec:g7']);
		expect(next.fields['rec:g1:spot:s1']).toBe('1000|2000|Turn');
		expect(diff(next, edit(A0, { 'rec:g1:note': 'x' }), A0, hash)).toMatchObject([
			{ key: 'rec:g1:note', side: 'mine' }
		]);
	});

	it('initialBase hashes every field of the source', () => {
		const b = initialBase(A0, ['rec:g1'], (v) => `h(${v})`);
		expect(b.fields.notes).toBe('h(n0)');
		expect(b.fields['rec:g1:note']).toBe('h(lead early)');
		expect(b.skip).toEqual(['rec:g1']);
	});
});

describe('standing', () => {
	const d = (side: FieldDiff['side']): FieldDiff => ({
		key: 'notes',
		label: 'Notes',
		mine: null,
		theirs: null,
		side,
		removal: false
	});
	it('same, behind (only the page changed), newer (only the other), or differs', () => {
		expect(standing([])).toBe('same');
		expect(standing([d('mine'), d('mine')])).toBe('behind');
		expect(standing([d('theirs')])).toBe('newer');
		expect(standing([d('mine'), d('theirs')])).toBe('differs');
		expect(standing([d('both')])).toBe('differs');
	});
});

describe('sendPicks', () => {
	it('is defaultPicks(…, send) on the giver’s side, read from the target’s', () => {
		// The target's side: mine = the target, theirs = the giver (your member).
		const BASE = flat(['name', 'Doble'], ['notes', 'a'], ['timing', '1|8'], ['rec:g1', 'v']);
		const target = edit(BASE, { name: 'Doble (Rueda club)', timing: '3|8' });
		const giver = edit(BASE, { notes: 'b', 'rec:g1': null, 'rec:g2': 'v' });
		const base: PairBase = initialBase(BASE, [], hash);
		const onTarget = diff(base, target, giver, hash);
		const onGiver = diff(base, giver, target, hash);
		const sent = defaultPicks(onGiver, 'send');
		const turned: Picks = Object.fromEntries(
			Object.entries(sent).map(([k, side]) => [k, side === 'mine' ? 'theirs' : 'mine'])
		);
		expect(sendPicks(onTarget)).toEqual(turned);
		expect(sendPicks(onTarget)).toEqual({
			name: 'mine', // the target keeps its own name
			notes: 'theirs', // your change lands
			timing: 'mine', // theirs alone changed it: kept
			'rec:g1': 'mine', // you deleted it: not unless ticked
			'rec:g2': 'theirs' // you added it: lands
		});
	});
});
