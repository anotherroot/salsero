/*
 * The pull (offline phase 2): the rows of one person's scope that changed
 * since a device's cursor, and whole tables whose key-set digest differs from
 * the device's (a deleted row or a lost read leaves no log line that is in
 * scope, so the digest is what removes rows). One transaction, so the cursor,
 * the scope and the rows agree.
 */
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Db } from '../db';
import { digestInput, keyString } from '$lib/sync/digest';
import { SCHEMA_TAG } from '$lib/sync/schema-tag';
import type {
	ClonePairRow,
	PullRefusal,
	PullRequest,
	PullResponse,
	TableRows
} from '$lib/sync/wire';
import { changedSince, logHead, logOldest } from './log';
import { syncScope, type Row } from './scope';
import { slotFor } from './slots';
import { serverNow } from '../server-clock';

/** The sha256 hex of a table's sorted keys; the device computes the same with WebCrypto. */
export function serverDigest(keys: Iterable<string>): string {
	return createHash('sha256').update(digestInput(keys)).digest('hex');
}

function columnsOf(db: Db, table: string): string[] {
	return db
		.all<{ name: string }>(sql`SELECT name FROM pragma_table_info(${table})`)
		.map((c) => c.name);
}

/** `ua`: the device's user agent, kept with its slot (offline phase 4c: "On Pixel 8"). */
export function pull(
	db: Db,
	userId: string,
	req: PullRequest,
	ua?: string
): PullResponse | PullRefusal {
	if (req.schema !== SCHEMA_TAG) return { refused: 'schema', schema: SCHEMA_TAG };
	return db.transaction((tx) => {
		const head = logHead(tx);
		const oldest = logOldest(tx);
		const scope = syncScope(tx, userId);
		const digests = req.digests;
		const fresh =
			!digests ||
			req.userId !== userId ||
			req.cursor > head ||
			(req.cursor < head && (oldest === null || req.cursor < oldest - 1));

		const changedKeys = new Map<string, Set<string>>();
		if (!fresh) {
			for (const { tbl, key } of changedSince(tx, req.cursor)) {
				let set = changedKeys.get(tbl);
				if (!set) changedKeys.set(tbl, (set = new Set()));
				set.add(key);
				// A team's code is redacted by role, and the role is logged on team_members.
				if (tbl === 'team_members') {
					const teamId = (JSON.parse(key) as unknown[])[0];
					let teams = changedKeys.get('teams');
					if (!teams) changedKeys.set('teams', (teams = new Set()));
					teams.add(keyString([teamId]));
				}
			}
		}

		const full: string[] = [];
		const changed: Record<string, TableRows> = {};
		for (const [table, rows] of scope) {
			const isFull = fresh || digests![table] !== serverDigest(rows.keys());
			let send: Row[];
			if (isFull) {
				full.push(table);
				send = [...rows.values()];
			} else {
				const keys = changedKeys.get(table);
				send = keys ? [...keys].map((k) => rows.get(k)).filter((r): r is Row => !!r) : [];
			}
			if (send.length === 0 && !isFull) continue;
			const cols = columnsOf(tx, table);
			changed[table] = { cols, rows: send.map((r) => cols.map((c) => r[c] ?? null)) };
		}
		const out: PullResponse = {
			userId,
			cursor: head,
			schema: SCHEMA_TAG,
			full,
			changed,
			cookies: {},
			clonePairs: pairsIn(tx, scope)
		};
		// A device that names itself gets its id slot (offline phase 3).
		if (req.device !== undefined) out.slot = slotFor(tx, userId, req.device, serverNow(), ua);
		return out;
	});
}

/** Each clone kind's table. */
const PAIR_TABLE: Record<string, string> = {
	figure: 'figures',
	routine: 'routines',
	drill: 'exercises',
	song: 'songs',
	lesson: 'lessons',
	position: 'positions'
};

/** The clone pairs whose two rows are both in the person's scope (device first). */
function pairsIn(db: Db, scope: Map<string, Map<string, Row>>): ClonePairRow[] {
	return db
		.all<ClonePairRow>(sql`SELECT kind, a_id, b_id, base_json, at FROM clone_pairs`)
		.filter((p) => {
			const rows = scope.get(PAIR_TABLE[p.kind] ?? '');
			return !!rows && rows.has(String(p.a_id)) && rows.has(String(p.b_id));
		});
}
