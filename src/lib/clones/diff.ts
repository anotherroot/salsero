/**
 * The three-way compare of two members of a family, against the snapshot of
 * the last time those two were in step (`PairBase`, written only by copy, Take
 * and Send). PURE and client-safe: hashing is passed in.
 *
 * - A field only one side changed since the snapshot is that side's change.
 * - A field both changed, or any difference with no snapshot, is `'both'`:
 *   the person picks.
 * - A removal is never preselected: defaults never delete in the receiver.
 * - After a Take or Send, `nextBase` records the giver's value for whatever
 *   the receiver kept, so the next compare reads it as the receiver's own
 *   change and does not ask again.
 */
import type { FieldDiff, Flat, PairBase, Picks, Side } from '$lib/types';
import { pieceOf, pieceParts, ROOT_KEYS, SET_PREFIXES, setPrefixOf } from './flat';

type Hash = (v: string) => string;

const PART_RANK = { piece: 0, note: 1, spot: 2, links: 2 } as const;

/** Where a key sorts: root fields in grammar order, set members, pieces by label. */
function sortKey(key: string, label: string, mine: Flat, theirs: Flat): (string | number)[] {
	const labelOf = (k: string) => (mine[k] ?? theirs[k])?.label ?? k;
	const root = (ROOT_KEYS as readonly string[]).indexOf(key);
	if (root >= 0) return [0, root];
	const prefix = setPrefixOf(key);
	if (prefix) return [1, (SET_PREFIXES as readonly string[]).indexOf(prefix), label, key];
	const parts = pieceParts(key);
	if (parts) {
		const head = [2, labelOf(parts.piece), parts.piece, PART_RANK[parts.part]];
		if (parts.part === 'spot') return [...head, label, key, 0];
		if (parts.part === 'links') {
			const spot = key.slice(0, -':links'.length);
			return [...head, labelOf(spot), spot, 1];
		}
		return head;
	}
	return [3, key];
}

function compareKeys(a: (string | number)[], b: (string | number)[]): number {
	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		if (a[i] < b[i]) return -1;
		if (a[i] > b[i]) return 1;
	}
	return a.length - b.length;
}

function skipped(key: string, skip: string[]): boolean {
	const piece = pieceOf(key);
	return skip.includes(key) || (piece !== null && skip.includes(piece));
}

/** What differs between `mine` and `theirs`, and who changed it since `base`. */
export function diff(base: PairBase | null, mine: Flat, theirs: Flat, hash: Hash): FieldDiff[] {
	const skip = base?.skip ?? [];
	const keys = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])];
	const found: FieldDiff[] = [];
	for (const key of keys) {
		if (skipped(key, skip)) continue;
		const m = mine[key] ?? null;
		const t = theirs[key] ?? null;
		const mh = m ? hash(m.value) : null;
		const th = t ? hash(t.value) : null;
		if (mh === th) continue;
		let side: Side = 'both';
		if (base) {
			const was = base.fields[key] ?? null;
			const mineChanged = mh !== was;
			const theirsChanged = th !== was;
			side = mineChanged && theirsChanged ? 'both' : mineChanged ? 'mine' : 'theirs';
		}
		const removal =
			side === 'mine' ? m === null : side === 'theirs' ? t === null : m === null || t === null;
		found.push({ key, label: (m ?? t)!.label, mine: m, theirs: t, side, removal });
	}
	// A piece or a section present on one side only travels or goes whole: its
	// parts (a piece's note and sections, a section's links) are not listed.
	const whole = new Set(
		found
			.filter((d) => d.mine === null || d.theirs === null)
			.filter((d) => {
				const part = pieceParts(d.key)?.part;
				return part === 'piece' || part === 'spot';
			})
			.map((d) => d.key)
	);
	return found
		.filter((d) => {
			const parts = pieceParts(d.key);
			if (!parts || parts.part === 'piece') return true;
			if (whole.has(parts.piece)) return false;
			return !(parts.part === 'links' && whole.has(d.key.slice(0, -':links'.length)));
		})
		.map((d) => ({ d, at: sortKey(d.key, d.label, mine, theirs) }))
		.sort((a, b) => compareKeys(a.at, b.at))
		.map(({ d }) => d);
}

/** The fields that name a member. */
export const NAME_KEYS: ReadonlySet<string> = new Set(['name', 'title']);

/**
 * Whether `theirs` is only `mine` with a copy's suffix: the " (Salsa
 * Tuesdays)" or " (Salsa Tuesdays 2)" a copy takes when its place already has
 * that name (`suffixed`, which may cut the base short to fit).
 */
export function isCopySuffix(mine: string, theirs: string): boolean {
	const m = theirs.match(/^(.*) \([^()]+\)$/);
	if (!m) return false;
	const base = m[1].trim();
	return base !== '' && mine.trim().startsWith(base);
}

/**
 * What a Take (`mine` receives) or a Send (`theirs` receives) preselects: the
 * changed side, except that a removal is never preselected. `'both'` gets no
 * pick.
 *
 * Names and titles: Take treats them like any field (a merge tool), except
 * that a name which is only the other's with a copy's suffix stays yours, so
 * a copy's "Doble (Salsa Tuesdays)" is not pulled in. Send keeps the
 * receiver's own, whoever changed it: a name goes only when its rename box is
 * ticked.
 */
export function defaultPicks(diffs: FieldDiff[], mode: 'take' | 'send'): Picks {
	const picks: Picks = {};
	for (const d of diffs) {
		if (NAME_KEYS.has(d.key)) {
			if (mode === 'send') {
				picks[d.key] = 'theirs';
				continue;
			}
			const mine = d.mine?.value ?? '';
			const theirs = d.theirs?.value ?? '';
			if (d.mine === null || d.theirs === null) picks[d.key] = 'mine';
			else if (isCopySuffix(mine, theirs) || isCopySuffix(theirs, mine)) picks[d.key] = 'mine';
			else if (d.side !== 'both') picks[d.key] = d.side;
			continue;
		}
		if (d.side === 'both') continue;
		if (d.removal && mode === 'take' && d.side === 'theirs') picks[d.key] = 'mine';
		else if (d.removal && mode === 'send' && d.side === 'mine') picks[d.key] = 'theirs';
		else picks[d.key] = d.side;
	}
	return picks;
}

const turned = (side: 'mine' | 'theirs'): 'mine' | 'theirs' =>
	side === 'mine' ? 'theirs' : 'mine';

/**
 * Send's preselection for one target, read from the target's side (`mine`
 * the target, `theirs` your member, as `syncFrom` takes it): exactly
 * `defaultPicks(…, 'send')` on your member's side, turned round. So
 * `'theirs'` is what lands; your deletes, the target's own changes and its
 * name stay; a field both changed has no pick.
 */
export function sendPicks(targetDiffs: FieldDiff[]): Picks {
	const giverSide = targetDiffs.map((d) => ({
		...d,
		mine: d.theirs,
		theirs: d.mine,
		side: d.side === 'both' ? d.side : turned(d.side)
	}));
	const picks: Picks = {};
	for (const [key, side] of Object.entries(defaultPicks(giverSide, 'send')))
		picks[key] = turned(side);
	return picks;
}

/** The `'both'` keys still without a pick. */
export function unpicked(diffs: FieldDiff[], picks: Picks): string[] {
	return diffs.filter((d) => d.side === 'both' && !picks[d.key]).map((d) => d.key);
}

/**
 * The pair's snapshot after a Take or Send. A key equal on both sides gets
 * that hash; a key that still differs gets the giver's (none when the giver
 * lacks it), so the receiver's kept value reads as the receiver's own change.
 * `skip` keeps `prevSkip` minus the pieces now present on both sides.
 */
export function nextBase(receiver: Flat, giver: Flat, prevSkip: string[], hash: Hash): PairBase {
	const fields: Record<string, string> = {};
	// Equal keys have the giver's hash already; a key the giver lacks stays out.
	for (const key of Object.keys(giver)) fields[key] = hash(giver[key].value);
	return {
		fields,
		skip: prevSkip.filter(
			(piece) => !(Object.hasOwn(receiver, piece) && Object.hasOwn(giver, piece))
		)
	};
}

/** The pair's snapshot at copy time: the source's hashes; `skip` the pieces not carried. */
export function initialBase(source: Flat, skip: string[], hash: Hash): PairBase {
	const fields: Record<string, string> = {};
	for (const key of Object.keys(source)) fields[key] = hash(source[key].value);
	return { fields, skip: [...skip] };
}

/**
 * Where another member stands against the page's row (`mine`): in step, only
 * the page changed since the pair was in step (the other is behind it), only
 * the other changed (newer), or anything else.
 */
export function standing(diffs: FieldDiff[]): 'same' | 'behind' | 'newer' | 'differs' {
	if (diffs.length === 0) return 'same';
	if (diffs.every((d) => d.side === 'mine')) return 'behind';
	if (diffs.every((d) => d.side === 'theirs')) return 'newer';
	return 'differs';
}
