/**
 * PURE, client-safe: the words of comments, the "@Name" rule, the composer's
 * length check, and how the sheet's list changes as someone posts, hearts and
 * deletes (each returns a new list, the old one untouched).
 */
import type { CommentCard, CommentList, CommentRow } from '$lib/types';

export const COMMENT_MAX = 1000;

/** Why a comment cannot be sent, or null. Counted after trimming. */
export function bodyError(body: string): string | null {
	const text = body.trim();
	if (text.length === 0) return 'Write something first.';
	if (Array.from(text).length > COMMENT_MAX) {
		return `A comment can be at most ${COMMENT_MAX} characters.`;
	}
	return null;
}

/** "@Maja" for a reply to another reply, else nothing. */
export function atReply(row: Pick<CommentRow, 'replyToName'>): string | null {
	return row.replyToName ? `@${row.replyToName}` : null;
}

export function whoSees(groupName: string): string {
	return `Everyone in ${groupName} sees it`;
}

export function repliesLabel(n: number): string {
	return n === 1 ? '1 reply' : `${n} replies`;
}

export const HIDE_REPLIES = 'Hide replies';
export const DELETED_WORDS = 'Comment deleted';
export const COMPOSER_PLACEHOLDER = 'Write a comment…';
export const TEACHER_TAG = 'Teacher';

export function replyingTo(name: string): string {
	return `Replying to ${name}`;
}

/** What the card says: its title, the count, the "N new" pill, or the invitation when empty. */
export function cardWords(
	card: CommentCard,
	title = 'Comments'
): { title: string; count: string | null; newPill: string | null; empty: string | null } {
	if (card.count === 0) {
		return { title, count: null, newPill: null, empty: 'Be the first to ask or say something' };
	}
	return {
		title,
		count: String(card.count),
		newPill: card.newCount > 0 ? `${card.newCount} new` : null,
		empty: null
	};
}

const MINUTE = 60_000;

/** The name line's "2 d": now, minutes, hours, days, weeks, years. */
export function shortAgo(at: number, now: number): string {
	const min = Math.floor(Math.max(0, now - at) / MINUTE);
	if (min < 1) return 'now';
	if (min < 60) return `${min} min`;
	const h = Math.floor(min / 60);
	if (h < 24) return `${h} h`;
	const d = Math.floor(h / 24);
	if (d < 7) return `${d} d`;
	if (d < 365) return `${Math.floor(d / 7)} w`;
	return `${Math.floor(d / 365)} y`;
}

/** The avatar's letter; none for a deleted comment. */
export function initialOf(name: string | null): string {
	const first = name ? Array.from(name.trim())[0] : undefined;
	return first ? first.toLocaleUpperCase() : '';
}

/** `data-focus` of a comment, for focus after a removal. */
export const commentKey = (id: number) => `comment-${id}`;

/** What a tap on the heart shows at once, before the server answers. */
export function heartToggled(row: CommentRow): Pick<CommentRow, 'hearted' | 'hearts'> {
	return row.hearted
		? { hearted: false, hearts: Math.max(0, row.hearts - 1) }
		: { hearted: true, hearts: row.hearts + 1 };
}

function mapRows(list: CommentList, fn: (row: CommentRow) => CommentRow): CommentList {
	return {
		...list,
		threads: list.threads.map((t) => ({ top: fn(t.top), replies: t.replies.map(fn) }))
	};
}

export function withHearts(
	list: CommentList,
	id: number,
	hearts: Pick<CommentRow, 'hearted' | 'hearts'>
): CommentList {
	return mapRows(list, (r) => (r.id === id ? { ...r, ...hearts } : r));
}

/** A new top comment goes first; a reply at the end of its thread (oldest first). */
export function withPosted(list: CommentList, row: CommentRow): CommentList {
	if (row.threadId === null) {
		return { ...list, threads: [{ top: row, replies: [] }, ...list.threads] };
	}
	return {
		...list,
		threads: list.threads.map((t) =>
			t.top.id === row.threadId ? { ...t, replies: [...t.replies, row] } : t
		)
	};
}

/**
 * The list once a comment is deleted, as the server will list it: a top
 * comment with live replies stays as "Comment deleted"; anything else goes,
 * and a deleted top goes with its last reply.
 */
export function withoutComment(list: CommentList, id: number): CommentList {
	const threads: CommentList['threads'] = [];
	for (const t of list.threads) {
		if (t.top.id === id) {
			if (t.replies.length === 0) continue;
			const gone = { body: null, authorName: null, canDelete: false, teacher: false };
			threads.push({ ...t, top: { ...t.top, ...gone } });
			continue;
		}
		const replies = t.replies.filter((r) => r.id !== id);
		if (replies.length === 0 && t.top.body === null) continue;
		threads.push(replies.length === t.replies.length ? t : { ...t, replies });
	}
	return { ...list, threads };
}

/**
 * Whether the sheet draws its composer. Only while the sheet is open: Sheet
 * draws a footer even when closed, and a composer left there would keep text
 * the person threw away as "unsaved", for a later Save to post.
 */
export function composerShown(
	sheetOpen: boolean,
	list: CommentList | null,
	loadError: string | null
): boolean {
	return sheetOpen && loadError === null && list !== null && list.open;
}

/** The comments on screen, top to bottom: every top comment, and the replies of open threads. */
export function shownIds(list: CommentList, open: ReadonlySet<number>): number[] {
	return list.threads.flatMap((t) => [
		t.top.id,
		...(open.has(t.top.id) ? t.replies.map((r) => r.id) : [])
	]);
}
