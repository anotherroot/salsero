/**
 * Keep in step: the flow after a save. What one save changed on a copy is
 * carried into the other copies of its family by itself, hop by hop through
 * the copies that have a snapshot with each other (a person's own copy and a
 * club's copy; two people's own copies never pair, so a change between
 * them always travels through a club's copy both read).
 *
 * The algorithm, for the saved row X:
 *
 * 1. `saved` = the keys whose value moved since X's mark (`changedKeys`).
 *    No mark: X is marked, and nothing flows (it cannot know what this save
 *    changed). Otherwise X is marked first, in a small transaction of its
 *    own, so the next save sees only its own change even when this flow is
 *    stopped or refused. Nothing flows when `saved` is empty or X's switch
 *    is off.
 * 2. A queue starts at `(X, saved)`, `visited = {X}`. For a node N and the
 *    keys it carries, every live member Y of the family (`familyRows`: every
 *    owner's, not only what the actor sees) not yet visited, that has a pair
 *    snapshot with N, whose switch is on, and that may be written:
 *    - a group's Y: when the actor (whose save started it) edits Y; History
 *      files it under the actor (`landKeys` logs it);
 *    - a person's own Y: when that person still reads N, acting as them (as
 *      if they pulled it themselves). So a member who only reads the club's
 *      copy only ever pulls: their own save never reaches the club.
 *    The keys that go are `flowKeys(keys, diff(base(N, Y), Y, N), Y's
 *    settings)`: carried by this save, changed only on N's side since the
 *    two were last in step, allowed by Y's options, not a copy's name suffix.
 *    None: skipped. Else `landKeys` with `snapshot: 'keys'` (the pair's
 *    snapshot moves for those keys only, so a field still disputed stays
 *    disputed; Y's mark becomes what it holds after the landing, so its own
 *    next save does not send back what came in).
 * 3. A landing is visited and enqueued with exactly the keys that landed. A
 *    refusal (a linked section, no room, a save on Y meanwhile) is visited too (each
 *    copy is considered once per save) and goes into `refused`; nothing goes
 *    on from it, and every other hop still lands. A thrown error is not
 *    swallowed.
 * 4. Keys are read as the rows name them at each hop (`currentKey`): a hop
 *    that copies a new recording stamps its gene, so `rec:#7` becomes
 *    `rec:<gene>`. X's mark is read the same way, so a stamp made anywhere
 *    (a Send, a Sync, a hop that threw) is not mistaken for a change; after a
 *    flow every visited copy's mark is also renamed (`rekeyMark`, hashes kept).
 * 5. Each hop carries `seen` (Y's digest when its keys were read): a save
 *    on Y that lands while the hop's files link refuses the hop as `stale`.
 *
 * Each copy is written at most once per save (the visited set), so nothing
 * loops. Each hop is its own transaction (`landKeys`), as a recording's file
 * is linked before its write.
 *
 * The report's ids include other people's own copies: callers decide what to
 * show, and must not show those. Nothing here writes anything the saver can
 * see about another person's own copy (writes into a person's own copy log
 * nothing).
 */
import type { CloneKind } from '$lib/types';
import { diff } from '$lib/clones/diff';
import { changedKeys, flowKeys } from '$lib/clones/sync';
import type { Db } from '../db';
import { currentKey, landKeys, type DiskBytes } from './apply';
import type { CloneFiles } from './files';
import { accessTo, familyRows, geneOf, type FamilyRow } from './genes';
import { markNow, readMark, rekeyMark } from './marks';
import { digest, hashValue, pairBase } from './pairs';
import { syncSettingsOf } from './sync-settings';
import { flatOf } from './trees';

export type FlowReport = {
	/** The copies written, in the order they landed (each at most once). */
	landed: number[];
	/** The copies a hop was refused into, with `SyncResult`'s reason. */
	refused: { id: number; reason: string }[];
};

/** Whether the flow may write into `y` from `from`, and as whom. */
export function writerFor(
	db: Db,
	actorId: string,
	kind: CloneKind,
	y: FamilyRow,
	from: number
): string | null {
	if (y.teamId !== null) return accessTo(db, actorId, kind, y.id) === 'edit' ? actorId : null;
	if (y.userId === null) return null;
	return accessTo(db, y.userId, kind, from) !== null ? y.userId : null;
}

/**
 * Carry what the save of `id` (by `actorId`) changed into the other copies of
 * its family (see the module's comment). Call it after the save's
 * transaction has committed.
 */
export async function flowFrom(
	db: Db,
	actorId: string,
	kind: CloneKind,
	id: number,
	files: CloneFiles,
	now: number,
	freeDiskBytes: DiskBytes
): Promise<FlowReport> {
	const report: FlowReport = { landed: [], refused: [] };
	const gene = geneOf(db, kind, id);
	if (gene === null) return report;
	const self = familyRows(db, kind, gene).find((r) => r.id === id);
	if (!self || self.archivedAt !== null) return report;
	if (accessTo(db, actorId, kind, id) !== 'edit') return report;

	const saved = db.transaction((t) => {
		const tx = t as unknown as Db;
		const mark = readMark(tx, kind, id);
		const flat = flatOf(tx, kind, id);
		markNow(tx, kind, id, now);
		if (mark === null) return [];
		// Read the mark as the rows are named now: a copy made outside a flow (a
		// Send, a Sync, a hop that threw) may have stamped a gene on this row's piece.
		const named: Record<string, string> = {};
		for (const [key, hash] of Object.entries(mark)) named[currentKey(tx, key)] = hash;
		return changedKeys(named, flat, hashValue);
	});
	if (saved.length === 0 || !syncSettingsOf(db, kind, id).on) return report;
	return flowOnward(
		db,
		actorId,
		kind,
		gene,
		[{ from: id, keys: saved }],
		[id],
		files,
		now,
		freeDiskBytes
	);
}

/**
 * Steps 2–5 of the algorithm from given starts: each `from` carries exactly
 * `keys` (what just landed on it; its mark already fresh) into the copies
 * that have a snapshot with it, hop by hop. `visited` copies are never
 * written (each start, and any copy the caller has decided about: a Sync's
 * own copies). Exported for the Sync, whose landings flow on to the copies
 * the person does not see.
 */
export async function flowOnward(
	db: Db,
	actorId: string,
	kind: CloneKind,
	gene: string,
	starts: { from: number; keys: string[] }[],
	visitedIds: number[],
	files: CloneFiles,
	now: number,
	freeDiskBytes: DiskBytes
): Promise<FlowReport> {
	const report: FlowReport = { landed: [], refused: [] };
	const visited = new Set<number>([...visitedIds, ...starts.map((s) => s.from)]);
	const queue = starts.filter((s) => s.keys.length > 0).map((s) => ({ ...s }));
	while (queue.length > 0) {
		const { from, keys } = queue.shift()!;
		for (const y of familyRows(db, kind, gene)) {
			if (visited.has(y.id) || y.archivedAt !== null) continue;
			const base = pairBase(db, kind, from, y.id);
			if (!base) continue;
			const settings = syncSettingsOf(db, kind, y.id);
			if (!settings.on) continue;
			const writer = writerFor(db, actorId, kind, y, from);
			if (writer === null) continue;
			const carried = keys.map((k) => currentKey(db, k));
			const pair = diff(base, flatOf(db, kind, y.id), flatOf(db, kind, from), hashValue);
			const go = flowKeys(carried, pair, settings);
			if (go.length === 0) continue;
			// What Y held when `go` was read: a save on Y landing while files link is stale.
			const seen = digest(flatOf(db, kind, y.id));
			visited.add(y.id);
			const res = await landKeys(db, {
				actorId: writer,
				kind,
				intoId: y.id,
				fromId: from,
				keys: go,
				snapshot: 'keys',
				files,
				now,
				freeDiskBytes,
				seen
			});
			if (!res.ok) {
				report.refused.push({ id: y.id, reason: res.reason });
				continue;
			}
			report.landed.push(y.id);
			queue.push({ from: y.id, keys: go });
		}
	}

	db.transaction((t) => {
		const tx = t as unknown as Db;
		for (const v of visited) rekeyMark(tx, kind, v, (k) => currentKey(tx, k));
	});
	return report;
}
