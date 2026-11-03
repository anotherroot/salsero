import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { lessonAdds, lessonRoutines, lessons, opens, spotLinks, teamMembers } from './db/schema';
import { addLessonVideo, createLesson, linkRoutine } from './lessons';
import { createRoutine } from './routines';
import { createCustomExercise } from './exercises';
import { addSpot } from './spots';
import { linkInSpace } from './spot-links';
import { createTeam, deleteTeam, joinTeam } from './teams';
import { leaveTeam } from './membership';
import { T1_SALSA } from './test-walls';
import { recordOpen, whatsNew } from './whats-new';

let db: Db;
const input = (title: string) => ({ lessonDay: '2026-11-02', title, notes: null });

/** A lesson of team 1, published at `at` (null = draft). */
function lesson(at: number | null, extra: { archivedAt?: number } = {}): number {
	const id = createLesson(db, T1_SALSA, input('L')).lesson.id;
	db.update(lessons)
		.set({ publishedAt: at, archivedAt: extra.archivedAt ?? null })
		.where(eq(lessons.id, id))
		.run();
	return id;
}
const add = (userId: string, lessonId: number, addedAt: number) =>
	db.insert(lessonAdds).values({ userId, lessonId, addedAt, seenAt: addedAt }).run();
const open = (lessonId: number, at: number) => recordOpen(db, 'u2', 'lesson', lessonId, at);
const news = () => whatsNew(db, 'u2', 'salsa');

beforeEach(() => {
	db = openDb(':memory:');
	createTeam(db, 'u1', 'salsa', 'Class', 1);
	joinTeam(db, 'u2', 1, 2);
	db.update(teamMembers).set({ joinedAt: 100 }).where(eq(teamMembers.userId, 'u2')).run();
});

describe('whatsNew lessons', () => {
	it('a lesson published after joining and never opened is new', () => {
		const id = lesson(200);
		const n = news();
		expect([...n.lessons]).toEqual([id]);
		expect(n.byTeam.get(1)).toBe(1);
		expect(n.songs.size).toBe(0);
	});

	it('published before joining, a draft, or archived is not new', () => {
		lesson(50);
		lesson(null);
		lesson(200, { archivedAt: 300 });
		const n = news();
		expect(n.lessons.size).toBe(0);
		expect(n.byTeam.get(1) ?? 0).toBe(0);
	});

	it('opened after publishing is not new; opened before publishing is', () => {
		const a = lesson(200);
		const b = lesson(200);
		open(a, 250);
		open(b, 150);
		expect([...news().lessons]).toEqual([b]);
	});

	it('an added lesson is new when a link arrives after the last open or add', () => {
		const id = lesson(50);
		add('u2', id, 300);
		open(id, 300);
		expect(news().lessons.size).toBe(0);
		const r = createRoutine(db, T1_SALSA, { name: 'R', notes: null }).routine.id;
		expect(linkRoutine(db, id, r, 'u1')).toBeTruthy();
		db.update(lessonRoutines).set({ createdAt: 400 }).where(eq(lessonRoutines.lessonId, id)).run();
		expect([...news().lessons]).toEqual([id]);
		open(id, 500);
		expect(news().lessons.size).toBe(0);
	});

	it('a section link after the last open makes an added lesson new', () => {
		const id = lesson(50);
		add('u2', id, 300);
		open(id, 300);
		const video = addLessonVideo(
			db,
			{ lessonId: id, file: 'v.mp4', mime: 'video/mp4', sizeBytes: 5 },
			'u1'
		).id;
		const section = addSpot(
			db,
			{ lessonVideoId: video },
			{ startMs: 0, endMs: 9, label: 'S' },
			'u1'
		)!;
		const drill = createCustomExercise(db, T1_SALSA, { name: 'D', everyDays: 3, notes: null }).id;
		linkInSpace(db, T1_SALSA, section.id, { exerciseId: drill });
		db.update(spotLinks).set({ createdAt: 400 }).run();
		expect([...news().lessons]).toEqual([id]);
		open(id, 450);
		expect(news().lessons.size).toBe(0);
	});

	it('the lesson being opened is left out', () => {
		const id = lesson(200);
		const n = whatsNew(db, 'u2', 'salsa', { kind: 'lesson', id });
		expect(n.lessons.size).toBe(0);
		expect(n.byTeam.get(1) ?? 0).toBe(0);
	});

	it('nothing once the person left, or the group is deleted', () => {
		lesson(200);
		expect(news().lessons.size).toBe(1);
		deleteTeam(db, 1, 'u1', 500);
		expect(news().lessons.size).toBe(0);
	});

	it('nothing after leaving', () => {
		lesson(200);
		leaveTeam(db, 1, 'u2', 500);
		expect(news().lessons.size).toBe(0);
	});

	it('another dance is not counted', () => {
		const bachata = createTeam(db, 'u1', 'bachata', 'Bach', 3);
		void bachata;
		joinTeam(db, 'u2', 2, 4);
		db.update(teamMembers).set({ joinedAt: 100 }).where(eq(teamMembers.teamId, 2)).run();
		const id = createLesson(db, { dance: 'bachata', teamId: 2, actorId: 'u1' }, input('B')).lesson
			.id;
		db.update(lessons).set({ publishedAt: 200 }).where(eq(lessons.id, id)).run();
		expect(news().lessons.size).toBe(0);
		expect([...whatsNew(db, 'u2', 'bachata').lessons]).toEqual([id]);
	});

	it('recordOpen upserts', () => {
		recordOpen(db, 'u2', 'lesson', 9, 10);
		recordOpen(db, 'u2', 'lesson', 9, 20);
		const rows = db.select().from(opens).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].openedAt).toBe(20);
	});
});
