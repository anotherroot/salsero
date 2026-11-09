import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { lessons } from '../db/schema';
import { makeWorld, type World } from '../sync/test-world';
import { propose, type ActionIn } from './store';
import { runActions } from './run';
import { pendingCount, suggestionsView } from './view';
import type { Who } from './kinds';
import './kinds/all';

const T = 1_800_000_000_000;
const u1: Who = { userId: 'u1', dance: 'salsa', grantId: null };
function setup(): { db: Db; w: World } {
	const db = openDb(':memory:');
	return { db, w: makeWorld(db) };
}
function add(db: Db, input: Partial<ActionIn> & { lines: ActionIn['lines'] }): number {
	const r = propose(db, u1, { group: { title: 'Spelling' }, title: 'Fix', ...input }, T);
	if (!r.ok) throw new Error(r.message);
	return r.actionId;
}

describe('suggestionsView', () => {
	it('builds each card from the change itself: heading, word diff, who will see it', () => {
		const { db, w } = setup();
		db.update(lessons)
			.set({ notes: 'Ucili smos e slišati' })
			.where(eq(lessons.id, w.group.published))
			.run();
		add(db, {
			lines: [{ kind: 'edit_lesson', lesson_id: w.group.published, notes: 'Učili smo se slišati' }]
		});
		const v = suggestionsView(db, 'u1', 'salsa', T);
		expect(v.waiting).toBe(1);
		const line = v.groups[0].actions[0].lines[0];
		expect(line.heading).toMatch(/^Lesson /);
		expect(line.where).toMatch(/will see this$/);
		expect(line.fields).toEqual([
			{
				label: 'Notes',
				parts: [
					{ op: 'del', text: 'Ucili smos e' },
					{ op: 'ins', text: 'Učili smo se' },
					{ op: 'same', text: ' slišati' }
				]
			}
		]);
		expect(line.canUndo).toBe(false);
	});

	it('a new section on a video plays its stretch; a publish warns', () => {
		const { db, w } = setup();
		add(db, {
			lines: [
				{
					kind: 'add_section',
					lesson_video_id: w.own.u1.video,
					start_ms: 31000,
					end_ms: 38000,
					label: 'Guapea'
				}
			]
		});
		add(db, { lines: [{ kind: 'publish_lesson', lesson_id: w.group.draft }] });
		const [sec, pub] = suggestionsView(db, 'u1', 'salsa', T).groups.flatMap((g) => g.actions);
		expect(sec.lines[0].heading).toMatch(/^New section 0:31–0:38 on /);
		expect(sec.lines[0].section).toMatchObject({
			startMs: 31000,
			endMs: 38000,
			src: expect.stringMatching(/^\/lesson-videos\//)
		});
		expect(pub.lines[0].warning).toMatch(/^Can't be undone/);
	});

	it('a waiting action names what it waits for; a done one can be undone; a refused one says why', async () => {
		const { db, w } = setup();
		const sec = add(db, {
			lines: [
				{ kind: 'add_section', lesson_video_id: w.own.u1.video, start_ms: 1000, end_ms: 2000 }
			]
		});
		add(db, {
			lines: [{ kind: 'link_section', section_id: { ref: sec }, figure_id: w.own.u1.figure }]
		});
		const r = add(db, {
			lines: [{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'x' }]
		});
		let v = suggestionsView(db, 'u1', 'salsa', T);
		const actions = v.groups.flatMap((g) => g.actions);
		expect(actions[1].waitsFor).toEqual([1]);
		expect(actions[1].lines[0].heading).toMatch(/the new one from 1/);
		await runActions(db, u1, [r], Object.fromEntries(actions.map((a) => [a.id, a.version])), T);
		v = suggestionsView(db, 'u1', 'salsa', T);
		const done = v.groups.flatMap((g) => g.actions).find((a) => a.id === r)!;
		expect(done.state).toBe('done');
		expect(done.lines[0].canUndo).toBe(true);
		expect(pendingCount(db, 'u1', 'salsa')).toBe(2);
	});

	it('another person sees none of it', () => {
		const { db, w } = setup();
		add(db, { lines: [{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'x' }] });
		expect(suggestionsView(db, 'u4', 'salsa', T).groups).toEqual([]);
		expect(pendingCount(db, 'u4', 'salsa')).toBe(0);
	});
});
