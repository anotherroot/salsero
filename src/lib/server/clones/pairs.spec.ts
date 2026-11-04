import { beforeEach, describe, expect, it } from 'vitest';
import type { Flat } from '$lib/types';
import { fieldLabel } from '$lib/clones/flat';
import { openDb, type Db } from '../db';
import { clonePairs } from '../db/schema';
import { digest, dropPairs, hashValue, pairAt, pairBase, writePair } from './pairs';

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
});

function flat(...fields: [string, string][]): Flat {
	const out: Flat = {};
	for (const [key, value] of fields)
		out[key] = { key, value, show: value, label: fieldLabel(key, value) };
	return out;
}

describe('hashValue', () => {
	it('is the first 16 hex characters of sha-256', () => {
		// sha256('') = e3b0c44298fc1c149afbf4c8996fb924…
		expect(hashValue('')).toBe('e3b0c44298fc1c14');
		expect(hashValue('a')).not.toBe(hashValue('b'));
	});
});

describe('pairs', () => {
	const base = { fields: { name: hashValue('Doble'), notes: hashValue('') }, skip: ['rec:g1'] };

	it('writes in one order and reads in either', () => {
		writePair(db, 'figure', 7, 3, base, 100);
		expect(pairBase(db, 'figure', 3, 7)).toEqual(base);
		expect(pairBase(db, 'figure', 7, 3)).toEqual(base);
		expect(pairAt(db, 'figure', 3, 7)).toBe(100);
		expect(db.select().from(clonePairs).all()).toMatchObject([{ aId: 3, bId: 7 }]);
		expect(pairBase(db, 'routine', 3, 7)).toBeNull();
		expect(pairAt(db, 'figure', 3, 8)).toBeNull();
	});

	it('a second write replaces the snapshot', () => {
		writePair(db, 'figure', 3, 7, base, 100);
		const next = { fields: { name: hashValue('Triple') }, skip: [] };
		writePair(db, 'figure', 7, 3, next, 200);
		expect(pairBase(db, 'figure', 3, 7)).toEqual(next);
		expect(pairAt(db, 'figure', 7, 3)).toBe(200);
		expect(db.select().from(clonePairs).all()).toHaveLength(1);
	});

	it('a member has no pair with itself', () => {
		expect(pairBase(db, 'figure', 3, 3)).toBeNull();
		expect(() => writePair(db, 'figure', 3, 3, base, 1)).toThrow();
	});

	it('dropPairs forgets every pair of that member, and only of that kind', () => {
		writePair(db, 'figure', 3, 7, base, 1);
		writePair(db, 'figure', 1, 3, base, 1);
		writePair(db, 'figure', 7, 9, base, 1);
		writePair(db, 'routine', 3, 7, base, 1);
		dropPairs(db, 'figure', 3);
		expect(pairBase(db, 'figure', 3, 7)).toBeNull();
		expect(pairBase(db, 'figure', 1, 3)).toBeNull();
		expect(pairBase(db, 'figure', 7, 9)).toEqual(base);
		expect(pairBase(db, 'routine', 3, 7)).toEqual(base);
	});
});

describe('digest', () => {
	const a = flat(['name', 'Doble'], ['notes', 'n'], ['link:https://x.si/?a=1', '1']);

	it('ignores key order', () => {
		const b = flat(['link:https://x.si/?a=1', '1'], ['notes', 'n'], ['name', 'Doble']);
		expect(digest(b)).toBe(digest(a));
	});

	it('changes when any value, key or presence changes', () => {
		const seen = new Set([digest(a)]);
		for (const other of [
			flat(['name', 'Doble'], ['notes', 'n2'], ['link:https://x.si/?a=1', '1']),
			flat(['name', 'Triple'], ['notes', 'n'], ['link:https://x.si/?a=1', '1']),
			flat(['name', 'Doble'], ['notes', 'n']),
			flat(['name', 'Doble'], ['notes', ''], ['link:https://x.si/?a=1', '1']),
			flat(['name', 'Doble'], ['notes', 'n'], ['link:https://x.si/?a=2', '1'])
		]) {
			seen.add(digest(other));
		}
		expect(seen.size).toBe(6);
	});

	it('cannot be fooled by = or a newline inside a value', () => {
		const x = flat(['name', 'a'], ['notes', 'b\nname=c']);
		const y = flat(['name', 'a\nnotes=b'], ['notes', 'c']);
		expect(digest(x)).not.toBe(digest(y));
	});
});
