/**
 * Running the queue, for the person: what the Suggestions page does. Each line
 * is its own transaction through its kind's `run`, so a refusal rolls back
 * only that line and the run goes on; a refused line stays pending with its
 * reason. Actions run in queue order, an action after what it needs when both
 * are in the run. The status is read again inside the transaction, so two
 * taps (or two tabs) write once.
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db';
import { aiActions, aiLines } from '../db/schema';
import { flowAfter } from '../clones/flow-hook';
import { KINDS, type Refusal, type Who } from './kinds';
import { queueOf, type QueueAction, type QueueLine } from './store';
import { resolveRefs } from './refs';

export const UNDO_MS = 30 * 86_400_000;

export type RunReport = { done: number[]; refused: { lineId: number; refusal: Refusal }[] };

/** A refusal raised inside a line's transaction, to roll back whatever it wrote. */
class Refused extends Error {
	constructor(readonly refusal: Refusal) {
		super(refusal.code);
	}
}

const ordered = (db: Db, who: Who, now: number) =>
	queueOf(db, who.userId, who.dance, now).flatMap((g) => g.actions);

const working = (a: QueueAction) => a.lines.filter((l) => l.status !== 'left_out');
const isDone = (a: QueueAction) => {
	const w = working(a);
	return w.length > 0 && w.every((l) => l.status === 'done');
};
const isPending = (a: QueueAction) => a.lines.some((l) => l.status === 'pending');
const isGone = (a: QueueAction) =>
	a.lines.every((l) => l.status === 'dropped' || l.status === 'withdrawn');

/** Every action's id → the id its first create made (refs resolve to these). */
function createdIds(actions: QueueAction[]): Map<number, number> {
	const out = new Map<number, number>();
	for (const a of actions) {
		const made = a.lines.find(
			(l) => l.status === 'done' && l.result && typeof l.result.id === 'number'
		);
		if (made) out.set(a.id, made.result!.id as number);
	}
	return out;
}

function saveRefusal(db: Db, lineId: number, refusal: Refusal) {
	db.update(aiLines)
		.set({ refusal: JSON.stringify(refusal) })
		.where(eq(aiLines.id, lineId))
		.run();
}

/** One line, in its own transaction; null when it was no longer pending. */
function runLine(
	db: Db,
	who: Who,
	line: QueueLine,
	created: Map<number, number>,
	now: number
): { ok: true; result: Record<string, unknown> } | { ok: false; refusal: Refusal } | null {
	const kind = KINDS[line.kind];
	try {
		return db.transaction((tx) => {
			const fresh = tx
				.select({ status: aiLines.status })
				.from(aiLines)
				.where(eq(aiLines.id, line.id))
				.get();
			if (fresh?.status !== 'pending') return null;
			const payload = resolveRefs(line.payload, created) as Record<string, unknown>;
			if (payload && 'missing' in payload && Object.keys(payload).length === 1)
				throw new Refused({ code: 'dependsOn', args: { n: Number(payload.missing) } });
			if (!kind) throw new Refused({ code: 'gone' });
			const r = kind.run(tx, who, payload, line.before, now);
			if (!r.ok) throw new Refused(r.refusal);
			tx.update(aiLines)
				.set({ status: 'done', result: JSON.stringify(r.result), ranAt: now, refusal: null })
				.where(eq(aiLines.id, line.id))
				.run();
			return r;
		});
	} catch (e) {
		if (e instanceof Refused) {
			saveRefusal(db, line.id, e.refusal);
			return { ok: false, refusal: e.refusal };
		}
		console.error(`[ai-queue] ${line.kind} line ${line.id} failed`, e);
		const refusal = { code: 'failed' };
		saveRefusal(db, line.id, refusal);
		return { ok: false, refusal };
	}
}

async function flowFor(
	db: Db,
	who: Who,
	line: QueueLine,
	created: Map<number, number>,
	result: Record<string, unknown>
) {
	const kind = KINDS[line.kind];
	const payload = resolveRefs(line.payload, created);
	const root = kind?.flows(db, payload, result);
	if (root) await flowAfter(who.userId, root.kind, root.id);
}

/**
 * Run these actions (the person's own, pending), `versions` being what the
 * page showed: an action the AI changed since refuses `claudeChanged` whole.
 */
export async function runActions(
	db: Db,
	who: Who,
	ids: number[],
	versions: Record<number, number>,
	now: number
): Promise<RunReport> {
	const report: RunReport = { done: [], refused: [] };
	const asked = new Set(ids);
	const refuseAll = (a: QueueAction, refusal: Refusal) => {
		for (const l of a.lines.filter((x) => x.status === 'pending')) {
			saveRefusal(db, l.id, refusal);
			report.refused.push({ lineId: l.id, refusal });
		}
	};
	const settled = new Set<number>();
	for (;;) {
		const all = ordered(db, who, now);
		const byId = new Map(all.map((a) => [a.id, a]));
		const todo = all.filter((a) => asked.has(a.id) && !settled.has(a.id) && isPending(a));
		if (!todo.length) break;
		let progress = false;
		const postponed: { a: QueueAction; on: QueueAction }[] = [];
		/** Settled in this pass: `all` does not show what they did yet. */
		const thisPass = new Set<number>();
		for (const a of todo) {
			if (versions[a.id] !== a.version) {
				refuseAll(a, { code: 'claudeChanged' });
			} else {
				const gone = a.needs.find((id) => !byId.get(id) || isGone(byId.get(id)!));
				const waiting = a.needs.map((id) => byId.get(id)!).find((n) => n && !isDone(n));
				if (gone !== undefined) {
					refuseAll(a, { code: 'dependsOn', args: { n: byId.get(gone)?.n ?? 0 } });
				} else if (
					waiting &&
					asked.has(waiting.id) &&
					(thisPass.has(waiting.id) || (!settled.has(waiting.id) && isPending(waiting)))
				) {
					// What it needs is in this run (later in the queue, or just run): the next pass.
					postponed.push({ a, on: waiting });
					continue;
				} else if (waiting) {
					const code = waiting.lines.some((l) => l.refusal) ? 'dependsOn' : 'waits';
					refuseAll(a, { code, args: { n: waiting.n } });
				} else {
					const created = createdIds(all);
					for (const line of a.lines.filter((l) => l.status === 'pending')) {
						const r = runLine(db, who, line, created, now);
						if (r === null) continue;
						if (r.ok) {
							report.done.push(line.id);
							if (typeof r.result.id === 'number') created.set(a.id, r.result.id);
							await flowFor(db, who, line, created, r.result);
						} else report.refused.push({ lineId: line.id, refusal: r.refusal });
					}
				}
			}
			settled.add(a.id);
			thisPass.add(a.id);
			progress = true;
		}
		if (!progress) {
			// Each waits on another that waits too: nothing can run.
			for (const { a, on } of postponed) refuseAll(a, { code: 'waits', args: { n: on.n } });
			break;
		}
	}
	return report;
}

const pendingIds = (actions: QueueAction[]) => actions.filter(isPending).map((a) => a.id);

/** The pending actions in queue order, up to and including `id`. */
export function actionsUpTo(db: Db, who: Who, id: number, now = 0): number[] {
	const all = ordered(db, who, now);
	const at = all.findIndex((a) => a.id === id);
	return at < 0 ? [] : pendingIds(all.slice(0, at + 1));
}

export function actionsOfGroup(db: Db, who: Who, groupId: number, now = 0): number[] {
	return pendingIds(ordered(db, who, now).filter((a) => a.groupId === groupId));
}

export function allPending(db: Db, who: Who, now = 0): number[] {
	return pendingIds(ordered(db, who, now));
}

/**
 * Drop these actions. When pending actions need one of them and
 * `withDependents` is false, nothing is dropped and they are named, for the
 * page to ask; with it, they are dropped too.
 */
export function dropActions(
	db: Db,
	who: Who,
	ids: number[],
	withDependents: boolean,
	now: number
): { dropped: number[]; dependents: number[] } {
	const all = ordered(db, who, now).filter(isPending);
	const drop = new Set(ids.filter((id) => all.some((a) => a.id === id)));
	const dependents: number[] = [];
	for (let grew = true; grew;) {
		grew = false;
		for (const a of all)
			if (!drop.has(a.id) && a.needs.some((n) => drop.has(n))) {
				drop.add(a.id);
				dependents.push(a.id);
				grew = true;
			}
	}
	if (dependents.length && !withDependents) return { dropped: [], dependents };
	const list = [...drop];
	if (list.length)
		db.update(aiLines)
			.set({ status: 'dropped' })
			.where(and(inArray(aiLines.actionId, list), inArray(aiLines.status, ['pending', 'left_out'])))
			.run();
	return { dropped: list, dependents: [] };
}

/** The person's own line, by id, with its action. */
function ownLine(db: Db, who: Who, lineId: number) {
	return db
		.select({ line: aiLines, action: aiActions })
		.from(aiLines)
		.innerJoin(aiActions, eq(aiActions.id, aiLines.actionId))
		.where(
			and(eq(aiLines.id, lineId), eq(aiActions.userId, who.userId), eq(aiActions.dance, who.dance))
		)
		.get();
}

/** Leave a line of a batched action out of its run, or put it back. */
export function toggleLine(db: Db, who: Who, lineId: number, now: number): { ok: boolean } {
	void now;
	const row = ownLine(db, who, lineId);
	if (!row || !['pending', 'left_out'].includes(row.line.status)) return { ok: false };
	db.update(aiLines)
		.set({ status: row.line.status === 'pending' ? 'left_out' : 'pending' })
		.where(eq(aiLines.id, lineId))
		.run();
	return { ok: true };
}

/** Undo done lines, newest first: what each kind's Undo does, for 30 days. */
export async function undoLines(
	db: Db,
	who: Who,
	lineIds: number[],
	now: number
): Promise<RunReport> {
	const report: RunReport = { done: [], refused: [] };
	const rows = lineIds
		.map((id) => ownLine(db, who, id))
		.filter((r): r is NonNullable<typeof r> => !!r && r.line.status === 'done')
		.sort((a, b) => (b.line.ranAt ?? 0) - (a.line.ranAt ?? 0) || b.line.id - a.line.id);
	for (const { line } of rows) {
		const kind = KINDS[line.kind];
		const payload = JSON.parse(line.payload);
		const result = JSON.parse(line.result ?? '{}');
		const refuse = (refusal: Refusal) => report.refused.push({ lineId: line.id, refusal });
		if (!kind?.undo) {
			refuse({ code: 'noUndo' });
			continue;
		}
		if (now - (line.ranAt ?? 0) > UNDO_MS) {
			refuse({ code: 'tooLate' });
			continue;
		}
		const undo = kind.undo;
		try {
			db.transaction((tx) => {
				const fresh = tx
					.select({ status: aiLines.status })
					.from(aiLines)
					.where(eq(aiLines.id, line.id))
					.get();
				if (fresh?.status !== 'done') throw new Refused({ code: 'gone' });
				const r = undo(tx, who, payload, result, now);
				if (!r.ok) throw new Refused(r.refusal);
				tx.update(aiLines)
					.set({ status: 'undone', undoneAt: now })
					.where(eq(aiLines.id, line.id))
					.run();
			});
			report.done.push(line.id);
			const root = kind.flows(db, payload, result);
			if (root) await flowAfter(who.userId, root.kind, root.id);
		} catch (e) {
			if (!(e instanceof Refused)) throw e;
			refuse(e.refusal);
		}
	}
	return report;
}
