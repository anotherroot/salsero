/*
 * The push (offline phase 3): a device's outbox entries, replayed in order as
 * the person, through the hook and the route's own action, each in one
 * transaction under the write gate. While an entry runs, `serverNow()` reads
 * when it was made and `mintId` hands out the device's ids
 * (`replay-context.ts`). A landed entry then gets "later edit wins, per field"
 * on the person's own rows (`merge.ts`), its change-log lines dated when it
 * was made, Keep in step's flows, and is remembered so a resend never runs it
 * twice. A refused entry is rolled back and answered with its reason; the
 * entries that depend on it are held, never run.
 */
import type Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import type { Db } from '../db';
import { slotOf } from '../db/ids';
import { SESSION_COOKIE } from '../auth';
import { flowAfter } from '../clones/flow-hook';
import { runReplaying, type ReplayContext } from '../replay-context';
import { EPOCH_HEADER, PAGE_EPOCH } from '$lib/page-epoch';
import { ACTIONS, ENDPOINT_WRITES, matchRoute, writeClass } from '$lib/offline/routes';
import {
	RECORDED_HEADERS,
	bytesOf,
	dependsOn,
	type EntryResult,
	type PushRequest,
	type PushResponse,
	type WireEntry
} from '$lib/sync/outbox';
import { GATE_WAIT_MS, writeGate, type WriteGate } from './gate';
import { isLanded, markLanded } from './landed';
import { logHead } from './log';
import { restoreOwnFields, snapshotRows } from './merge';
import { outcomeOf } from './outcome';
import { slotFor } from './slots';

export type Runner = (request: Request) => Promise<Response>;
export type ReplayOptions = {
	now: number;
	origin: string;
	/** writeGate when absent. */
	gate?: WriteGate;
	/** How long a replay waits for the gate; GATE_WAIT_MS when absent. */
	waitMs?: number;
};

const ACTION_IDS = Object.keys(ACTIONS);
const ENDPOINT_IDS = Object.keys(ENDPOINT_WRITES);

/** Whether the entry is a form action (answered as SvelteKit's action JSON), not an endpoint. */
function isActionEntry(method: string, url: URL): boolean {
	return (
		method.toUpperCase() === 'POST' &&
		matchRoute(url.pathname, ENDPOINT_IDS) === null &&
		matchRoute(url.pathname, ACTION_IDS) !== null
	);
}

/** Every cookie of the entry's header but the session: the push's own session signs the replay in. */
function withoutSession(cookie: string): string {
	return cookie
		.split(';')
		.map((p) => p.trim())
		.filter((p) => p && p.split('=')[0].trim() !== SESSION_COOKIE)
		.join('; ');
}

export function replayRequest(entry: WireEntry, origin: string): Request {
	const at = new URL(entry.url, origin);
	const url = new URL(at.pathname + at.search, origin);
	const headers = new Headers();
	const keep = new Set<string>(RECORDED_HEADERS);
	for (const [name, value] of entry.headers) {
		const k = name.toLowerCase();
		if (!keep.has(k)) continue;
		if (k === 'cookie') {
			const rest = withoutSession(value);
			if (rest) headers.set('cookie', rest);
			continue;
		}
		headers.set(k, value);
	}
	headers.set(EPOCH_HEADER, String(PAGE_EPOCH));
	// SvelteKit refuses a cross-site form post: the replay is this site's own.
	headers.set('origin', origin);
	if (isActionEntry(entry.method, url)) {
		// Answered as the action's JSON whatever the page sent, so a failure reads as one.
		headers.set('x-sveltekit-action', 'true');
		headers.set('accept', 'application/json');
	}
	const method = entry.method.toUpperCase();
	const body =
		entry.body !== null && method !== 'GET' && method !== 'HEAD' ? bytesOf(entry.body) : null;
	return new Request(url, { method, headers, body: body as BodyInit | null });
}

const refusedResult = (
	id: string,
	reason: Extract<EntryResult, { state: 'refused' }>['reason'],
	message: string | null = null
): EntryResult => ({ id, state: 'refused', reason, message, clash: null, gone: null });

function rawOf(db: Db): Database.Database {
	return (db as unknown as { $client: Database.Database }).$client;
}

async function replayInside(
	db: Db,
	run: Runner,
	userId: string,
	entry: WireEntry,
	o: ReplayOptions
): Promise<EntryResult> {
	if (isLanded(db, entry.id, userId)) return { id: entry.id, state: 'landed' };
	const raw = rawOf(db);
	const madeAt = Math.min(entry.madeAt, o.now);
	const seqBefore = logHead(db);
	const snap = snapshotRows(db, entry.rows);
	const ctx: ReplayContext = {
		entryId: entry.id,
		madeAt,
		minted: new Map(Object.entries(entry.minted).map(([t, ids]) => [t, [...ids]])),
		flows: [],
		deferFlows: true
	};
	const request = replayRequest(entry, o.origin);
	const isAction = isActionEntry(request.method, new URL(request.url));
	raw.exec('BEGIN IMMEDIATE');
	try {
		const res = await runReplaying(ctx, () => run(request));
		const outcome = await outcomeOf(res, isAction);
		if (!outcome.landed) {
			raw.exec('ROLLBACK');
			const { reason, message, clash, gone } = outcome;
			return { id: entry.id, state: 'refused', reason, message, clash, gone };
		}
		restoreOwnFields(db, entry.rows, snap, madeAt);
		db.run(sql`UPDATE change_log SET at = ${madeAt} WHERE seq > ${seqBefore}`);
		ctx.minted.clear();
		ctx.deferFlows = false;
		await runReplaying(ctx, async () => {
			for (const f of ctx.flows) await flowAfter(f.actorId, f.kind, f.id);
		});
		markLanded(db, entry.id, userId, o.now);
		raw.exec('COMMIT');
		return { id: entry.id, state: 'landed' };
	} catch (e) {
		if (raw.inTransaction) raw.exec('ROLLBACK');
		console.error(`[sync] entry ${entry.id}: ${e instanceof Error ? e.message : String(e)}`);
		return refusedResult(entry.id, 'error');
	}
}

/** One entry, alone under the write gate; `deferred` when the gate was not free in time. */
export async function replayEntry(
	db: Db,
	run: Runner,
	userId: string,
	slot: number,
	entry: WireEntry,
	o: ReplayOptions
): Promise<EntryResult> {
	void slot;
	const gate = o.gate ?? writeGate;
	const r = await gate.exclusive(
		() => replayInside(db, run, userId, entry, o),
		o.waitMs ?? GATE_WAIT_MS
	);
	return r.ran ? r.value : { id: entry.id, state: 'deferred' };
}

/** Takes the device's slot itself (`slotFor(db, userId, req.device, o.now)`). */
export async function push(
	db: Db,
	run: Runner,
	userId: string,
	req: PushRequest,
	o: ReplayOptions
): Promise<PushResponse> {
	const slot = slotFor(db, userId, req.device, o.now);
	const results: EntryResult[] = [];
	/** Refused or held entries of this push, and the refused root each one waits on. */
	const blocked: { entry: WireEntry; root: string }[] = [];
	for (let i = 0; i < req.entries.length; i++) {
		const entry = req.entries[i];
		const on = blocked.find((b) => dependsOn(entry, b.entry));
		if (on) {
			results.push({ id: entry.id, state: 'held', heldBy: on.root });
			blocked.push({ entry, root: on.root });
			continue;
		}
		let result: EntryResult;
		const url = new URL(entry.url, o.origin);
		const cls = writeClass(entry.method, url);
		if (entry.epoch !== PAGE_EPOCH) result = refusedResult(entry.id, 'stale');
		else if (cls !== 'device' && cls !== 'queued') result = refusedResult(entry.id, 'not-allowed');
		else if (
			Object.values(entry.minted)
				.flat()
				.some((id) => slotOf(id) !== slot)
		) {
			result = refusedResult(entry.id, 'bad-ids');
		} else {
			result = await replayEntry(db, run, userId, slot, entry, o);
			if (result.state === 'deferred') {
				for (const rest of req.entries.slice(i)) results.push({ id: rest.id, state: 'deferred' });
				break;
			}
		}
		if (result.state === 'refused') blocked.push({ entry, root: entry.id });
		results.push(result);
	}
	return { slot, results };
}
