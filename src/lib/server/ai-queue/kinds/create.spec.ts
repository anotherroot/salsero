import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../../db';
import {
	exercises,
	figureGroups,
	figures,
	lessons,
	positions,
	routineSteps,
	routines,
	teamChanges
} from '../../db/schema';
import { makeWorld, type World } from '../../sync/test-world';
import { KINDS, type Ran, type Who } from '.';
import './all';

const T = 1_800_000_000_000;
const as = (userId: string): Who => ({ userId, dance: 'salsa', grantId: null });
function setup(): { db: Db; w: World } {
	const db = openDb(':memory:');
	return { db, w: makeWorld(db) };
}
function queued(db: Db, kind: string, payload: Record<string, unknown>, who: Who) {
	const k = KINDS[kind];
	const parsed = k.parse(payload);
	if (!parsed.ok) throw new Error(parsed.message);
	const prepared = k.prepare(db, who, parsed.args);
	return {
		prepared,
		run: () => {
			if (!prepared.ok) throw new Error(prepared.message);
			return db.transaction(() => k.run(db, who, parsed.args, prepared.before, T));
		},
		undo: (result: Record<string, unknown>) =>
			db.transaction(() => k.undo!(db, who, parsed.args, result, T))
	};
}
const ran = (r: Ran) => {
	if (!r.ok) throw new Error(JSON.stringify(r));
	return r.result;
};
const archivedAt = (
	db: Db,
	table: typeof figures | typeof routines | typeof exercises | typeof lessons | typeof positions,
	id: number
) => db.select({ a: table.archivedAt }).from(table).where(eq(table.id, id)).get()!.a;

describe('creates', () => {
	it('create_figure in a new move; Undo archives the figure and so the move', () => {
		const { db } = setup();
		const r = ran(
			queued(db, 'create_figure', { move_name: 'Guapea', name: 'Basic' }, as('u1')).run()
		);
		const f = db
			.select()
			.from(figures)
			.where(eq(figures.id, Number(r.id)))
			.get()!;
		expect(f).toMatchObject({ name: 'Basic', userId: 'u1', teamId: null });
		expect(db.select().from(figureGroups).where(eq(figureGroups.id, f.groupId!)).get()!.name).toBe(
			'Guapea'
		);
		expect(
			queued(db, 'create_figure', { move_name: 'Guapea', name: 'Basic' }, as('u1')).undo(r)
		).toEqual({ ok: true });
		expect(archivedAt(db, figures, f.id)).not.toBeNull();
	});

	it('create_figure in an existing move, and refuses a name the move already has', () => {
		const { db, w } = setup();
		const r = ran(
			queued(db, 'create_figure', { move_id: w.own.u1.move, name: 'Doble' }, as('u1')).run()
		);
		expect(
			db
				.select()
				.from(figures)
				.where(eq(figures.id, Number(r.id)))
				.get()!.groupId
		).toBe(w.own.u1.move);
		expect(
			queued(db, 'create_figure', { move_id: w.own.u1.move, name: 'doble' }, as('u1')).prepared.ok
		).toBe(false);
	});

	it('creates in a group the person owns, under their name in History; a member cannot', () => {
		const { db } = setup();
		const r = ran(queued(db, 'create_drill', { name: 'Shines', group_id: 1 }, as('u1')).run());
		expect(
			db
				.select()
				.from(exercises)
				.where(eq(exercises.id, Number(r.id)))
				.get()
		).toMatchObject({ teamId: 1, name: 'Shines' });
		const log = db
			.select()
			.from(teamChanges)
			.where(eq(teamChanges.teamId, 1))
			.all()
			.filter((c) => c.rootKind === 'drill' && c.rootId === Number(r.id));
		expect(log.map((c) => c.actorId)).toEqual(['u1']);
		expect(queued(db, 'create_drill', { name: 'Shines', group_id: 1 }, as('u3')).prepared.ok).toBe(
			false
		);
	});

	it('create_routine with two slots, all or nothing', () => {
		const { db, w } = setup();
		const r = ran(
			queued(
				db,
				'create_routine',
				{ name: 'Combo', slots: [w.own.u1.figure, w.own.u1.twin] },
				as('u1')
			).run()
		);
		expect(
			db
				.select()
				.from(routineSteps)
				.where(eq(routineSteps.routineId, Number(r.id)))
				.all()
		).toHaveLength(2);
		const bad = queued(
			db,
			'create_routine',
			{ name: 'Combo 2', slots: [w.own.u1.figure, 999999] },
			as('u1')
		);
		expect(bad.run()).toEqual({ ok: false, refusal: { code: 'badSlot' } });
	});

	it('create_position and create_lesson; Undo archives each', () => {
		const { db } = setup();
		const pq = queued(db, 'create_position', { name: 'Cerrada 2' }, as('u1'));
		const p = ran(pq.run());
		const lq = queued(db, 'create_lesson', { title: 'Paso 74', day: '2026-11-04' }, as('u1'));
		const l = ran(lq.run());
		expect(
			db
				.select()
				.from(lessons)
				.where(eq(lessons.id, Number(l.id)))
				.get()
		).toMatchObject({ title: 'Paso 74', lessonDay: '2026-11-04' });
		expect(pq.undo(p)).toEqual({ ok: true });
		expect(lq.undo(l)).toEqual({ ok: true });
		expect(archivedAt(db, positions, Number(p.id))).not.toBeNull();
		expect(archivedAt(db, lessons, Number(l.id))).not.toBeNull();
	});

	it('refuses a lesson day that is no date', () => {
		expect(KINDS.create_lesson.parse({ title: 'x', day: '4. 11.' }).ok).toBe(false);
	});

	it('takes a ref for a move an earlier action makes', () => {
		expect(KINDS.create_figure.parse({ move_id: { ref: 2 }, name: 'x' })).toMatchObject({
			ok: true
		});
	});
});

describe('archive and restore', () => {
	it('archive a routine; Undo restores it', () => {
		const { db, w } = setup();
		const q = queued(db, 'archive', { thing: 'routine', id: w.own.u1.routine }, as('u1'));
		const r = ran(q.run());
		expect(archivedAt(db, routines, w.own.u1.routine)).not.toBeNull();
		expect(q.undo(r)).toEqual({ ok: true });
		expect(archivedAt(db, routines, w.own.u1.routine)).toBeNull();
	});

	it('restore needs an archived row, and the person`s', () => {
		const { db, w } = setup();
		expect(
			queued(db, 'restore', { thing: 'routine', id: w.own.u1.routine }, as('u1')).prepared
		).toMatchObject({ ok: false });
		ran(queued(db, 'archive', { thing: 'routine', id: w.own.u1.routine }, as('u1')).run());
		expect(
			queued(db, 'restore', { thing: 'routine', id: w.own.u1.routine }, as('u4')).prepared.ok
		).toBe(false);
		ran(queued(db, 'restore', { thing: 'routine', id: w.own.u1.routine }, as('u1')).run());
		expect(archivedAt(db, routines, w.own.u1.routine)).toBeNull();
	});
});
