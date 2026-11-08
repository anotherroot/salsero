/**
 * Comments and hearts on a group's lessons: who reads, who writes, who deletes,
 * and what a deleted group, a purge and someone leaving do to them.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises, lessonCommentHearts, lessonComments, opens, teams, users } from './db/schema';
import { createTeam, deleteTeam, joinTeam } from './teams';
import { createLesson, linkExercise, linkFigure, linkRoutine, publishLesson } from './lessons';
import { addLesson, entryFor } from './entries';
import { createCustomExercise } from './exercises';
import { createRoutine } from './routines';
import { createFigure } from './figures';
import { leaveTeam, setRole } from './membership';
import { purgeTeams } from './team-purge';
import { recordOpen } from './whats-new';
import {
	classLessonOf,
	closedMessage,
	commentCard,
	commentsOn,
	deleteComment,
	listComments,
	postComment,
	restoreComment,
	toggleHeart,
	type Comment,
	type CommentRefusal
} from './comments';
import { T1_SALSA, U2_SALSA } from './test-walls';
import { runInLocale } from './i18n-request';
import { TEAM_PURGE_MS } from '$lib/limits';
import type { CloneFiles } from './clones/files';

const NO_FILES: CloneFiles = { link: async (_k, f) => `copy-${f}`, unlink: async () => {} };

let db: Db;
let lesson: number;
let draft: number;
let own: number;

const person = (id: string, firstName: string) =>
	db
		.insert(users)
		.values({ id, email: `${id}@x.com`, passwordHash: 'x', firstName })
		.run();

beforeEach(() => {
	db = openDb(':memory:');
	person('u1', 'Teo'); // the owner
	person('u2', 'Maja'); // a member
	person('u3', 'Eva'); // an editor
	person('u4', 'Stranger');
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', 1);
	joinTeam(db, 'u2', 1, 2);
	joinTeam(db, 'u3', 1, 2);
	setRole(db, 1, 'u3', 'editor');
	const input = { lessonDay: '2026-11-03', title: 'Tue 3 Nov', notes: null };
	lesson = createLesson(db, T1_SALSA, input).lesson.id;
	draft = createLesson(db, T1_SALSA, input).lesson.id;
	publishLesson(db, T1_SALSA, lesson, 5);
	own = createLesson(db, U2_SALSA, input).lesson.id;
});

const ok = (r: Comment | CommentRefusal): Comment => {
	expect('refused' in r).toBe(false);
	return r as Comment;
};
const post = (user: string, body: string, replyTo: number | null = null, at = 100, l = lesson) =>
	postComment(db, user, l, body, replyTo, at);
const list = (user: string, l = lesson) => listComments(db, user, l);

describe('posting, reading and hearts', () => {
	it('a member posts and reads it back, with the teacher tag on a teacher', () => {
		const mine = ok(post('u2', '  Which foot first?  '));
		expect(mine).toMatchObject({ authorName: 'Maja', teacher: false, mine: true, hearts: 0 });
		expect(mine.body).toBe('Which foot first?');
		ok(post('u1', 'The left.', mine.id, 110));
		const l = list('u2')!;
		expect(l).toMatchObject({ open: true, groupName: 'Salsa Tuesdays' });
		expect(l.threads).toHaveLength(1);
		expect(l.threads[0].replies[0]).toMatchObject({
			authorName: 'Teo',
			teacher: true,
			mine: false
		});
		expect(l.threads[0].replies[0].replyToName).toBeNull(); // a reply to a top comment
	});

	it('hearts toggle: on, then off to 0', () => {
		const c = ok(post('u2', 'Hi'));
		expect(toggleHeart(db, 'u1', c.id, 1)).toEqual({ hearted: true, count: 1 });
		expect(toggleHeart(db, 'u2', c.id, 2)).toEqual({ hearted: true, count: 2 }); // your own
		expect(list('u1')!.threads[0].top).toMatchObject({ hearts: 2, hearted: true });
		expect(toggleHeart(db, 'u1', c.id, 3)).toEqual({ hearted: false, count: 1 });
		expect(toggleHeart(db, 'u2', c.id, 4)).toEqual({ hearted: false, count: 0 });
		expect(db.select().from(lessonCommentHearts).all()).toEqual([]);
	});

	it('newest top comment first, replies oldest first', () => {
		const a = ok(post('u2', 'first', null, 100));
		const b = ok(post('u2', 'second', null, 200));
		ok(post('u1', 'r2', a.id, 400));
		ok(post('u3', 'r1', a.id, 300));
		const l = list('u2')!;
		expect(l.threads.map((t) => t.top.id)).toEqual([b.id, a.id]);
		expect(l.threads[1].replies.map((r) => r.body)).toEqual(['r1', 'r2']);
	});

	it('a reply to a reply sets replyToName, and stays in the top comment’s thread', () => {
		const top = ok(post('u2', 'Q'));
		const r1 = ok(post('u1', 'A', top.id, 110));
		const r2 = ok(post('u3', 'Thanks', r1.id, 120));
		expect(r2.threadId).toBe(top.id);
		expect(r2.replyToName).toBe('Teo');
		expect(
			db.select().from(lessonComments).where(eq(lessonComments.id, r2.id)).get()
		).toMatchObject({ threadId: top.id, replyToId: r1.id });
	});
});

describe('the length of a body', () => {
	it('refuses 0, whitespace only and 1001 characters; takes 1 and 1000', () => {
		for (const body of ['', '   \n ', 'a'.repeat(1001)]) {
			expect(post('u2', body)).toMatchObject({ refused: 'body' });
		}
		ok(post('u2', 'a'));
		ok(post('u2', 'a'.repeat(1000)));
		expect(db.select().from(lessonComments).all()).toHaveLength(2);
	});
});

describe('delete and restore', () => {
	it('an editor and the owner delete another’s comment; a member cannot', () => {
		const c = ok(post('u2', 'mine'));
		const d = ok(post('u3', 'editor’s'));
		expect(deleteComment(db, 'u2', d.id, 200)).toBe(false); // a member, not theirs
		expect(deleteComment(db, 'u3', c.id, 200)).toBe(true);
		expect(deleteComment(db, 'u1', d.id, 200)).toBe(true);
		expect(list('u2')!.threads).toEqual([]);
	});

	it('the list says who can delete', () => {
		ok(post('u2', 'mine'));
		expect(list('u2')!.threads[0].top.canDelete).toBe(true);
		expect(list('u1')!.threads[0].top.canDelete).toBe(true);
		const other = ok(post('u3', 'theirs'));
		expect(list('u2')!.threads.find((t) => t.top.id === other.id)!.top.canDelete).toBe(false);
	});

	it('the author deletes their own, and restore brings it back', () => {
		const c = ok(post('u2', 'oops'));
		expect(deleteComment(db, 'u2', c.id, 200)).toBe(true);
		expect(deleteComment(db, 'u2', c.id, 201)).toBe(false); // already gone
		expect(list('u2')!.threads).toEqual([]);
		expect(restoreComment(db, 'u4', c.id)).toBe(false); // a stranger
		expect(restoreComment(db, 'u2', c.id)).toBe(true);
		expect(list('u2')!.threads[0].top.body).toBe('oops');
		expect(restoreComment(db, 'u2', c.id)).toBe(false); // nothing to restore
	});

	it('a member cannot restore their own comment after a teacher deleted it; the teacher can', () => {
		const c = ok(post('u2', 'rude'));
		deleteComment(db, 'u3', c.id, 200);
		expect(restoreComment(db, 'u2', c.id)).toBe(false);
		expect(list('u2')!.threads).toEqual([]);
		expect(restoreComment(db, 'u1', c.id)).toBe(true);
		expect(list('u2')!.threads[0].top.body).toBe('rude');
	});

	it('a deleted comment sends no author name', () => {
		const top = ok(post('u2', 'Q'));
		ok(post('u1', 'A', top.id, 110));
		deleteComment(db, 'u2', top.id, 200);
		expect(list('u1')!.threads[0].top).toMatchObject({ body: null, authorName: null });
		expect(list('u1')!.threads[0].replies[0].authorName).toBe('Teo');
	});

	it('a member cannot restore what an editor deleted of someone else’s', () => {
		const c = ok(post('u3', 'editor'));
		deleteComment(db, 'u1', c.id, 200);
		expect(restoreComment(db, 'u2', c.id)).toBe(false);
		expect(restoreComment(db, 'u3', c.id)).toBe(true);
	});

	it('a deleted top with live replies is listed as deleted; without replies it is not', () => {
		const top = ok(post('u2', 'Q'));
		const reply = ok(post('u1', 'A', top.id, 110));
		deleteComment(db, 'u2', top.id, 200);
		let l = list('u1')!;
		expect(l.threads).toHaveLength(1);
		expect(l.threads[0].top).toMatchObject({ body: null, canDelete: false });
		expect(l.threads[0].replies.map((r) => r.id)).toEqual([reply.id]);
		deleteComment(db, 'u1', reply.id, 210);
		l = list('u1')!;
		expect(l.threads).toEqual([]);
	});

	it('hearting or replying to a deleted comment is refused', () => {
		const c = ok(post('u2', 'gone'));
		deleteComment(db, 'u2', c.id, 200);
		expect(toggleHeart(db, 'u1', c.id, 1)).toBeNull();
		expect(post('u1', 'x', c.id)).toMatchObject({ refused: 'reply' });
	});
});

describe('counts and the card', () => {
	it('count only live comments, newest is the latest live one', () => {
		const a = ok(post('u2', 'one', null, 100));
		const b = ok(post('u1', 'two', null, 200));
		expect(commentCard(db, 'u2', lesson)).toMatchObject({
			count: 2,
			newest: { name: 'Teo', teacher: true, text: 'two', at: 200 }
		});
		deleteComment(db, 'u1', b.id, 300);
		expect(commentCard(db, 'u2', lesson)).toMatchObject({
			count: 1,
			newest: { name: 'Maja', teacher: false, text: 'one' }
		});
		deleteComment(db, 'u2', a.id, 301);
		expect(commentCard(db, 'u2', lesson)).toEqual({ count: 0, newCount: 0, newest: null });
	});

	it('newCount counts others’ comments after the last open of the comments', () => {
		ok(post('u1', 'before', null, 100));
		ok(post('u3', 'later', null, 300));
		ok(post('u2', 'mine', null, 400));
		// Never opened: after joining (2) counts both of the others.
		expect(commentCard(db, 'u2', lesson)!.newCount).toBe(2);
		recordOpen(db, 'u2', 'comments', lesson, 200);
		expect(commentCard(db, 'u2', lesson)!.newCount).toBe(1); // only "later"
		recordOpen(db, 'u2', 'comments', lesson, 500);
		expect(commentCard(db, 'u2', lesson)!.newCount).toBe(0);
		// A lesson open is not a comments open.
		recordOpen(db, 'u3', 'lesson', lesson, 1000);
		expect(commentCard(db, 'u3', lesson)!.newCount).toBe(2);
	});

	it('comments do not touch the Groups dot or the new pills', async () => {
		const { whatsNew } = await import('./whats-new');
		recordOpen(db, 'u2', 'lesson', lesson, 10);
		ok(post('u1', 'hello', null, 100));
		expect(whatsNew(db, 'u2', 'salsa').byTeam.size).toBe(0);
	});
});

describe('the card on a page', () => {
	it('carries the lesson’s title and group, only for a group lesson the person reads', () => {
		ok(post('u1', 'hello', null, 100));
		expect(commentsOn(db, 'u2', lesson, 500)).toEqual({
			lessonId: lesson,
			lessonTitle: 'Tue 3 Nov',
			groupName: 'Salsa Tuesdays',
			card: commentCard(db, 'u2', lesson),
			// The server's clock, so the card's "2 days ago" is the same in SSR and hydration.
			now: 500
		});
		expect(commentsOn(db, 'u2', own, 500)).toBeNull();
		expect(commentsOn(db, 'u4', lesson, 500)).toBeNull();
		expect(commentsOn(db, 'u2', draft, 500)).toBeNull();
	});
});

describe('the lesson of an exercise page’s card', () => {
	const none = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };
	const exerciseRow = (id: number) =>
		db.select().from(exercises).where(eq(exercises.id, id)).get()!;
	const lessonOn = (day: string) => {
		const id = createLesson(db, T1_SALSA, { lessonDay: day, title: day, notes: null }).lesson.id;
		publishLesson(db, T1_SALSA, id, 6);
		return id;
	};

	it('a lesson review is about its own lesson', () => {
		addLesson(db, 'u2', lesson, { ...none, lesson: true }, 10);
		const review = entryFor(db, 'u2', { lessonId: lesson })!;
		expect(classLessonOf(db, 'u2', exerciseRow(review.id))).toBe(lesson);
	});

	it('a group drill, and an entry on it, are about the lesson holding it', () => {
		const drill = createCustomExercise(db, T1_SALSA, { name: 'Clave', everyDays: 3, notes: null });
		linkExercise(db, lesson, drill.id, 'u1');
		expect(classLessonOf(db, 'u2', exerciseRow(drill.id))).toBe(lesson);
		addLesson(db, 'u2', lesson, { ...none, drillIds: [drill.id] }, 10);
		const mine = entryFor(db, 'u2', { drillId: drill.id })!;
		expect(classLessonOf(db, 'u2', exerciseRow(mine.id))).toBe(lesson);
	});

	it('a routine entry is about the newest added lesson linking the routine', () => {
		const routine = createRoutine(db, T1_SALSA, { name: 'Rueda', notes: null }).routine.id;
		const later = lessonOn('2026-11-10');
		const latest = lessonOn('2026-11-17');
		for (const l of [lesson, later, latest]) linkRoutine(db, l, routine, 'u1');
		addLesson(db, 'u2', lesson, { ...none, routineIds: [routine] }, 10);
		const entry = entryFor(db, 'u2', { routineId: routine })!;
		expect(classLessonOf(db, 'u2', exerciseRow(entry.id))).toBe(lesson);
		addLesson(db, 'u2', later, { ...none, routineIds: [routine] }, 11);
		// The newest the person added, not the newest that links it.
		expect(classLessonOf(db, 'u2', exerciseRow(entry.id))).toBe(later);
	});

	it('a figure entry is about the newest added lesson linking the figure', () => {
		const fig = createFigure(db, T1_SALSA, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		const later = lessonOn('2026-11-10');
		const latest = lessonOn('2026-11-17');
		for (const l of [lesson, later, latest]) linkFigure(db, l, fig, 'u1');
		addLesson(db, 'u2', lesson, { ...none, figureIds: [fig] }, 10);
		const entry = entryFor(db, 'u2', { figureId: fig })!;
		expect(classLessonOf(db, 'u2', exerciseRow(entry.id))).toBe(lesson);
		addLesson(db, 'u2', later, { ...none, figureIds: [fig] }, 11);
		expect(classLessonOf(db, 'u2', exerciseRow(entry.id))).toBe(later);
	});

	it('a person’s own exercise or routine has none', () => {
		const mine = createCustomExercise(db, U2_SALSA, { name: 'Own', everyDays: 3, notes: null });
		expect(classLessonOf(db, 'u2', exerciseRow(mine.id))).toBeNull();
		const routine = createRoutine(db, U2_SALSA, { name: 'Mine', notes: null });
		expect(classLessonOf(db, 'u2', exerciseRow(routine.exercise.id))).toBeNull();
	});
});

describe('the wall', () => {
	it('a stranger gets 404 on everything', () => {
		const c = ok(post('u2', 'hi'));
		expect(list('u4')).toBeNull();
		expect(postComment(db, 'u4', lesson, 'x', null, 1)).toMatchObject({ refused: 'missing' });
		expect(toggleHeart(db, 'u4', c.id, 1)).toBeNull();
		expect(deleteComment(db, 'u4', c.id, 1)).toBe(false);
		expect(commentCard(db, 'u4', lesson)).toBeNull();
		expect(db.select().from(lessonComments).all()).toHaveLength(1);
	});

	it('a draft is a 404 for a member and open to an editor', () => {
		expect(list('u2', draft)).toBeNull();
		expect(post('u2', 'x', null, 1, draft)).toMatchObject({ refused: 'missing' });
		ok(post('u3', 'draft note', null, 1, draft));
		expect(list('u1', draft)!.threads).toHaveLength(1);
		expect(commentCard(db, 'u2', draft)).toBeNull();
	});

	it('a person’s own lesson has no comments', () => {
		expect(list('u2', own)).toBeNull();
		expect(post('u2', 'x', null, 1, own)).toMatchObject({ refused: 'missing' });
		expect(commentCard(db, 'u2', own)).toBeNull();
		expect(list('u1', 999)).toBeNull();
	});

	it('reply must stay in its lesson', () => {
		publishLesson(db, T1_SALSA, draft, 6);
		const other = ok(post('u2', 'elsewhere', null, 100, draft));
		expect(post('u2', 'sneaky', other.id, 110, lesson)).toMatchObject({ refused: 'reply' });
		expect(post('u2', 'ghost', 99999)).toMatchObject({ refused: 'reply' });
		expect(db.select().from(lessonComments).all()).toHaveLength(1);
	});

	it('hearts and deletes reach only through the comment’s lesson', () => {
		const c = ok(post('u3', 'draft', null, 1, draft));
		expect(toggleHeart(db, 'u2', c.id, 1)).toBeNull(); // a member cannot read the draft
		expect(deleteComment(db, 'u2', c.id, 1)).toBe(false);
	});
});

describe('a deleted group is read-only', () => {
	it('reads stay, writes are refused, nothing changes', () => {
		const c = ok(post('u2', 'hi'));
		expect(deleteTeam(db, 1, 'u1', 1000)).toBe(true);
		// Members read only the lessons they added once the group is deleted; the owner reads all.
		const l = list('u1')!;
		expect(l.open).toBe(false);
		expect(l.threads[0].top.canDelete).toBe(false);
		expect(post('u1', 'x')).toMatchObject({ refused: 'closed' });
		expect(toggleHeart(db, 'u1', c.id, 1)).toBeNull();
		expect(deleteComment(db, 'u1', c.id, 1)).toBe(false);
		expect(db.select().from(lessonCommentHearts).all()).toEqual([]);
		expect(db.select().from(lessonComments).all()[0].deletedAt).toBeNull();
	});
});

describe('someone who left', () => {
	it('keeps their name on their comments, loses the Teacher tag, and cannot read', async () => {
		const c = ok(post('u3', 'from an editor'));
		expect(list('u2')!.threads[0].top.teacher).toBe(true);
		expect(await leaveTeam(db, 1, 'u3', { mode: 'used' }, NO_FILES, 100)).toBe('left');
		const l = list('u2')!;
		expect(l.threads[0].top).toMatchObject({ id: c.id, authorName: 'Eva', teacher: false });
		expect(list('u3')).toBeNull();
		expect(postComment(db, 'u3', lesson, 'x', null, 1)).toMatchObject({ refused: 'missing' });
	});
});

describe('purge', () => {
	it('hard-deletes the group’s lessons’ comments and hearts only', async () => {
		createTeam(db, 'u4', 'salsa', 'Other', 1);
		const otherLesson = createLesson(
			db,
			{ teamId: 2, actorId: 'u4', dance: 'salsa' },
			{
				lessonDay: '2026-11-03',
				title: 'Other',
				notes: null
			}
		).lesson.id;
		publishLesson(db, { teamId: 2, actorId: 'u4', dance: 'salsa' }, otherLesson, 5);
		const c = ok(post('u2', 'bye'));
		ok(post('u1', 'reply', c.id, 110));
		toggleHeart(db, 'u1', c.id, 1);
		ok(postComment(db, 'u4', otherLesson, 'stays', null, 1));
		deleteTeam(db, 1, 'u1', 1000);
		await purgeTeams(db, 1000 + TEAM_PURGE_MS + 1, {
			lessonVideos: '/nonexistent',
			recordings: '/nonexistent',
			audio: '/nonexistent'
		});
		expect(db.select().from(teams).where(eq(teams.id, 1)).get()!.purgedAt).not.toBeNull();
		const left = db.select().from(lessonComments).all();
		expect(left.map((x) => x.lessonId)).toEqual([otherLesson]);
		expect(db.select().from(lessonCommentHearts).all()).toEqual([]);
		expect(db.select().from(opens).all()).toEqual([]);
	});
});

describe('refusals in the reader’s language', () => {
	const sl = <T>(fn: () => T) => runInLocale('sl', fn);

	it('the body, a reply and a deleted group, in Slovenian', () => {
		expect(sl(() => post('u2', ' '))).toEqual({
			refused: 'body',
			message: 'Najprej kaj napišite.'
		});
		const other = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-03',
			title: 'Other',
			notes: null
		}).lesson.id;
		publishLesson(db, T1_SALSA, other, 6);
		const elsewhere = ok(post('u2', 'elsewhere', null, 100, other));
		expect(sl(() => post('u2', 'x', elsewhere.id))).toEqual({
			refused: 'reply',
			message: 'Tega komentarja ni v tej lekciji.'
		});
		const gone = ok(post('u2', 'gone'));
		deleteComment(db, 'u2', gone.id, 200);
		expect(sl(() => post('u2', 'x', gone.id))).toEqual({
			refused: 'reply',
			message: 'Ta komentar je izbrisan.'
		});
		deleteTeam(db, 1, 'u1', 1000);
		expect(sl(() => post('u1', 'x'))).toEqual({
			refused: 'closed',
			message: 'Ta tečaj je izbrisan, zato lahko komentarje le še berete.'
		});
		expect(closedMessage()).toBe('This class has been deleted, so its comments can only be read.');
	});
});
