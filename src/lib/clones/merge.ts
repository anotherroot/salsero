/**
 * Sync's N-way merge: every copy of a thing a person reads, merged field by
 * field like a git merge across N branches. PURE and client-safe: hashing is
 * passed in.
 *
 * The rule. Each pair snapshot (`clone_pairs`, the last time two copies were in
 * step) gives a verdict on both its copies for every key it does not skip: a
 * copy **changed** the key when its value now differs from the snapshot's
 * (absent from `base.fields` meaning the key was absent then). A key in the
 * pair's `skip` (a piece left out of a copy) gets no verdict from that pair.
 * So each copy is read against every copy it has a snapshot with, directly or
 * through the copy that links them, and a copy with no snapshot covering the
 * key is unknown. A value is `changed` when a copy holding it changed;
 * unknown when no copy holding it has any verdict.
 *
 * - Exactly one changed value and none unknown: `pick` starts on it.
 * - Two or more changed, any unknown, or none changed: open (`undefined`).
 *   Two copies never in step that differ are therefore open.
 * - A key present on some copies only, with one change: `add` when the change
 *   is the key's arrival, `remove` when it is its going. A removal starts on
 *   "keep" (the present value). An add of a section, point, recording or video
 *   starts ticked only when the page's own copy has that option on (the
 *   options set the boxes' defaults); every other add starts ticked.
 * - A name or title where every value but one is another's copy suffix
 *   ("Basic (Sreda 17:30)" against "Basic") starts on the plain name.
 * - A recording, video or section present on some copies only goes whole:
 *   its parts (a recording's note and sections, a section's links) are not
 *   rows, as in `diff`.
 * - Rows come in `diff`'s order for the page (the first member) against the
 *   union of the others; a row's label is the page's field's, else the first
 *   copy holding it.
 *
 * This reads per pair rather than taking one "agreed" value from the most
 * recent snapshot: a copy only behind another (T synced with G2 after G1 was
 * last in step) must not read as a change, or its old value would be
 * preselected over the newer one.
 */
import type { Flat, FlatField, MergeRow, MergeValue, PairBase, SyncSettings } from '$lib/types';
import { compareKeys, isCopySuffix, NAME_KEYS, skipped, sortKey, type Hash } from './diff';
import { pieceParts } from './flat';
import { classOf } from './sync';

export type MergeMember = { id: number; flat: Flat };
/** A pair snapshot between two members. `at` is when it was written; the rule needs no order. */
export type MergePair = { a: number; b: number; at: number; base: PairBase };

function valueOf(f: Flat, key: string): FlatField | null {
	return Object.hasOwn(f, key) ? f[key] : null;
}

/** The plain name among a name row's values, when all others are its copy-suffixed forms. */
function plainName(values: MergeValue[]): MergeValue | null {
	if (values.some((v) => v.field === null)) return null;
	const plain = values.filter(
		(v) => !values.some((u) => u !== v && isCopySuffix(u.field!.value, v.field!.value))
	);
	return plain.length === 1 ? plain[0] : null;
}

/** Whether an add of this key is a box the page's options tick (sections, media) or always ticked. */
function addTicked(key: string, page: SyncSettings): boolean {
	const cls = classOf(key, false);
	if (cls === 'sections') return page.sections;
	if (cls === 'media') return page.media;
	return true;
}

/** Every difference among the members, with what each copy holds and what starts picked. */
export function mergeRows(
	members: MergeMember[],
	pairs: MergePair[],
	hash: Hash,
	page: SyncSettings
): MergeRow[] {
	if (members.length < 2) return [];
	const ids = new Set(members.map((m) => m.id));
	const live = pairs.filter((p) => p.a !== p.b && ids.has(p.a) && ids.has(p.b));
	const pageFlat = members[0].flat;
	const union: Flat = {};
	for (const m of members)
		for (const key of Object.keys(m.flat)) if (!Object.hasOwn(union, key)) union[key] = m.flat[key];

	const found: MergeRow[] = [];
	for (const key of Object.keys(union)) {
		const now = new Map<number, string | null>();
		const byHash = new Map<string | null, MergeValue>();
		for (const m of members) {
			const field = valueOf(m.flat, key);
			const h = field ? hash(field.value) : null;
			now.set(m.id, h);
			const v = byHash.get(h);
			if (v) v.holders.push(m.id);
			else byHash.set(h, { hash: h, field, holders: [m.id], changed: false });
		}
		if (byHash.size < 2) continue;

		// Each pair's verdict on its two copies: changed since that snapshot, or not.
		const verdict = new Map<number, boolean>();
		for (const p of live) {
			if (skipped(key, p.base.skip)) continue;
			const was = Object.hasOwn(p.base.fields, key) ? p.base.fields[key] : null;
			for (const id of [p.a, p.b]) verdict.set(id, verdict.get(id) === true || now.get(id) !== was);
		}
		const values = [...byHash.values()];
		let unknown = 0;
		for (const v of values) {
			v.changed = v.holders.some((id) => verdict.get(id) === true);
			if (!v.changed && !v.holders.some((id) => verdict.has(id))) unknown++;
		}
		const changed = values.filter((v) => v.changed);
		const one = changed.length === 1 && unknown === 0 ? changed[0] : null;

		let pick: string | null | undefined = one ? one.hash : undefined;
		let kind: MergeRow['kind'] = 'field';
		const absent = byHash.get(null);
		if (one && absent && values.length === 2) {
			const present = values.find((v) => v.hash !== null)!;
			if (one === absent) {
				kind = 'remove';
				pick = present.hash; // keep
			} else {
				kind = 'add';
				pick = addTicked(key, page) ? present.hash : null;
			}
		}
		if (NAME_KEYS.has(key)) {
			const plain = plainName(values);
			if (plain) pick = plain.hash;
		}
		const label = (valueOf(pageFlat, key) ?? union[key]).label;
		found.push({ key, label, values, pick, kind });
	}

	// A piece or a section present on some copies only goes whole: its parts are not rows.
	const whole = new Set(
		found
			.filter((r) => r.values.some((v) => v.hash === null))
			.filter((r) => {
				const part = pieceParts(r.key)?.part;
				return part === 'piece' || part === 'spot';
			})
			.map((r) => r.key)
	);
	return found
		.filter((r) => {
			const parts = pieceParts(r.key);
			if (!parts || parts.part === 'piece') return true;
			if (whole.has(parts.piece)) return false;
			return !(parts.part === 'links' && whole.has(r.key.slice(0, -':links'.length)));
		})
		.map((r) => ({ r, at: sortKey(r.key, r.label, pageFlat, union) }))
		.sort((a, b) => compareKeys(a.at, b.at))
		.map(({ r }) => r);
}

/** The person's choice for a row: their pick, else the preselection; undefined while open. */
function choiceOf(row: MergeRow, picks: Record<string, string | null>): string | null | undefined {
	return Object.hasOwn(picks, row.key) ? picks[row.key] : row.pick;
}

/**
 * The keys a Sync cannot run with: rows still open, or picked to a value that
 * is none of the row's. The caller refuses while this is not empty.
 */
export function unresolved(rows: MergeRow[], picks: Record<string, string | null>): string[] {
	return rows
		.filter((r) => {
			const c = choiceOf(r, picks);
			return c === undefined || !r.values.some((v) => v.hash === c);
		})
		.map((r) => r.key);
}

/**
 * What each copy must take so it holds the chosen value of every row: per
 * member of `flats` (keyed by id, in the members' order, the page first) whose
 * value differs, the givers and their keys. A removal chosen is taken from a
 * copy without the key. Keys are grouped onto as few givers as possible (the
 * one covering the most keys first, the earlier member on a tie), so a target
 * lands few times.
 *
 * A row in `unresolved` lands nothing (the caller refuses first). An add or
 * remove box left unticked lands nothing either: an unticked add removes the
 * piece from no copy, and "keep" restores it on no copy that removed it, so a
 * Sync never deletes or undoes a piece by default.
 */
export function mergeTargets(
	rows: MergeRow[],
	picks: Record<string, string | null>,
	flats: Map<number, Flat>
): Map<number, { giver: number; keys: string[] }[]> {
	const rank = new Map([...flats.keys()].map((id, i) => [id, i]));
	const rankOf = (id: number) => rank.get(id) ?? Number.MAX_SAFE_INTEGER;
	const needs = new Map<number, { key: string; givers: number[] }[]>();
	for (const row of rows) {
		const choice = choiceOf(row, picks);
		if (choice === undefined) continue;
		const chosen = row.values.find((v) => v.hash === choice);
		if (!chosen) continue;
		if (row.kind === 'add' && choice === null) continue;
		if (row.kind === 'remove' && choice !== null) continue;
		for (const [id, f] of flats) {
			const cur = valueOf(f, row.key);
			const holds = chosen.field === null ? cur === null : cur?.value === chosen.field.value;
			if (holds) continue;
			const givers = chosen.holders.filter((g) => g !== id);
			if (givers.length === 0) continue;
			const list = needs.get(id) ?? [];
			list.push({ key: row.key, givers });
			needs.set(id, list);
		}
	}

	const out = new Map<number, { giver: number; keys: string[] }[]>();
	for (const [id, need] of needs) {
		let left = need;
		const groups: { giver: number; keys: string[] }[] = [];
		while (left.length > 0) {
			const count = new Map<number, number>();
			for (const n of left) for (const g of n.givers) count.set(g, (count.get(g) ?? 0) + 1);
			const giver = [...count.entries()].sort(
				(a, b) => b[1] - a[1] || rankOf(a[0]) - rankOf(b[0])
			)[0][0];
			groups.push({ giver, keys: left.filter((n) => n.givers.includes(giver)).map((n) => n.key) });
			left = left.filter((n) => !n.givers.includes(giver));
		}
		out.set(id, groups);
	}
	return out;
}
