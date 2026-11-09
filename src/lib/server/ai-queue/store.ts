/**
 * The AI's queue of actions: what the AI may do to it (propose, change,
 * withdraw, move, group). Nothing here runs a change; `run.ts` does, for the
 * person. Messages are for the AI: English, one line it can correct from.
 *
 * Another person's or another dance's id answers exactly as a missing one.
 */
import { and, asc, eq, inArray, max, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { aiActions, aiGroups, aiLines } from '../db/schema';
import { KINDS, type Refusal, type Who } from './kinds';
import { refsOf } from './refs';

export const MAX_LINES = 50;
export const MAX_PENDING = 500;
export const KEEP_DONE_MS = 30 * 86_400_000;
const TITLE_MAX = 200;
const GROUP_TITLE_MAX = 100;

export type LineIn = { kind: string; [k: string]: unknown };
export type ActionIn = {
	group: { id: number } | { title: string };
	title: string;
	lines: LineIn[];
	needs?: number[];
};
type Fail = { ok: false; message: string };
type Done = { ok: true } | Fail;

export type LineStatus = 'pending' | 'left_out' | 'done' | 'dropped' | 'withdrawn' | 'undone';
export interface QueueLine {
	id: number;
	sort: number;
	kind: string;
	payload: Record<string, unknown>;
	before: Record<string, unknown> | null;
	status: LineStatus;
	refusal: Refusal | null;
	result: Record<string, unknown> | null;
	ranAt: number | null;
	undoneAt: number | null;
}
export interface QueueAction {
	id: number;
	/** Its number on the page, counted across groups in queue order. */
	n: number;
	groupId: number;
	title: string;
	needs: number[];
	version: number;
	previous: { title: string; lines: { kind: string; payload: unknown }[] } | null;
	grantId: number | null;
	createdAt: number;
	updatedAt: number;
	lines: QueueLine[];
}
export interface QueueGroup {
	id: number;
	title: string;
	actions: QueueAction[];
}

const fail = (message: string): Fail => ({ ok: false, message });
const noAction = (id: number) => fail(`No action with id ${id}.`);
const noGroup = (id: number) => fail(`No group with id ${id}.`);
const json = (s: string | null) => (s === null ? null : JSON.parse(s));
const OPEN: LineStatus[] = ['pending', 'left_out'];

function ownAction(db: Db, who: Who, id: number) {
	return db
		.select()
		.from(aiActions)
		.where(
			and(eq(aiActions.id, id), eq(aiActions.userId, who.userId), eq(aiActions.dance, who.dance))
		)
		.get();
}
function ownGroup(db: Db, who: Who, id: number) {
	return db
		.select()
		.from(aiGroups)
		.where(and(eq(aiGroups.id, id), eq(aiGroups.userId, who.userId), eq(aiGroups.dance, who.dance)))
		.get();
}
const linesOf = (db: Db, actionId: number) =>
	db.select().from(aiLines).where(eq(aiLines.actionId, actionId)).orderBy(asc(aiLines.sort)).all();

/** Every line through its kind's `parse` and `prepare`; the rows to store, or the first refusal. */
function prepareLines(
	db: Db,
	who: Who,
	lines: unknown
):
	{ ok: true; rows: { kind: string; payload: unknown; before: unknown }[]; refs: number[] } | Fail {
	if (!Array.isArray(lines) || lines.length === 0 || lines.length > MAX_LINES)
		return fail(`lines must be a list of 1 to ${MAX_LINES} changes.`);
	const rows = [];
	const refs: number[] = [];
	for (const [i, raw] of lines.entries()) {
		if (!raw || typeof raw !== 'object' || Array.isArray(raw))
			return fail(`Line ${i + 1} must be an object with a kind.`);
		const { kind, ...rest } = raw as LineIn;
		const k = KINDS[kind];
		if (!k) return fail(`Line ${i + 1}: kind must be one of: ${Object.keys(KINDS).join(', ')}.`);
		const parsed = k.parse(rest);
		if (!parsed.ok) return fail(`Line ${i + 1} (${kind}): ${parsed.message}`);
		const prepared = k.prepare(db, who, parsed.args);
		if (!prepared.ok) return fail(`Line ${i + 1} (${kind}): ${prepared.message}`);
		rows.push({ kind, payload: parsed.args, before: prepared.before });
		refs.push(...refsOf(parsed.args));
	}
	return { ok: true, rows, refs };
}

/** `needs` and refs: the person's own existing actions, nothing withdrawn or dropped. */
function checkNeeds(db: Db, who: Who, ids: number[]): Fail | null {
	for (const id of ids) {
		if (!Number.isInteger(id) || !ownAction(db, who, id)) return noAction(id);
		const live = linesOf(db, id).some((l) => !['withdrawn', 'dropped'].includes(l.status));
		if (!live) return noAction(id);
	}
	return null;
}

function pendingCount(db: Db, who: Who): number {
	const row = db
		.select({ n: sql<number>`count(*)` })
		.from(aiLines)
		.innerJoin(aiActions, eq(aiActions.id, aiLines.actionId))
		.where(
			and(
				eq(aiActions.userId, who.userId),
				eq(aiActions.dance, who.dance),
				inArray(aiLines.status, OPEN)
			)
		)
		.get();
	return Number(row?.n ?? 0);
}

const nextSort = (
	db: Db,
	table: typeof aiGroups | typeof aiActions,
	where: ReturnType<typeof and>
) =>
	Number(
		db
			.select({ m: max(table.sort) })
			.from(table)
			.where(where)
			.get()?.m ?? 0
	) + 1;

function insertLines(
	db: Db,
	actionId: number,
	rows: { kind: string; payload: unknown; before: unknown }[]
) {
	rows.forEach((r, i) =>
		db
			.insert(aiLines)
			.values({
				actionId,
				sort: i + 1,
				kind: r.kind,
				payload: JSON.stringify(r.payload),
				before: r.before === null ? null : JSON.stringify(r.before)
			})
			.run()
	);
}

const titleOk = (t: unknown, maxLen: number): t is string =>
	typeof t === 'string' && t.trim() !== '' && t.length <= maxLen;

export function propose(
	db: Db,
	who: Who,
	input: ActionIn,
	now: number
): { ok: true; actionId: number } | Fail {
	if (!titleOk(input.title, TITLE_MAX))
		return fail(`title must be text of 1 to ${TITLE_MAX} characters.`);
	const prepared = prepareLines(db, who, input.lines);
	if (!prepared.ok) return prepared;
	if (pendingCount(db, who) + prepared.rows.length > MAX_PENDING)
		return fail(
			`The queue holds at most ${MAX_PENDING} waiting changes. Let the person run or drop some first.`
		);
	const needs = [...new Set([...(input.needs ?? []), ...prepared.refs])];
	const bad = checkNeeds(db, who, needs);
	if (bad) return bad;

	return db.transaction((tx) => {
		let groupId: number;
		if ('id' in input.group) {
			if (!ownGroup(tx, who, input.group.id)) return noGroup(input.group.id);
			groupId = input.group.id;
		} else {
			if (!titleOk(input.group.title, GROUP_TITLE_MAX))
				return fail(`A group title must be text of 1 to ${GROUP_TITLE_MAX} characters.`);
			groupId = tx
				.insert(aiGroups)
				.values({
					userId: who.userId,
					dance: who.dance,
					title: input.group.title.trim(),
					sort: nextSort(
						tx,
						aiGroups,
						and(eq(aiGroups.userId, who.userId), eq(aiGroups.dance, who.dance))
					),
					createdAt: now,
					updatedAt: now
				})
				.returning({ id: aiGroups.id })
				.get().id;
		}
		const actionId = tx
			.insert(aiActions)
			.values({
				userId: who.userId,
				dance: who.dance,
				groupId,
				sort: nextSort(tx, aiActions, eq(aiActions.groupId, groupId)),
				title: input.title.trim(),
				grantId: who.grantId,
				needs: JSON.stringify(needs),
				createdAt: now,
				updatedAt: now
			})
			.returning({ id: aiActions.id })
			.get().id;
		insertLines(tx, actionId, prepared.rows);
		return { ok: true as const, actionId };
	});
}

/** Only while nothing of it has run or been dropped. */
function stillOpen(db: Db, who: Who, id: number): Fail | null {
	const a = ownAction(db, who, id);
	if (!a) return noAction(id);
	const lines = linesOf(db, id);
	if (lines.every((l) => l.status === 'withdrawn')) return noAction(id);
	if (!lines.every((l) => OPEN.includes(l.status as LineStatus)))
		return fail(`Action ${id} has been run or dropped in part; propose a new one instead.`);
	return null;
}

export function changeAction(
	db: Db,
	who: Who,
	id: number,
	change: { title?: string; lines?: LineIn[]; needs?: number[]; groupId?: number },
	now: number
): Done {
	const closed = stillOpen(db, who, id);
	if (closed) return closed;
	if (change.title !== undefined && !titleOk(change.title, TITLE_MAX))
		return fail(`title must be text of 1 to ${TITLE_MAX} characters.`);
	const prepared = change.lines === undefined ? null : prepareLines(db, who, change.lines);
	if (prepared && !prepared.ok) return prepared;
	const a = ownAction(db, who, id)!;
	const oldLines = linesOf(db, id);
	const refs = prepared ? prepared.refs : oldLines.flatMap((l) => refsOf(json(l.payload)));
	const needs = [...new Set([...(change.needs ?? json(a.needs)), ...refs])];
	if (needs.includes(id)) return fail(`Action ${id} cannot need itself.`);
	const bad = checkNeeds(db, who, needs);
	if (bad) return bad;
	if (change.groupId !== undefined && !ownGroup(db, who, change.groupId))
		return noGroup(change.groupId);

	db.transaction((tx) => {
		const moved = change.groupId !== undefined && change.groupId !== a.groupId;
		tx.update(aiActions)
			.set({
				title: change.title?.trim() ?? a.title,
				needs: JSON.stringify(needs),
				version: a.version + 1,
				previous: JSON.stringify({
					title: a.title,
					lines: oldLines.map((l) => ({ kind: l.kind, payload: json(l.payload) }))
				}),
				updatedAt: now,
				...(moved
					? {
							groupId: change.groupId,
							sort: nextSort(tx, aiActions, eq(aiActions.groupId, change.groupId!))
						}
					: {})
			})
			.where(eq(aiActions.id, id))
			.run();
		if (prepared) {
			tx.delete(aiLines).where(eq(aiLines.actionId, id)).run();
			insertLines(tx, id, prepared.rows);
		}
	});
	return { ok: true };
}

export function withdrawAction(db: Db, who: Who, id: number, now: number): Done {
	const closed = stillOpen(db, who, id);
	if (closed) return closed;
	db.transaction((tx) => {
		tx.update(aiLines)
			.set({ status: 'withdrawn' })
			.where(and(eq(aiLines.actionId, id), inArray(aiLines.status, OPEN)))
			.run();
		tx.update(aiActions).set({ updatedAt: now }).where(eq(aiActions.id, id)).run();
	});
	return { ok: true };
}

/** Renumber `ids` as 1..n in this order. */
function renumber(db: Db, table: typeof aiGroups | typeof aiActions, ids: number[]) {
	ids.forEach((id, i) =>
		db
			.update(table)
			.set({ sort: i + 1 })
			.where(eq(table.id, id))
			.run()
	);
}

/** `list` without `id`, with `id` put before `before` (or last). */
const placed = (list: number[], id: number, before: number | null | undefined) => {
	const rest = list.filter((x) => x !== id);
	const at = before === null || before === undefined ? -1 : rest.indexOf(before);
	return at < 0 ? [...rest, id] : [...rest.slice(0, at), id, ...rest.slice(at)];
};

export function moveAction(
	db: Db,
	who: Who,
	id: number,
	to: { groupId?: number; before?: number | null },
	now: number
): Done {
	const a = ownAction(db, who, id);
	if (!a) return noAction(id);
	const groupId = to.groupId ?? a.groupId;
	if (!ownGroup(db, who, groupId)) return noGroup(groupId);
	if (to.before !== undefined && to.before !== null) {
		const b = ownAction(db, who, to.before);
		if (!b) return noAction(to.before);
		if (b.groupId !== groupId) return fail(`Action ${to.before} is not in group ${groupId}.`);
	}
	db.transaction((tx) => {
		tx.update(aiActions).set({ groupId, updatedAt: now }).where(eq(aiActions.id, id)).run();
		const order = tx
			.select({ id: aiActions.id })
			.from(aiActions)
			.where(eq(aiActions.groupId, groupId))
			.orderBy(asc(aiActions.sort), asc(aiActions.id))
			.all()
			.map((r) => r.id);
		renumber(tx, aiActions, placed(order, id, to.before));
	});
	return { ok: true };
}

export function setGroup(
	db: Db,
	who: Who,
	g: { id?: number; title: string; before?: number | null },
	now: number
): { ok: true; groupId: number } | Fail {
	if (!titleOk(g.title, GROUP_TITLE_MAX))
		return fail(`title must be text of 1 to ${GROUP_TITLE_MAX} characters.`);
	if (g.id !== undefined && !ownGroup(db, who, g.id)) return noGroup(g.id);
	if (g.before !== undefined && g.before !== null && !ownGroup(db, who, g.before))
		return noGroup(g.before);
	const mine = and(eq(aiGroups.userId, who.userId), eq(aiGroups.dance, who.dance));
	return db.transaction((tx) => {
		let id = g.id;
		if (id === undefined) {
			id = tx
				.insert(aiGroups)
				.values({
					userId: who.userId,
					dance: who.dance,
					title: g.title.trim(),
					sort: nextSort(tx, aiGroups, mine),
					createdAt: now,
					updatedAt: now
				})
				.returning({ id: aiGroups.id })
				.get().id;
		} else {
			tx.update(aiGroups)
				.set({ title: g.title.trim(), updatedAt: now })
				.where(eq(aiGroups.id, id))
				.run();
		}
		if (g.before !== undefined) {
			const order = tx
				.select({ id: aiGroups.id })
				.from(aiGroups)
				.where(mine)
				.orderBy(asc(aiGroups.sort), asc(aiGroups.id))
				.all()
				.map((r) => r.id);
			renumber(tx, aiGroups, placed(order, id, g.before));
		}
		return { ok: true as const, groupId: id };
	});
}

export function removeGroup(db: Db, who: Who, id: number, now: number): Done {
	if (!ownGroup(db, who, id)) return noGroup(id);
	db.transaction((tx) => {
		const actions = tx
			.select({ id: aiActions.id })
			.from(aiActions)
			.where(eq(aiActions.groupId, id))
			.all();
		for (const a of actions)
			tx.update(aiLines)
				.set({ status: 'withdrawn' })
				.where(and(eq(aiLines.actionId, a.id), inArray(aiLines.status, OPEN)))
				.run();
		tx.update(aiGroups).set({ updatedAt: now }).where(eq(aiGroups.id, id)).run();
	});
	return { ok: true };
}

/**
 * The queue as the page and the AI see it: groups in order, their actions in
 * order and numbered across groups, their lines; withdrawn lines are gone, and
 * done or undone ones after 30 days. Empty actions and groups are left out.
 */
export function queueOf(db: Db, userId: string, dance: string, now: number): QueueGroup[] {
	const groups = db
		.select()
		.from(aiGroups)
		.where(and(eq(aiGroups.userId, userId), eq(aiGroups.dance, dance)))
		.orderBy(asc(aiGroups.sort), asc(aiGroups.id))
		.all();
	const actions = db
		.select()
		.from(aiActions)
		.where(and(eq(aiActions.userId, userId), eq(aiActions.dance, dance)))
		.orderBy(asc(aiActions.sort), asc(aiActions.id))
		.all();
	const ids = actions.map((a) => a.id);
	const lines = ids.length
		? db
				.select()
				.from(aiLines)
				.where(inArray(aiLines.actionId, ids))
				.orderBy(asc(aiLines.sort))
				.all()
		: [];
	const shown = (l: (typeof lines)[number]) =>
		l.status !== 'withdrawn' &&
		!(
			(l.status === 'done' || l.status === 'undone') &&
			now - (l.undoneAt ?? l.ranAt ?? now) > KEEP_DONE_MS
		);

	let n = 0;
	const out: QueueGroup[] = [];
	for (const g of groups) {
		const acts: QueueAction[] = [];
		for (const a of actions.filter((x) => x.groupId === g.id)) {
			const ls = lines.filter((l) => l.actionId === a.id && shown(l));
			if (!ls.length) continue;
			acts.push({
				id: a.id,
				n: ++n,
				groupId: g.id,
				title: a.title,
				needs: json(a.needs),
				version: a.version,
				previous: json(a.previous),
				grantId: a.grantId,
				createdAt: a.createdAt,
				updatedAt: a.updatedAt,
				lines: ls.map((l) => ({
					id: l.id,
					sort: l.sort,
					kind: l.kind,
					payload: json(l.payload),
					before: json(l.before),
					status: l.status as LineStatus,
					refusal: json(l.refusal),
					result: json(l.result),
					ranAt: l.ranAt,
					undoneAt: l.undoneAt
				}))
			});
		}
		if (acts.length) out.push({ id: g.id, title: g.title, actions: acts });
	}
	return out;
}
