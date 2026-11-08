/**
 * Sync: one sheet for every copy of a thing a person reads (spec "Sync").
 * `syncView` is what the sheet shows: the N-way merge's rows
 * (`$lib/clones/merge.ts`) across every live copy the person reads, the page's
 * first, and "Sync to": every live copy they edit, the page's first. A person
 * who edits only their own copy and reads the others gets "Update from
 * <club>": the same rows, their own copy the one target.
 *
 * `syncAll` merges once and lands the result on every ticked copy:
 *
 * 1. Refused whole, writing nothing: `denied` unless the person reads the
 *    page's row and edits every ticked copy (a group's copy they only read, or
 *    another person's own, is never a target); `stale` when a copy that is
 *    not ticked changed since the sheet was opened (its `seen` in
 *    `members`), or a copy came or went: its unseen values would be handed
 *    on, or written as the pair's base; `pick` while a row is open; `stale`
 *    when a pick names a value the row does not have (a stale copy's).
 * 2. A ticked copy that changed since the sheet was opened (`seen`, its
 *    digest) is refused alone, and left out of the merge, so nothing of what
 *    the person did not see is handed on from it. Each ticked copy's access is
 *    asked again right before it lands (the landings await one another).
 * 3. For each ticked copy, each `{giver, keys}` of `mergeTargets` lands with
 *    `landKeys` (`snapshot: 'keys'`) in its own transaction, `seen` re-checked
 *    on the first; a refusal (a name, no room, a linked section) or a throw
 *    stops that copy alone. A giver only gives keys it already holds the
 *    chosen value of, and a landing only writes keys its target does not
 *    hold, so the order of landings does not matter.
 * 4. Then, in one transaction, the snapshots of the merged result:
 *    - every pair among the landed copies (made when it has none): a key now
 *      equal on both gets the hash of its value; a key still differing (an
 *      unticked box, a song one place cannot take) keeps the pair's previous
 *      value, or stays out, so it reads as it did;
 *    - every existing pair between a landed copy and a copy the person did
 *      not land on (one they only read, or left unticked; not one refused):
 *      equal keys as above; a key still differing on a row the person
 *      decided (no unticked box), where the landed copy holds the choice,
 *      takes the other copy's value, so it now reads as the landed copy's
 *      change ("Your own change stays", or that copy behind yours) rather
 *      than an open row again. No new pair is made here: two people's own
 *      copies never pair, and a pair decides where flows go;
 *    - and every landed copy's mark.
 * 5. What landed flows on (`flowOnward`) from each copy that landed whole,
 *    with exactly its landed keys, to the copies the person does not see
 *    whose switch is on (a member's own copy, as if they had pulled it). Every
 *    copy of the sheet is visited: none is written back, an unticked one
 *    included.
 *
 * Picks are by value hash (`MergeRow.pick`'s grammar), keyed as the rows name
 * them; a key the sheet named before a copy stamped a gene still lands
 * (`currentKey`). A row the picks do not mention takes its preselection.
 *
 * Writes into a person's own copy log nothing; into a group's, `landKeys`
 * logs one `change` per landing, by the actor; the flow onward as it does.
 */
import { and, eq, inArray } from 'drizzle-orm';
import type {
	CloneKind,
	Flat,
	Member,
	MergeRow,
	PairBase,
	PlaceRef,
	SyncAllResult,
	SyncView
} from '$lib/types';
import { mergeRows, mergeTargets, unresolved, type MergePair } from '$lib/clones/merge';
import { pieceParts } from '$lib/clones/flat';
import {
	SYNC_FAILED,
	SYNC_NO_ACCESS,
	SYNC_PICK,
	SYNC_STALE,
	SYNC_THIS_ONE,
	syncTitle,
	updateTitle
} from '$lib/clones/view';
import type { Db } from '../db';
import { clonePairs } from '../db/schema';
import { roleOf } from '../teams';
import { musicFits } from '../song-links';
import { currentKey, landKeys } from './apply';
import { rowOf } from './edit';
import type { CloneFiles } from './files';
import { accessTo, geneOf, visibleMembers } from './genes';
import { flowOnward } from './flow';
import { markNow } from './marks';
import { digest, hashValue, pairBase, writePair } from './pairs';
import { syncSettingsOf } from './sync-settings';
import { flatOf } from './trees';

const DENIED = { ok: false, reason: 'denied', message: 'Not found.' } as const;

export const placeLabel = (place: PlaceRef) => (place.kind === 'mine' ? 'Yours' : place.name);

/** Yours first, then groups by name. */
export function byPlace(a: Member, b: Member): number {
	if (a.place.kind !== b.place.kind) return a.place.kind === 'mine' ? -1 : 1;
	return placeLabel(a.place).localeCompare(placeLabel(b.place));
}

type Family = { page: Member; members: Member[]; editable: Member[]; mode: 'sync' | 'update' };

/**
 * The live copies the person reads, the page's first, and those they edit.
 * Null when they cannot read the page's row, it is archived, it has no other
 * live copy they read, or they edit none of them.
 */
export function familyOf(db: Db, userId: string, kind: CloneKind, id: number): Family | null {
	const all = visibleMembers(db, userId, kind, id);
	const page = all.find((m) => m.id === id);
	if (!page || page.archived) return null;
	const others = all.filter((m) => m.id !== id && !m.archived).sort(byPlace);
	if (others.length === 0) return null;
	const members = [page, ...others];
	const editable = members.filter((m) => m.access === 'edit');
	if (editable.length === 0) return null;
	const mode = editable.length === 1 && editable[0].place.kind === 'mine' ? 'update' : 'sync';
	return { page, members, editable, mode };
}

/** Every pair snapshot among `ids`. */
function pairsAmong(db: Db, kind: CloneKind, ids: number[]): MergePair[] {
	return db
		.select()
		.from(clonePairs)
		.where(
			and(eq(clonePairs.kind, kind), inArray(clonePairs.aId, ids), inArray(clonePairs.bId, ids))
		)
		.all()
		.map((p) => {
			const parsed = JSON.parse(p.baseJson) as Partial<PairBase>;
			return {
				a: p.aId,
				b: p.bId,
				at: p.at,
				base: { fields: parsed.fields ?? {}, skip: parsed.skip ?? [] }
			};
		});
}

/**
 * The merge's rows across `members` (`flats` theirs, in their order), less
 * a song only some copies suggest that none of the others could take
 * (`musicFits`): nothing could resolve it.
 */
export function rowsOf(
	db: Db,
	userId: string,
	kind: CloneKind,
	pageId: number,
	members: Member[],
	flats: Map<number, Flat>
): MergeRow[] {
	const rows = mergeRows(
		members.map((m) => ({ id: m.id, flat: flats.get(m.id)! })),
		pairsAmong(
			db,
			kind,
			members.map((m) => m.id)
		),
		hashValue,
		syncSettingsOf(db, kind, pageId)
	);
	return rows.filter((r) => {
		if (!r.key.startsWith('song:')) return true;
		const absent = r.values.find((v) => v.hash === null);
		if (!absent) return true;
		const holders = r.values.filter((v) => v.hash !== null).flatMap((v) => v.holders);
		const ref = r.key.slice('song:'.length);
		return absent.holders.some((to) =>
			holders.some((from) => musicFits(db, kind, from, to, ref, userId))
		);
	});
}

/** "Sync to"'s word for a copy: the page's own, the person's role in a group, nothing for yours. */
function roleWord(db: Db, userId: string, m: Member, pageId: number): string {
	if (m.id === pageId) return SYNC_THIS_ONE;
	if (m.place.kind === 'mine') return '';
	return roleOf(db, userId, m.place.teamId) ?? '';
}

/**
 * The Sync sheet for row `id`, as `userId` sees it; null when there is
 * nothing to sync (see `familyOf`). `tz` only changes labels.
 */
export function syncView(
	db: Db,
	userId: string,
	kind: CloneKind,
	id: number,
	opts: { tz?: string } = {}
): SyncView | null {
	const fam = familyOf(db, userId, kind, id);
	if (!fam) return null;
	const flats = new Map(fam.members.map((m) => [m.id, flatOf(db, kind, m.id, opts)]));
	const rows = rowsOf(db, userId, kind, id, fam.members, flats);
	let title: string;
	let from: string | undefined;
	if (fam.mode === 'update') {
		const own = fam.editable[0];
		const reads = fam.members.filter((m) => m.access === 'read');
		const club =
			(fam.page.access === 'read' ? fam.page : null) ??
			reads.find((m) => m.id === own.clonedFrom) ??
			reads[0];
		from = placeLabel(club.place);
		title = updateTitle(from);
	} else {
		title = syncTitle(rowOf(db, kind, id)?.title ?? '');
	}
	return {
		title,
		rows,
		targets: fam.editable.map((m) => ({
			id: m.id,
			label: placeLabel(m.place),
			role: roleWord(db, userId, m, id),
			// Values only: a digest never depends on the zone the labels are in.
			seen: digest(flatOf(db, kind, m.id)),
			ticked: true
		})),
		mode: fam.mode,
		...(from !== undefined ? { from } : {}),
		members: fam.members.map((m) => ({
			id: m.id,
			label: placeLabel(m.place),
			seen: digest(flatOf(db, kind, m.id))
		}))
	};
}

/** The row deciding `key`: its own, else the section's or the piece's that came or went whole. */
function deciding(rows: Map<string, MergeRow>, key: string): MergeRow | null {
	const own = rows.get(key);
	if (own) return own;
	const parts = pieceParts(key);
	if (!parts) return null;
	if (parts.part === 'links') {
		const spot = rows.get(key.slice(0, -':links'.length));
		if (spot) return spot;
	}
	return rows.get(parts.piece) ?? null;
}

/** The person's choice on a row, undefined for an unticked box (nothing landed by it). */
function choiceOf(row: MergeRow, picks: Record<string, string | null>): string | null | undefined {
	const c = Object.hasOwn(picks, row.key) ? picks[row.key] : row.pick;
	if (row.kind === 'add' && c === null) return undefined;
	if (row.kind === 'remove' && c !== null) return undefined;
	return c;
}

/** A pair's snapshot rebased on what the two hold now (see the module's step 4). */
function snapshotOf(
	db: Db,
	prev: PairBase | null,
	landed: Flat,
	other: Flat,
	settled: ((key: string) => boolean) | null
): PairBase {
	const fields: Record<string, string> = {};
	for (const [key, hash] of Object.entries(prev?.fields ?? {})) fields[currentKey(db, key)] = hash;
	const keys = new Set([...Object.keys(fields), ...Object.keys(landed), ...Object.keys(other)]);
	const hashIn = (f: Flat, key: string) => (Object.hasOwn(f, key) ? hashValue(f[key].value) : null);
	for (const key of keys) {
		const a = hashIn(landed, key);
		const b = hashIn(other, key);
		let next: string | null | undefined;
		if (a === b) next = a;
		else if (key.startsWith('song:') && (a === null || b === null))
			next = null; // a song one place could not take is not in step (as `landKeys`)
		else if (settled?.(key)) next = b;
		else continue; // still differing: as it read before
		if (next === null) delete fields[key];
		else fields[key] = next;
	}
	const skip = (prev?.skip ?? []).filter(
		(piece) => !(Object.hasOwn(landed, piece) && Object.hasOwn(other, piece))
	);
	return { fields, skip };
}

/**
 * Merge once and land it on every ticked copy (see the module's comment).
 * `picks`: row key → the chosen value's hash (null: absent). `targets`: the
 * ticked copies with the digest each had when the sheet was opened;
 * `members`: every copy the sheet showed, with its digest then.
 */
export async function syncAll(
	db: Db,
	actorId: string,
	kind: CloneKind,
	id: number,
	picks: Record<string, string | null>,
	targets: { id: number; seen: string }[],
	shown: { id: number; seen: string }[],
	files: CloneFiles,
	now: number,
	freeDiskBytes: number
): Promise<SyncAllResult> {
	const fam = familyOf(db, actorId, kind, id);
	if (!fam || targets.length === 0) return DENIED;
	const editable = new Set(fam.editable.map((m) => m.id));
	if (targets.some((t) => !editable.has(t.id))) return DENIED;
	const ticked = new Map<number, string>();
	for (const t of targets) if (!ticked.has(t.id)) ticked.set(t.id, t.seen);

	const STALE = { ok: false, reason: 'stale', message: SYNC_STALE } as const;
	const sawThen = new Map(shown.map((m) => [m.id, m.seen]));
	if (sawThen.size !== fam.members.length || fam.members.some((m) => !sawThen.has(m.id)))
		return STALE;

	const refused: { id: number; message: string }[] = [];
	const stale = new Set<number>();
	const flats = new Map<number, Flat>();
	for (const m of fam.members) {
		const f = flatOf(db, kind, m.id);
		if (ticked.has(m.id)) {
			if (digest(f) !== ticked.get(m.id)) {
				stale.add(m.id);
				refused.push({ id: m.id, message: SYNC_STALE });
				continue;
			}
		} else if (digest(f) !== sawThen.get(m.id)) return STALE;
		flats.set(m.id, f);
	}
	const members = fam.members.filter((m) => !stale.has(m.id));
	const rows = members.length < 2 ? [] : rowsOf(db, actorId, kind, id, members, flats);
	const chosen: Record<string, string | null> = {};
	for (const [key, value] of Object.entries(picks)) chosen[currentKey(db, key)] = value;
	const open = unresolved(rows, chosen);
	if (open.length > 0) {
		// A pick naming a value the row no longer has (a stale copy's, left out
		// above): the sheet was out of date, not unpicked.
		if (open.some((key) => Object.hasOwn(chosen, key))) return STALE;
		return { ok: false, reason: 'pick', message: SYNC_PICK };
	}
	const plan = mergeTargets(rows, chosen, flats);

	const landed: number[] = [];
	const carried = new Map<number, string[]>();
	for (const [target, seen] of ticked) {
		if (stale.has(target)) continue;
		// Asked again: an earlier landing awaited, and a role may have changed meanwhile.
		if (accessTo(db, actorId, kind, target) !== 'edit') {
			refused.push({ id: target, message: SYNC_NO_ACCESS });
			continue;
		}
		let first = true;
		let ok = true;
		const keysIn: string[] = [];
		for (const g of plan.get(target) ?? []) {
			const keys = g.keys.map((k) => currentKey(db, k));
			let res;
			try {
				res = await landKeys(db, {
					actorId,
					kind,
					intoId: target,
					fromId: g.giver,
					keys,
					snapshot: 'keys',
					files,
					now,
					freeDiskBytes,
					seen: first ? seen : undefined
				});
			} catch (err) {
				// landKeys has unlinked what it linked and rolled back: this copy alone is refused.
				console.error(`Sync: ${kind} ${g.giver} → ${target} failed`, err);
				res = { ok: false as const, reason: 'failed' as const, message: SYNC_FAILED };
			}
			first = false;
			if (res.ok) keysIn.push(...keys);
			if (!res.ok) {
				refused.push({ id: target, message: res.reason === 'stale' ? SYNC_STALE : res.message });
				ok = false;
				break;
			}
		}
		if (ok) {
			landed.push(target);
			carried.set(target, keysIn);
		}
	}
	if (landed.length === 0) return { ok: true, refused };

	const refusedIds = new Set(refused.map((r) => r.id));
	db.transaction((t) => {
		const tx = t as unknown as Db;
		// The rows as the copies name their keys now: a landing may have stamped a piece's gene.
		const byKey = new Map(rows.map((r) => [currentKey(tx, r.key), r]));
		const after = new Map<number, Flat>();
		const flatNow = (m: number) => {
			if (!after.has(m)) after.set(m, flatOf(tx, kind, m));
			return after.get(m)!;
		};
		for (let i = 0; i < landed.length; i++)
			for (let j = i + 1; j < landed.length; j++) {
				const [a, b] = [landed[i], landed[j]];
				const base = snapshotOf(tx, pairBase(tx, kind, a, b), flatNow(a), flatNow(b), null);
				writePair(tx, kind, a, b, base, now);
			}
		const others = fam.members.filter((m) => !ticked.has(m.id) && !refusedIds.has(m.id));
		for (const a of landed)
			for (const o of others) {
				const prev = pairBase(tx, kind, a, o.id);
				if (!prev) continue;
				// Decided: the key's row was picked (no unticked box) and `a` holds the choice.
				const settled = (key: string) => {
					const row = deciding(byKey, key);
					const c = row ? choiceOf(row, chosen) : undefined;
					if (!row || c === undefined) return false;
					const f = flatNow(a);
					const k = currentKey(tx, row.key);
					return (Object.hasOwn(f, k) ? hashValue(f[k].value) : null) === c;
				};
				writePair(tx, kind, a, o.id, snapshotOf(tx, prev, flatNow(a), flatNow(o.id), settled), now);
			}
		for (const a of landed) markNow(tx, kind, a, now);
	});

	// On to the copies the person does not see: from each copy that landed whole.
	const gene = geneOf(db, kind, id);
	if (gene !== null) {
		const report = await flowOnward(
			db,
			actorId,
			kind,
			gene,
			landed.map((from) => ({ from, keys: carried.get(from) ?? [] })),
			fam.members.map((m) => m.id),
			files,
			now,
			freeDiskBytes
		);
		if (report.refused.length > 0)
			console.error(`Sync: ${kind} ${id}: ${report.refused.length} onward hop(s) refused`);
	}
	return { ok: true, refused };
}
