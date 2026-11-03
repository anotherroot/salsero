import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import {
	lessonAdds,
	lessonRoutines,
	lessons,
	opens,
	songs,
	spotLinks,
	teamMembers
} from './db/schema';
import { createSongFromUpload } from './songs';
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

	it('nothing once the group is deleted', () => {
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

describe('whatsNew counting', () => {
	it('a lesson both published-new and changed after being added counts once', () => {
		const id = lesson(200);
		add('u2', id, 250);
		const r = createRoutine(db, T1_SALSA, { name: 'R', notes: null }).routine.id;
		linkRoutine(db, id, r, 'u1');
		db.update(lessonRoutines).set({ createdAt: 400 }).where(eq(lessonRoutines.lessonId, id)).run();
		const n = news();
		expect([...n.lessons]).toEqual([id]);
		expect(n.byTeam.get(1)).toBe(1);
	});
});

describe('whatsNew songs', () => {
	/** A ready song of team 1, shared at `at` (null = draft). */
	function song(at: number | null, extra: { archivedAt?: number; teamId?: number } = {}): number {
		const space = { ...T1_SALSA, teamId: extra.teamId ?? 1 };
		const id = createSongFromUpload(db, space, {
			file: `s${Math.random()}.mp3`,
			mime: 'audio/mpeg',
			title: 'S',
			style: 'salsa'
		}).id;
		db.update(songs)
			.set({ status: 'ready', sharedAt: at, archivedAt: extra.archivedAt ?? null })
			.where(eq(songs.id, id))
			.run();
		return id;
	}
	const openSong = (id: number, at: number) => recordOpen(db, 'u2', 'song', id, at);

	it('a song shared after joining and not opened is new, and counted', () => {
		const id = song(200);
		const n = news();
		expect([...n.songs]).toEqual([id]);
		expect(n.byTeam.get(1)).toBe(1);
	});

	it('opened after sharing is not new; opened before sharing again is', () => {
		const a = song(200);
		const b = song(300);
		openSong(a, 250);
		openSong(b, 250);
		expect([...news().songs]).toEqual([b]);
	});

	it('shared before joining, a draft, or deleted is not new', () => {
		song(50);
		song(null);
		song(200, { archivedAt: 300 });
		const n = news();
		expect(n.songs.size).toBe(0);
		expect(n.byTeam.get(1) ?? 0).toBe(0);
	});

	it('counts with the lessons per team; the song being opened is left out', () => {
		lesson(200);
		const id = song(200);
		expect(news().byTeam.get(1)).toBe(2);
		const n = whatsNew(db, 'u2', 'salsa', { kind: 'song', id });
		expect(n.songs.size).toBe(0);
		expect(n.lessons.size).toBe(1);
		expect(n.byTeam.get(1)).toBe(1);
	});

	it('a lesson opening never hides a song of the same id', () => {
		const id = song(200);
		expect([...whatsNew(db, 'u2', 'salsa', { kind: 'lesson', id }).songs]).toEqual([id]);
	});

	it('nothing after leaving, or from a group the person is not in', () => {
		createTeam(db, 'u1', 'salsa', 'Other', 1);
		song(200, { teamId: 2 });
		expect(news().songs.size).toBe(0);
		song(200);
		leaveTeam(db, 1, 'u2', 500);
		expect(news().songs.size).toBe(0);
	});
});

describe('whatsNew at size', () => {
	/**
	 * The spec's measure: a person in two groups with fifty lessons each. Every
	 * branch runs (published, added with links, songs), and the query count is
	 * fixed: it does not grow with the lessons.
	 */
	function build(perGroup: number): void {
		createTeam(db, 'u1', 'salsa', 'Second', 1);
		joinTeam(db, 'u2', 2, 2);
		db.update(teamMembers).set({ joinedAt: 100 }).where(eq(teamMembers.userId, 'u2')).run();
		for (const space of [T1_SALSA, { ...T1_SALSA, teamId: 2 }]) {
			const r = createRoutine(db, space, { name: 'R', notes: null }).routine.id;
			for (let i = 0; i < perGroup; i++) {
				const id = createLesson(db, space, input(`L${i}`)).lesson.id;
				db.update(lessons)
					.set({ publishedAt: 200 + i })
					.where(eq(lessons.id, id))
					.run();
				if (i % 3 === 0) recordOpen(db, 'u2', 'lesson', id, 1000 + i);
				if (i % 5 === 0) {
					add('u2', id, 300);
					linkRoutine(db, id, r, 'u1');
				}
			}
			for (let i = 0; i < 5; i++) {
				const s = createSongFromUpload(db, space, {
					file: `s${space.teamId}-${i}.mp3`,
					mime: 'audio/mpeg',
					title: `S${i}`,
					style: 'salsa'
				}).id;
				db.update(songs).set({ status: 'ready', sharedAt: 200 }).where(eq(songs.id, s)).run();
			}
		}
	}

	/** Statements prepared during `fn` (drizzle prepares each query it runs). */
	function queries(fn: () => void): number {
		const client = (db as unknown as { $client: { prepare: (s: string) => unknown } }).$client;
		const prepare = client.prepare.bind(client);
		let n = 0;
		client.prepare = (s: string) => {
			n++;
			return prepare(s);
		};
		try {
			fn();
		} finally {
			client.prepare = prepare;
		}
		return n;
	}

	it('two groups of fifty lessons: well under 200 ms, in a fixed number of queries', () => {
		build(2);
		const few = queries(() => news());
		db = openDb(':memory:');
		createTeam(db, 'u1', 'salsa', 'Class', 1);
		joinTeam(db, 'u2', 1, 2);
		build(50);
		const many = queries(() => news());
		expect(many).toBe(few);
		// Memberships, published, added, four kinds of link, songs: eight, at any size.
		expect(many).toBe(8);

		// Measured 2026-11-03: about 2-3 ms a call on the dev machine.
		news(); // warm
		const runs = Array.from({ length: 5 }, () => {
			const t = performance.now();
			const n = news();
			const ms = performance.now() - t;
			expect(n.byTeam.size).toBe(2);
			return ms;
		}).sort((a, b) => a - b);
		expect(runs.at(-1)!).toBeLessThan(200);
	});
});
