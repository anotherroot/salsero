import { beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { openDb } from '../db';
import { makeWorld } from '../sync/test-world';
import { KINDS, registerKinds, type LineKind, type Who } from './kinds';
import {
	changeAction,
	moveAction,
	propose,
	queueOf,
	removeGroup,
	setGroup,
	withdrawAction,
	type ActionIn
} from './store';

/** A kind for the store's own spec: it does nothing, and refuses "no". */
const stub: LineKind<{ note: string }> = {
	kind: 'stub',
	shape: '{ note }',
	parse: (raw) =>
		typeof raw.note === 'string'
			? { ok: true, args: { note: raw.note } }
			: { ok: false, message: 'note must be text.' },
	prepare: (_db, _who, p) =>
		p.note === 'no' ? { ok: false, message: 'Not yours.' } : { ok: true, before: { note: 'old' } },
	run: () => ({ ok: true, result: {} }),
	undo: null,
	flows: () => null
};
beforeAll(() => {
	if (!KINDS.stub) registerKinds(stub as never);
});

const T = 1_800_000_000_000;
const u1: Who = { userId: 'u1', dance: 'salsa', grantId: null };
const u4: Who = { userId: 'u4', dance: 'salsa', grantId: null };
const line = (note = 'x') => ({ kind: 'stub', note });
const act = (over: Partial<ActionIn> = {}): ActionIn => ({
	group: { title: 'Spelling' },
	title: 'Fix it',
	lines: [line()],
	...over
});

function fresh() {
	const db = openDb(':memory:');
	makeWorld(db);
	return db;
}
const ok = (r: { ok: boolean; message?: string }) => {
	if (!r.ok) throw new Error(r.message);
	return r as { ok: true; actionId: number };
};

describe('the queue store', () => {
	it('proposes into a new group, then a second action into it, in order', () => {
		const db = fresh();
		const a = ok(propose(db, u1, act(), T));
		const groupId = queueOf(db, 'u1', 'salsa', T)[0].id;
		const b = ok(propose(db, u1, act({ group: { id: groupId }, title: 'Second' }), T));
		const q = queueOf(db, 'u1', 'salsa', T);
		expect(q).toHaveLength(1);
		expect(q[0].title).toBe('Spelling');
		expect(q[0].actions.map((x) => [x.id, x.n])).toEqual([
			[a.actionId, 1],
			[b.actionId, 2]
		]);
		expect(q[0].actions[0].lines[0]).toMatchObject({
			kind: 'stub',
			status: 'pending',
			before: { note: 'old' }
		});
	});

	it('refuses an unknown kind, a bad payload and what the person may not do, in one line each', () => {
		const db = fresh();
		expect(propose(db, u1, act({ lines: [{ kind: 'nope' }] }), T)).toMatchObject({
			ok: false,
			message: expect.stringMatching(/kind/)
		});
		expect(propose(db, u1, act({ lines: [{ kind: 'stub', note: 5 }] }), T)).toMatchObject({
			ok: false,
			message: expect.stringMatching(/note must be text/)
		});
		expect(propose(db, u1, act({ lines: [line('no')] }), T)).toMatchObject({
			ok: false,
			message: expect.stringMatching(/Not yours/)
		});
		expect(queueOf(db, 'u1', 'salsa', T)).toEqual([]);
	});

	it('takes needs and refs only to the person`s own earlier actions', () => {
		const db = fresh();
		const mine = ok(propose(db, u1, act(), T));
		const theirs = ok(propose(db, u4, act(), T));
		const b = ok(
			propose(
				db,
				u1,
				act({
					needs: [mine.actionId],
					lines: [{ kind: 'stub', note: 'x', other: { ref: mine.actionId } } as never]
				}),
				T
			)
		);
		expect(
			queueOf(db, 'u1', 'salsa', T)
				.flatMap((g) => g.actions)
				.find((x) => x.id === b.actionId)!.needs
		).toEqual([mine.actionId]);
		const refused = propose(db, u1, act({ needs: [theirs.actionId] }), T);
		const missing = propose(db, u1, act({ needs: [999999] }), T);
		expect(refused).toEqual({ ok: false, message: `No action with id ${theirs.actionId}.` });
		expect(missing).toEqual({ ok: false, message: 'No action with id 999999.' });
	});

	it('refuses more than 50 lines in one action', () => {
		const db = fresh();
		const lines = Array.from({ length: 51 }, () => line());
		expect(propose(db, u1, act({ lines }), T).ok).toBe(false);
	});

	it('changeAction bumps the version and keeps what it was', () => {
		const db = fresh();
		const a = ok(propose(db, u1, act({ title: 'First try' }), T));
		expect(
			changeAction(db, u1, a.actionId, { title: 'Better', lines: [line('y')] }, T + 1)
		).toEqual({ ok: true });
		const x = queueOf(db, 'u1', 'salsa', T + 1)[0].actions[0];
		expect(x).toMatchObject({ title: 'Better', version: 2, previous: { title: 'First try' } });
		expect(x.lines[0].payload).toEqual({ note: 'y' });
	});

	it('changeAction refuses once a line is no longer pending', () => {
		const db = fresh();
		const a = ok(propose(db, u1, act(), T));
		db.run(sql`update ai_lines set status = 'done' where action_id = ${a.actionId}`);
		expect(changeAction(db, u1, a.actionId, { title: 'x' }, T).ok).toBe(false);
	});

	it('withdrawAction hides it; another person cannot touch it', () => {
		const db = fresh();
		const a = ok(propose(db, u1, act(), T));
		expect(withdrawAction(db, u4, a.actionId, T)).toEqual({
			ok: false,
			message: `No action with id ${a.actionId}.`
		});
		expect(withdrawAction(db, u1, a.actionId, T)).toEqual({ ok: true });
		expect(queueOf(db, 'u1', 'salsa', T)).toEqual([]);
	});

	it('moveAction puts an action before another, or into another group', () => {
		const db = fresh();
		const a = ok(propose(db, u1, act({ title: 'A' }), T));
		const g = queueOf(db, 'u1', 'salsa', T)[0].id;
		const b = ok(propose(db, u1, act({ group: { id: g }, title: 'B' }), T));
		expect(moveAction(db, u1, b.actionId, { before: a.actionId }, T)).toEqual({ ok: true });
		expect(queueOf(db, 'u1', 'salsa', T)[0].actions.map((x) => x.title)).toEqual(['B', 'A']);
		const other = setGroup(db, u1, { title: 'Sections' }, T);
		if (!other.ok) throw new Error(other.message);
		expect(moveAction(db, u1, a.actionId, { groupId: other.groupId }, T)).toEqual({ ok: true });
		expect(
			queueOf(db, 'u1', 'salsa', T).map((x) => [x.title, x.actions.map((y) => y.title)])
		).toEqual([
			['Spelling', ['B']],
			['Sections', ['A']]
		]);
	});

	it('setGroup renames and reorders groups; removeGroup withdraws its pending actions', () => {
		const db = fresh();
		ok(propose(db, u1, act({ group: { title: 'One' } }), T));
		ok(propose(db, u1, act({ group: { title: 'Two' } }), T));
		const [one, two] = queueOf(db, 'u1', 'salsa', T);
		expect(setGroup(db, u1, { id: two.id, title: 'Second', before: one.id }, T)).toMatchObject({
			ok: true
		});
		expect(queueOf(db, 'u1', 'salsa', T).map((g) => g.title)).toEqual(['Second', 'One']);
		expect(removeGroup(db, u1, one.id, T)).toEqual({ ok: true });
		expect(queueOf(db, 'u1', 'salsa', T).map((g) => g.title)).toEqual(['Second']);
	});

	it('numbers actions across groups in queue order', () => {
		const db = fresh();
		ok(propose(db, u1, act({ group: { title: 'One' } }), T));
		ok(propose(db, u1, act({ group: { title: 'Two' } }), T));
		expect(queueOf(db, 'u1', 'salsa', T).flatMap((g) => g.actions.map((a) => a.n))).toEqual([1, 2]);
	});
});
