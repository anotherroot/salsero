import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { lessons, routines, spotLinks } from '../db/schema';
import { makeWorld, type World } from '../sync/test-world';
import { updateRoutine } from '../routines';
import { propose, queueOf, type ActionIn } from './store';
import { actionsUpTo, allPending, dropActions, runActions, toggleLine, undoLines } from './run';
import type { Who } from './kinds';
import './kinds/all';

const T = 1_800_000_000_000;
const u1: Who = { userId: 'u1', dance: 'salsa', grantId: null };

function setup(): { db: Db; w: World } {
	const db = openDb(':memory:');
	return { db, w: makeWorld(db) };
}
function add(db: Db, input: Partial<ActionIn> & { lines: ActionIn['lines'] }): number {
	const r = propose(db, u1, { group: { title: 'G' }, title: 'A', ...input }, T);
	if (!r.ok) throw new Error(r.message);
	return r.actionId;
}
const versions = (db: Db) =>
	Object.fromEntries(
		queueOf(db, 'u1', 'salsa', T).flatMap((g) => g.actions.map((a) => [a.id, a.version]))
	);
const lineOf = (db: Db, actionId: number) =>
	queueOf(db, 'u1', 'salsa', T)
		.flatMap((g) => g.actions)
		.find((a) => a.id === actionId)!.lines[0];

describe('runActions', () => {
	it('runs everything it can and keeps the refused line pending with its reason', async () => {
		const { db, w } = setup();
		const a = add(db, {
			lines: [{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'one' }]
		});
		const b = add(db, {
			lines: [{ kind: 'edit_lesson', lesson_id: w.own.u1.lesson, notes: 'two' }]
		});
		const c = add(db, {
			lines: [{ kind: 'edit_position', position_id: w.own.u1.position, notes: 'three' }]
		});
		// Someone changes the lesson after b was proposed.
		db.update(lessons)
			.set({ notes: 'changed by hand' })
			.where(eq(lessons.id, w.own.u1.lesson))
			.run();
		const report = await runActions(db, u1, [a, b, c], versions(db), T);
		expect(report.done).toHaveLength(2);
		expect(report.refused).toEqual([
			{ lineId: lineOf(db, b).id, refusal: { code: 'changed', args: { fields: 'notes' } } }
		]);
		expect(lineOf(db, a).status).toBe('done');
		expect(lineOf(db, b)).toMatchObject({ status: 'pending', refusal: { code: 'changed' } });
		expect(lineOf(db, c).status).toBe('done');
	});

	it('refuses an action the AI changed since the page showed it, and only that one', async () => {
		const { db, w } = setup();
		const a = add(db, {
			lines: [{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'x' }]
		});
		const b = add(db, { lines: [{ kind: 'edit_lesson', lesson_id: w.own.u1.lesson, notes: 'y' }] });
		const seen = { ...versions(db), [a]: 0 };
		const report = await runActions(db, u1, [a, b], seen, T);
		expect(report.refused).toEqual([
			{ lineId: lineOf(db, a).id, refusal: { code: 'claudeChanged' } }
		]);
		expect(
			db.select().from(routines).where(eq(routines.id, w.own.u1.routine)).get()!.notes
		).toBeNull();
		expect(lineOf(db, b).status).toBe('done');
	});

	it('runs a link after the section it refers to, in one run, whatever order they were asked in', async () => {
		const { db, w } = setup();
		const sec = add(db, {
			lines: [
				{ kind: 'add_section', lesson_video_id: w.own.u1.video, start_ms: 3000, end_ms: 4000 }
			]
		});
		const link = add(db, {
			lines: [{ kind: 'link_section', section_id: { ref: sec }, figure_id: w.own.u1.figure }]
		});
		const report = await runActions(db, u1, [link, sec], versions(db), T);
		expect(report.refused).toEqual([]);
		const made = Number(lineOf(db, sec).result!.id);
		expect(db.select().from(spotLinks).where(eq(spotLinks.spotId, made)).all()).toHaveLength(1);
	});

	it('a link whose section was dropped refuses dependsOn; Run all goes on', async () => {
		const { db, w } = setup();
		const sec = add(db, {
			lines: [
				{ kind: 'add_section', lesson_video_id: w.own.u1.video, start_ms: 3000, end_ms: 4000 }
			]
		});
		const link = add(db, {
			lines: [{ kind: 'link_section', section_id: { ref: sec }, figure_id: w.own.u1.figure }]
		});
		const other = add(db, {
			lines: [{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'z' }]
		});
		expect(dropActions(db, u1, [sec], true, T).dropped.sort()).toEqual([sec, link].sort());
		const report = await runActions(db, u1, allPending(db, u1), versions(db), T);
		expect(report.done).toHaveLength(1);
		expect(lineOf(db, other).status).toBe('done');
	});

	it('waits for a need outside the run', async () => {
		const { db, w } = setup();
		const sec = add(db, {
			lines: [
				{ kind: 'add_section', lesson_video_id: w.own.u1.video, start_ms: 3000, end_ms: 4000 }
			]
		});
		const link = add(db, {
			lines: [{ kind: 'link_section', section_id: { ref: sec }, figure_id: w.own.u1.figure }]
		});
		const report = await runActions(db, u1, [link], versions(db), T);
		expect(report.refused).toEqual([
			{ lineId: lineOf(db, link).id, refusal: { code: 'waits', args: { n: 1 } } }
		]);
	});

	it('runs an action once, whatever is asked twice', async () => {
		const { db, w } = setup();
		const a = add(db, {
			lines: [{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'once' }]
		});
		await runActions(db, u1, [a], versions(db), T);
		updateRoutine(db, w.own.u1.routine, { name: 'Routine u1', notes: 'later' }, 'u1');
		const again = await runActions(db, u1, [a], versions(db), T);
		expect(again).toEqual({ done: [], refused: [] });
		expect(db.select().from(routines).where(eq(routines.id, w.own.u1.routine)).get()!.notes).toBe(
			'later'
		);
	});

	it('skips a line left out', async () => {
		const { db, w } = setup();
		const a = add(db, {
			lines: [
				{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'x' },
				{ kind: 'edit_lesson', lesson_id: w.own.u1.lesson, notes: 'y' }
			]
		});
		const q = queueOf(db, 'u1', 'salsa', T)[0].actions[0];
		expect(toggleLine(db, u1, q.lines[1].id, T)).toEqual({ ok: true });
		const report = await runActions(db, u1, [a], versions(db), T);
		expect(report.done).toEqual([q.lines[0].id]);
		expect(
			db.select().from(lessons).where(eq(lessons.id, w.own.u1.lesson)).get()!.notes
		).toBeNull();
	});
});

describe('dropping, up to here, undo', () => {
	it('drop without dependents names them and drops nothing', () => {
		const { db, w } = setup();
		const sec = add(db, {
			lines: [
				{ kind: 'add_section', lesson_video_id: w.own.u1.video, start_ms: 3000, end_ms: 4000 }
			]
		});
		const link = add(db, {
			lines: [{ kind: 'link_section', section_id: { ref: sec }, figure_id: w.own.u1.figure }]
		});
		expect(dropActions(db, u1, [sec], false, T)).toEqual({ dropped: [], dependents: [link] });
		expect(lineOf(db, sec).status).toBe('pending');
	});

	it('actionsUpTo lists the pending actions in queue order up to that one', () => {
		const { db, w } = setup();
		const a = add(db, {
			lines: [{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'x' }]
		});
		const b = add(db, { lines: [{ kind: 'edit_lesson', lesson_id: w.own.u1.lesson, notes: 'y' }] });
		add(db, { lines: [{ kind: 'edit_position', position_id: w.own.u1.position, notes: 'z' }] });
		expect(actionsUpTo(db, u1, b)).toEqual([a, b]);
	});

	it('undo puts it back; publish has none; after 30 days it is too late', async () => {
		const { db, w } = setup();
		const a = add(db, {
			lines: [{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'x' }]
		});
		const p = add(db, { lines: [{ kind: 'publish_lesson', lesson_id: w.group.draft }] });
		await runActions(db, u1, [a, p], versions(db), T);
		const lines = [lineOf(db, a).id, lineOf(db, p).id];
		const r = await undoLines(db, u1, lines, T + 1000);
		expect(r.done).toEqual([lines[0]]);
		expect(r.refused).toEqual([{ lineId: lines[1], refusal: { code: 'noUndo' } }]);
		expect(
			db.select().from(routines).where(eq(routines.id, w.own.u1.routine)).get()!.notes
		).toBeNull();
		const b = add(db, {
			lines: [{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'y' }]
		});
		await runActions(db, u1, [b], versions(db), T);
		const late = await undoLines(db, u1, [lineOf(db, b).id], T + 31 * 86_400_000);
		expect(late.refused[0].refusal).toEqual({ code: 'tooLate' });
	});

	it('another person`s lines and actions are not there', async () => {
		const { db, w } = setup();
		const a = add(db, {
			lines: [{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'x' }]
		});
		const u4: Who = { userId: 'u4', dance: 'salsa', grantId: null };
		expect(await runActions(db, u4, [a], versions(db), T)).toEqual({ done: [], refused: [] });
		expect(toggleLine(db, u4, lineOf(db, a).id, T).ok).toBe(false);
	});
});
