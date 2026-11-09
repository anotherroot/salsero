import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from '../../db';
import {
	exercises,
	figureGroups,
	figures,
	lessons,
	positions,
	routines,
	teamChanges,
	videoSpots
} from '../../db/schema';
import { makeWorld, type World } from '../../sync/test-world';
import { updateVariation } from '../../figures';
import { KINDS, type Ran, type Who } from '.';
import './all';

const T = 1_800_000_000_000;
const as = (userId: string): Who => ({ userId, dance: 'salsa', grantId: null });

function setup(): { db: Db; w: World } {
	const db = openDb(':memory:');
	return { db, w: makeWorld(db) };
}

/** parse + prepare, as propose does; then run and undo as the runner does. */
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

describe('the edit kinds write through the form`s own functions', () => {
	it('edit_figure: a group figure`s notes, logged under the person, then undone', () => {
		const { db, w } = setup();
		const q = queued(
			db,
			'edit_figure',
			{ figure_id: w.group.figure, notes: 'Hold the hand low.' },
			as('u1')
		);
		expect(q.prepared).toMatchObject({ ok: true, before: { notes: null } });
		const result = ran(q.run());
		expect(db.select().from(figures).where(eq(figures.id, w.group.figure)).get()!.notes).toBe(
			'Hold the hand low.'
		);
		const log = db
			.select()
			.from(teamChanges)
			.where(eq(teamChanges.teamId, 1))
			.all()
			.filter((c) => (c.afterJson ?? '').includes('Hold the hand low.'));
		expect(log.map((c) => c.actorId)).toEqual(['u1']);
		expect(q.undo(result)).toEqual({ ok: true });
		expect(db.select().from(figures).where(eq(figures.id, w.group.figure)).get()!.notes).toBeNull();
	});

	it('refuses `changed` when someone edited the field after it was proposed, and writes nothing', () => {
		const { db, w } = setup();
		const q = queued(db, 'edit_figure', { figure_id: w.group.figure, notes: 'Mine' }, as('u1'));
		const f = db.select().from(figures).where(eq(figures.id, w.group.figure)).get()!;
		updateVariation(
			db,
			f.id,
			{ name: f.name, partner: f.partner, style: f.styleTag ?? '', notes: 'Luka was here' },
			'u2'
		);
		expect(q.run()).toEqual({ ok: false, refusal: { code: 'changed', args: { fields: 'notes' } } });
		expect(db.select().from(figures).where(eq(figures.id, w.group.figure)).get()!.notes).toBe(
			'Luka was here'
		);
	});

	it('undo refuses `changed` once someone edited it after the run', () => {
		const { db, w } = setup();
		const q = queued(db, 'edit_figure', { figure_id: w.own.u1.figure, notes: 'One' }, as('u1'));
		const result = ran(q.run());
		const f = db.select().from(figures).where(eq(figures.id, w.own.u1.figure)).get()!;
		updateVariation(
			db,
			f.id,
			{ name: f.name, partner: f.partner, style: f.styleTag ?? '', notes: 'Two' },
			'u1'
		);
		expect(q.undo(result)).toMatchObject({ ok: false, refusal: { code: 'changed' } });
	});

	it('cannot be proposed by a plain member, or on another person`s row, and both read as missing', () => {
		const { db, w } = setup();
		const member = queued(
			db,
			'edit_figure',
			{ figure_id: w.group.figure, notes: 'x' },
			as('u3')
		).prepared;
		const other = queued(
			db,
			'edit_figure',
			{ figure_id: w.own.u4.figure, notes: 'x' },
			as('u1')
		).prepared;
		const none = queued(db, 'edit_figure', { figure_id: 999999, notes: 'x' }, as('u1')).prepared;
		expect(member).toEqual({
			ok: false,
			message: `No figure with id ${w.group.figure} that you can edit.`
		});
		expect(other).toEqual({
			ok: false,
			message: `No figure with id ${w.own.u4.figure} that you can edit.`
		});
		expect(none).toEqual({ ok: false, message: 'No figure with id 999999 that you can edit.' });
	});

	it('rename_move, refusing a name another move of the person already has, at propose and at run', () => {
		const { db, w } = setup();
		ran(
			queued(db, 'rename_move', { move_id: w.own.u1.move, name: 'Enchufla doble' }, as('u1')).run()
		);
		expect(
			db.select().from(figureGroups).where(eq(figureGroups.id, w.own.u1.move)).get()!.name
		).toBe('Enchufla doble');
		const twinMove = db.select().from(figures).where(eq(figures.id, w.own.u1.twin)).get()!.groupId!;
		expect(
			queued(db, 'rename_move', { move_id: twinMove, name: 'enchufla DOBLE' }, as('u1')).prepared
		).toMatchObject({ ok: false });
		const later = queued(db, 'rename_move', { move_id: twinMove, name: 'Setenta' }, as('u1'));
		ran(queued(db, 'rename_move', { move_id: w.own.u1.move, name: 'Setenta' }, as('u1')).run());
		expect(later.run()).toEqual({
			ok: false,
			refusal: { code: 'nameTaken', args: { name: 'Setenta' } }
		});
	});

	it('edit_routine, edit_lesson and edit_position', () => {
		const { db, w } = setup();
		ran(
			queued(
				db,
				'edit_routine',
				{ routine_id: w.own.u1.routine, name: 'Rueda basics' },
				as('u1')
			).run()
		);
		ran(
			queued(
				db,
				'edit_lesson',
				{ lesson_id: w.group.published, notes: 'Učili smo se' },
				as('u1')
			).run()
		);
		ran(
			queued(
				db,
				'edit_position',
				{ position_id: w.own.u1.position, notes: 'Close hold' },
				as('u1')
			).run()
		);
		expect(db.select().from(routines).where(eq(routines.id, w.own.u1.routine)).get()!.name).toBe(
			'Rueda basics'
		);
		expect(db.select().from(lessons).where(eq(lessons.id, w.group.published)).get()!.notes).toBe(
			'Učili smo se'
		);
		expect(
			db.select().from(positions).where(eq(positions.id, w.own.u1.position)).get()!.notes
		).toBe('Close hold');
	});

	it('edit_drill: notes always, a name only on a drill the person made', () => {
		const { db, w } = setup();
		ran(
			queued(
				db,
				'edit_drill',
				{ drill_id: w.group.drill, name: 'Group drill 2', notes: 'Slow' },
				as('u1')
			).run()
		);
		expect(db.select().from(exercises).where(eq(exercises.id, w.group.drill)).get()).toMatchObject({
			name: 'Group drill 2',
			notes: 'Slow',
			active: true
		});
		const lessonDrill = db
			.select()
			.from(exercises)
			.where(eq(exercises.id, w.own.u1.exercise))
			.get()!;
		expect(lessonDrill.source).not.toBe('custom');
		expect(
			queued(db, 'edit_drill', { drill_id: lessonDrill.id, name: 'New name' }, as('u1')).prepared
		).toMatchObject({ ok: false });
	});

	it('edit_section: a label and times through updateSpot; a bad span is refused', () => {
		const { db, w } = setup();
		ran(
			queued(
				db,
				'edit_section',
				{ section_id: w.own.u1.videoSpot, label: 'Guapea', start_ms: 100 },
				as('u1')
			).run()
		);
		expect(
			db.select().from(videoSpots).where(eq(videoSpots.id, w.own.u1.videoSpot)).get()
		).toMatchObject({ label: 'Guapea', startMs: 100 });
		const bad = queued(
			db,
			'edit_section',
			{ section_id: w.own.u1.videoSpot, start_ms: 5000 },
			as('u1')
		);
		expect(bad.run()).toMatchObject({ ok: false, refusal: { code: 'badSpan' } });
	});

	it('refuses a payload with nothing to change, or a field of the wrong type', () => {
		expect(KINDS.edit_figure.parse({ figure_id: 1 })).toMatchObject({ ok: false });
		expect(KINDS.edit_figure.parse({ figure_id: '1', notes: 'x' })).toMatchObject({ ok: false });
		expect(KINDS.edit_section.parse({ section_id: 1, start_ms: 'x' })).toMatchObject({ ok: false });
		expect(KINDS.edit_lesson.parse({ lesson_id: 1, title: '' })).toMatchObject({ ok: false });
	});

	it('a row archived after it was proposed is `gone`', () => {
		const { db, w } = setup();
		const q = queued(db, 'edit_routine', { routine_id: w.own.u1.routine, notes: 'x' }, as('u1'));
		db.update(routines)
			.set({ archivedAt: T })
			.where(and(eq(routines.id, w.own.u1.routine)))
			.run();
		expect(q.run()).toEqual({ ok: false, refusal: { code: 'gone' } });
	});
});
