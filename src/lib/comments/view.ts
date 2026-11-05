/** PURE, client-safe: the words of comments, the "@Name" rule and the composer's length check. */
import type { CommentCard, CommentRow } from '$lib/types';

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
export const DELETED_TOAST = 'Comment deleted · Undo';
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
