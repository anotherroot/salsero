/**
 * Keep in step: which changed fields may flow from one copy into another.
 * PURE and client-safe: hashing is passed in.
 */
import type { FieldDiff, Flat, SyncSettings } from '$lib/types';
import { isCopySuffix, NAME_KEYS, type Hash } from './diff';
import { pieceParts, setPrefixOf } from './flat';

/** The switch is on; names and small removals flow; sections and media do not. */
export const DEFAULT_SYNC: SyncSettings = {
	on: true,
	names: true,
	small: true,
	sections: false,
	media: false
};

/** The option a key falls under; `always` flows whenever the switch is on. */
export type KeyClass = 'name' | 'small' | 'sections' | 'media' | 'always';

export function classOf(key: string, removal: boolean): KeyClass {
	if (NAME_KEYS.has(key)) return 'name';
	const parts = pieceParts(key);
	if (parts) {
		if (parts.part === 'piece') return 'media';
		if (parts.part === 'spot') return 'sections';
		if (parts.part === 'links') return removal ? 'small' : 'always';
		return 'always';
	}
	if (setPrefixOf(key)) return removal ? 'small' : 'always';
	return 'always';
}

export function allows(s: SyncSettings, key: string, removal: boolean): boolean {
	if (!s.on) return false;
	switch (classOf(key, removal)) {
		case 'name':
			return s.names;
		case 'small':
			return s.small;
		case 'sections':
			return s.sections;
		case 'media':
			return s.media;
		default:
			return true;
	}
}

/** The keys whose value moved (changed, added or gone) since the mark. No mark, none. */
export function changedKeys(mark: Record<string, string> | null, flat: Flat, hash: Hash): string[] {
	if (mark === null) return [];
	const keys = new Set([...Object.keys(mark), ...Object.keys(flat)]);
	const out: string[] = [];
	for (const key of keys) {
		const was = Object.hasOwn(mark, key) ? mark[key] : null;
		const now = Object.hasOwn(flat, key) ? hash(flat[key].value) : null;
		if (was !== now) out.push(key);
	}
	return out.sort();
}

/** A name or title that differs only by a copy's suffix, in either direction. */
export function suffixOnly(d: FieldDiff): boolean {
	if (!NAME_KEYS.has(d.key) || d.mine === null || d.theirs === null) return false;
	return isCopySuffix(d.mine.value, d.theirs.value) || isCopySuffix(d.theirs.value, d.mine.value);
}

/**
 * The keys of a save that flow into a receiver. `pair` is
 * `diff(base, receiver as mine, giver as theirs)`: a key flows when this save
 * changed it, only the giver's side moved since the base, the receiver's
 * settings allow it, and it is not just a copy's name suffix.
 */
export function flowKeys(saved: string[], pair: FieldDiff[], into: SyncSettings): string[] {
	const out: string[] = [];
	for (const d of pair) {
		if (!saved.includes(d.key) || d.side !== 'theirs') continue;
		if (!allows(into, d.key, d.removal) || suffixOnly(d)) continue;
		out.push(d.key);
	}
	return out;
}
