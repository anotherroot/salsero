import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from '../../db';
import { exercises, lessons, spotLinks, videoSpots } from '../../db/schema';
import { makeWorld, type World } from '../../sync/test-world';
import { createCustomExercise } from '../../exercises';
import { setAutoAdd, setLevel } from '../../levels';
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

describe('sections', () => {
	it('add_section on the person`s lesson video, and Undo removes it', () => {
		const { db, w } = setup();
		const q = queued(
			db,
			'add_section',
			{ lesson_video_id: w.own.u1.video, start_ms: 31000, end_ms: 38000, label: 'Guapea' },
			as('u1')
		);
		const r = ran(q.run());
		expect(
			db
				.select()
				.from(videoSpots)
				.where(eq(videoSpots.id, Number(r.id)))
				.get()
		).toMatchObject({ label: 'Guapea', startMs: 31000, endMs: 38000 });
		expect(q.undo(r)).toEqual({ ok: true });
		expect(
			db
				.select()
				.from(videoSpots)
				.where(eq(videoSpots.id, Number(r.id)))
				.get()
		).toBeUndefined();
	});

	it('add_section on a group draft`s video: its owner may, a member may not', () => {
		const { db, w } = setup();
		expect(
			queued(
				db,
				'add_section',
				{ lesson_video_id: w.group.draftVideo, start_ms: 0, end_ms: 1000 },
				as('u1')
			).prepared.ok
		).toBe(true);
		expect(
			queued(
				db,
				'add_section',
				{ lesson_video_id: w.group.draftVideo, start_ms: 0, end_ms: 1000 },
				as('u3')
			).prepared.ok
		).toBe(false);
	});

	it('refuses an end before the start at parse', () => {
		expect(KINDS.add_section.parse({ lesson_video_id: 1, start_ms: 5000, end_ms: 4000 }).ok).toBe(
			false
		);
	});

	it('link_section links a section to a figure, Undo unlinks; a linked section`s Undo of its add is refused', () => {
		const { db, w } = setup();
		const add = queued(
			db,
			'add_section',
			{ lesson_video_id: w.own.u1.video, start_ms: 5000, end_ms: 6000 },
			as('u1')
		);
		const added = ran(add.run());
		const link = queued(
			db,
			'link_section',
			{ section_id: Number(added.id), figure_id: w.own.u1.figure },
			as('u1')
		);
		const linked = ran(link.run());
		expect(
			db
				.select()
				.from(spotLinks)
				.where(eq(spotLinks.id, Number(linked.id)))
				.get()
		).toMatchObject({ figureId: w.own.u1.figure });
		expect(add.undo(added)).toEqual({ ok: false, refusal: { code: 'linked' } });
		expect(link.undo(linked)).toEqual({ ok: true });
		expect(add.undo(added)).toEqual({ ok: true });
	});

	it('link_section to another person`s figure is refused at propose', () => {
		const { db, w } = setup();
		expect(
			queued(
				db,
				'link_section',
				{ section_id: w.own.u1.videoSpot, figure_id: w.own.u4.figure },
				as('u1')
			).prepared.ok
		).toBe(false);
	});
});

describe('lesson links', () => {
	it('link_lesson with a new group drill brings it to a member`s Today (the lesson page`s own path)', () => {
		const { db, w } = setup();
		// Maja follows the class: what grows a lesson she added comes to her Today.
		setLevel(db, 'u3', 'follow');
		setAutoAdd(db, 'u3', 1, true);
		const drill = createCustomExercise(
			db,
			{ teamId: 1, actorId: 'u1', dance: 'salsa' },
			{ name: 'New group drill', notes: null }
		).id;
		const before = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.drillId, drill), eq(exercises.userId, 'u3')))
			.all().length;
		const q = queued(db, 'link_lesson', { lesson_id: w.lesson, drill_id: drill }, as('u1'));
		const r = ran(q.run());
		const after = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.drillId, drill), eq(exercises.userId, 'u3')))
			.all().length;
		expect(after).toBeGreaterThan(before);
		expect(q.undo(r)).toEqual({ ok: true });
	});

	it('takes a ref for what an earlier action makes', () => {
		expect(KINDS.link_lesson.parse({ lesson_id: { ref: 3 }, figure_id: 5 })).toEqual({
			ok: true,
			args: { lesson: { ref: 3 }, key: 'figure_id', target: 5 }
		});
	});
});

describe('publish', () => {
	it('publishes a group draft as its owner, with no Undo', () => {
		const { db, w } = setup();
		ran(queued(db, 'publish_lesson', { lesson_id: w.group.draft }, as('u1')).run());
		expect(db.select().from(lessons).where(eq(lessons.id, w.group.draft)).get()!.publishedAt).toBe(
			T
		);
		expect(KINDS.publish_lesson.undo).toBeNull();
	});
	it('a member cannot, and an own lesson is no group`s', () => {
		const { db, w } = setup();
		expect(queued(db, 'publish_lesson', { lesson_id: w.group.draft }, as('u3')).prepared.ok).toBe(
			false
		);
		expect(
			queued(db, 'publish_lesson', { lesson_id: w.own.u1.lesson }, as('u1')).prepared
		).toMatchObject({ ok: false, message: expect.stringMatching(/own/) });
	});
});
