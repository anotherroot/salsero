/**
 * Comments and hearts on a group's lessons (spec 2026-11-05-lesson-comments).
 * Anyone `lessonAccess` lets read the lesson may comment, reply and heart; a
 * person's own lesson has none. A deleted group is read-only. Delete is soft
 * (`deleted_at`), Undo clears it. Not in History and not in `MUTATIONS`: a
 * conversation, not the group's content.
 */
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from './db';
import {
	lessonCommentHearts,
	lessonComments,
	lessons,
	opens,
	teamMembers,
	teams
} from './db/schema';
import { lessonAccess } from './access';
import { teamNames } from './changes';
import { bodyError } from '$lib/comments/view';
import type { CommentCard, CommentList, CommentRow, CommentThread } from '$lib/types';

export type Comment = CommentRow;
export type CommentRefusal = {
	refused: 'missing' | 'closed' | 'body' | 'reply';
	message: string;
};

/** What a write says in a deleted group. */
export const CLOSED_MESSAGE = 'This class has been deleted, so its comments can only be read.';

type Ctx = {
	teamId: number;
	groupName: string;
	open: boolean;
};

/** The lesson a person may comment on or read comments of, or null (the 404). */
function lessonCtx(db: Db, userId: string, lessonId: number): Ctx | null {
	const lesson = db.select().from(lessons).where(eq(lessons.id, lessonId)).get();
	if (!lesson || lesson.teamId === null) return null;
	if (lessonAccess(db, userId, lesson) === null) return null;
	const team = db.select().from(teams).where(eq(teams.id, lesson.teamId)).get();
	if (!team || team.purgedAt !== null) return null;
	return { teamId: team.id, groupName: team.name, open: team.deletedAt === null };
}

function roleIn(db: Db, userId: string, teamId: number): string | null {
	return (
		db
			.select({ role: teamMembers.role })
			.from(teamMembers)
			.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
			.get()?.role ?? null
	);
}

const isTeacher = (role: string | null) => role === 'owner' || role === 'editor';

/** The comment and its lesson's context for this person, or null (the 404). */
function commentCtx(db: Db, userId: string, commentId: number) {
	const comment = db.select().from(lessonComments).where(eq(lessonComments.id, commentId)).get();
	if (!comment) return null;
	const ctx = lessonCtx(db, userId, comment.lessonId);
	return ctx ? { comment, ctx } : null;
}

/** Whether the person reaches this comment, and whether the group still lets them act on it. */
export function commentState(
	db: Db,
	userId: string,
	commentId: number
): 'missing' | 'closed' | 'open' {
	const found = commentCtx(db, userId, commentId);
	if (!found) return 'missing';
	return found.ctx.open ? 'open' : 'closed';
}

export function listComments(db: Db, userId: string, lessonId: number): CommentList | null {
	const ctx = lessonCtx(db, userId, lessonId);
	if (!ctx) return null;
	const all = db
		.select()
		.from(lessonComments)
		.where(eq(lessonComments.lessonId, lessonId))
		.orderBy(asc(lessonComments.createdAt), asc(lessonComments.id))
		.all();
	const byId = new Map(all.map((c) => [c.id, c]));
	const names = teamNames(db, ctx.teamId, [...new Set(all.map((c) => c.authorId))]);
	const roles = new Map(
		db
			.select({ userId: teamMembers.userId, role: teamMembers.role })
			.from(teamMembers)
			.where(eq(teamMembers.teamId, ctx.teamId))
			.all()
			.map((m) => [m.userId, m.role])
	);
	const heartRows =
		all.length === 0
			? []
			: db
					.select()
					.from(lessonCommentHearts)
					.where(
						inArray(
							lessonCommentHearts.commentId,
							all.map((c) => c.id)
						)
					)
					.all();
	const hearts = new Map<number, number>();
	const mineHearted = new Set<number>();
	for (const h of heartRows) {
		hearts.set(h.commentId, (hearts.get(h.commentId) ?? 0) + 1);
		if (h.userId === userId) mineHearted.add(h.commentId);
	}
	const iTeach = isTeacher(roles.get(userId) ?? null);

	const row = (c: (typeof all)[number]): CommentRow => {
		const target = c.replyToId === null ? null : byId.get(c.replyToId);
		const live = c.deletedAt === null;
		return {
			id: c.id,
			threadId: c.threadId,
			authorName: live ? (names.get(c.authorId) ?? 'Someone') : null,
			teacher: isTeacher(roles.get(c.authorId) ?? null),
			mine: c.authorId === userId,
			body: live ? c.body : null,
			at: c.createdAt,
			hearts: hearts.get(c.id) ?? 0,
			hearted: mineHearted.has(c.id),
			canDelete: ctx.open && live && (c.authorId === userId || iTeach),
			// Only a reply to another reply is drawn with "@Name".
			replyToName:
				target && target.threadId !== null ? (names.get(target.authorId) ?? 'Someone') : null
		};
	};

	const liveReplies = new Map<number, CommentRow[]>();
	for (const c of all) {
		if (c.threadId === null || c.deletedAt !== null) continue;
		const list = liveReplies.get(c.threadId) ?? [];
		list.push(row(c));
		liveReplies.set(c.threadId, list);
	}
	const threads: CommentThread[] = [];
	for (const c of all) {
		if (c.threadId !== null) continue;
		const replies = liveReplies.get(c.id) ?? [];
		if (c.deletedAt !== null && replies.length === 0) continue;
		threads.push({ top: row(c), replies });
	}
	threads.reverse(); // newest top comment first; replies stay oldest first
	return { threads, open: ctx.open, groupName: ctx.groupName };
}

function refuse(refused: CommentRefusal['refused'], message: string): CommentRefusal {
	return { refused, message };
}

export function postComment(
	db: Db,
	userId: string,
	lessonId: number,
	rawBody: string,
	replyTo: number | null,
	now: number
): Comment | CommentRefusal {
	const ctx = lessonCtx(db, userId, lessonId);
	if (!ctx) return refuse('missing', 'No such lesson');
	if (!ctx.open) return refuse('closed', CLOSED_MESSAGE);
	const problem = bodyError(rawBody);
	if (problem) return refuse('body', problem);
	const body = rawBody.trim();

	let threadId: number | null = null;
	if (replyTo !== null) {
		const target = db.select().from(lessonComments).where(eq(lessonComments.id, replyTo)).get();
		if (!target || target.lessonId !== lessonId) {
			return refuse('reply', 'That comment is not in this lesson.');
		}
		if (target.deletedAt !== null) return refuse('reply', 'That comment was deleted.');
		threadId = target.threadId ?? target.id;
	}
	const id = db
		.insert(lessonComments)
		.values({ lessonId, authorId: userId, threadId, replyToId: replyTo, body, createdAt: now })
		.returning({ id: lessonComments.id })
		.get().id;
	const list = listComments(db, userId, lessonId)!;
	for (const t of list.threads) {
		if (t.top.id === id) return t.top;
		const r = t.replies.find((x) => x.id === id);
		if (r) return r;
	}
	throw new Error('a posted comment is always listed');
}

/** Toggles the person's heart. Null: no such live comment for them, or the group is deleted. */
export function toggleHeart(
	db: Db,
	userId: string,
	commentId: number,
	now: number
): { hearted: boolean; count: number } | null {
	const found = commentCtx(db, userId, commentId);
	if (!found || !found.ctx.open || found.comment.deletedAt !== null) return null;
	return db.transaction((tx) => {
		const where = and(
			eq(lessonCommentHearts.commentId, commentId),
			eq(lessonCommentHearts.userId, userId)
		);
		const had = tx.select().from(lessonCommentHearts).where(where).get();
		if (had) tx.delete(lessonCommentHearts).where(where).run();
		else tx.insert(lessonCommentHearts).values({ commentId, userId, createdAt: now }).run();
		const count = tx
			.select()
			.from(lessonCommentHearts)
			.where(eq(lessonCommentHearts.commentId, commentId))
			.all().length;
		return { hearted: !had, count };
	});
}

/** The author, or an editor or the owner of the group, may delete or restore. */
function mayRemove(db: Db, userId: string, c: { authorId: string }, ctx: Ctx): boolean {
	return c.authorId === userId || isTeacher(roleIn(db, userId, ctx.teamId));
}

export function deleteComment(db: Db, userId: string, commentId: number, now: number): boolean {
	const found = commentCtx(db, userId, commentId);
	if (!found || !found.ctx.open || found.comment.deletedAt !== null) return false;
	if (!mayRemove(db, userId, found.comment, found.ctx)) return false;
	db.update(lessonComments)
		.set({ deletedAt: now, deletedBy: userId })
		.where(and(eq(lessonComments.id, commentId), isNull(lessonComments.deletedAt)))
		.run();
	return true;
}

export function restoreComment(db: Db, userId: string, commentId: number): boolean {
	const found = commentCtx(db, userId, commentId);
	if (!found || !found.ctx.open || found.comment.deletedAt === null) return false;
	// Undo is the deleter's; a teacher may always bring a comment back, an author may not undo a teacher.
	const undoes =
		found.comment.deletedBy === userId || isTeacher(roleIn(db, userId, found.ctx.teamId));
	if (!undoes) return false;
	db.update(lessonComments)
		.set({ deletedAt: null, deletedBy: null })
		.where(eq(lessonComments.id, commentId))
		.run();
	return true;
}

/** The card at the end of a lesson page; null when there is no group lesson to show (no group, no access). */
export function commentCard(db: Db, userId: string, lessonId: number): CommentCard | null {
	const ctx = lessonCtx(db, userId, lessonId);
	if (!ctx) return null;
	const live = db
		.select()
		.from(lessonComments)
		.where(and(eq(lessonComments.lessonId, lessonId), isNull(lessonComments.deletedAt)))
		.orderBy(desc(lessonComments.createdAt), desc(lessonComments.id))
		.all();
	if (live.length === 0) return { count: 0, newCount: 0, newest: null };
	const since =
		db
			.select({ at: opens.openedAt })
			.from(opens)
			.where(and(eq(opens.userId, userId), eq(opens.kind, 'comments'), eq(opens.itemId, lessonId)))
			.get()?.at ??
		db
			.select({ at: teamMembers.joinedAt })
			.from(teamMembers)
			.where(and(eq(teamMembers.teamId, ctx.teamId), eq(teamMembers.userId, userId)))
			.get()?.at ??
		0;
	const newCount = live.filter((c) => c.authorId !== userId && c.createdAt > since).length;
	const top = live[0];
	const names = teamNames(db, ctx.teamId, [top.authorId]);
	return {
		count: live.length,
		newCount,
		newest: {
			name: names.get(top.authorId) ?? 'Someone',
			teacher: isTeacher(roleIn(db, top.authorId, ctx.teamId)),
			text: top.body,
			at: top.createdAt
		}
	};
}
