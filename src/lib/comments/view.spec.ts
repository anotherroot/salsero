import { describe, expect, it } from 'vitest';
import {
	atReply,
	bodyError,
	cardWords,
	commentKey,
	COMMENT_MAX,
	heartToggled,
	initialOf,
	repliesLabel,
	replyingTo,
	shortAgo,
	shownIds,
	whoSees,
	withHearts,
	withoutComment,
	withPosted
} from './view';
import type { CommentList, CommentRow, CommentThread } from '$lib/types';

describe('comment words', () => {
	it('checks the length after trimming', () => {
		expect(bodyError('')).not.toBeNull();
		expect(bodyError('  \n ')).not.toBeNull();
		expect(bodyError('a')).toBeNull();
		expect(bodyError(' ' + 'a'.repeat(COMMENT_MAX) + ' ')).toBeNull();
		expect(bodyError('a'.repeat(COMMENT_MAX + 1))).toMatch(/1000/);
	});

	it('marks only a reply to a reply', () => {
		expect(atReply({ replyToName: 'Maja' })).toBe('@Maja');
		expect(atReply({ replyToName: null })).toBeNull();
	});

	it('says who sees it, and the replies', () => {
		expect(whoSees('Salsa Tuesdays')).toBe('Everyone in Salsa Tuesdays sees it');
		expect(repliesLabel(1)).toBe('1 reply');
		expect(repliesLabel(3)).toBe('3 replies');
		expect(replyingTo('Maja')).toBe('Replying to Maja');
	});

	it('words the card', () => {
		expect(cardWords({ count: 0, newCount: 0, newest: null })).toEqual({
			title: 'Comments',
			count: null,
			newPill: null,
			empty: 'Be the first to ask or say something'
		});
		const w = cardWords({ count: 4, newCount: 2, newest: null }, 'Comments on the class');
		expect(w).toEqual({
			title: 'Comments on the class',
			count: '4',
			newPill: '2 new',
			empty: null
		});
		expect(cardWords({ count: 4, newCount: 0, newest: null }).newPill).toBeNull();
	});
});

const MIN = 60_000;
const row = (id: number, over: Partial<CommentRow> = {}): CommentRow => ({
	id,
	threadId: null,
	authorName: 'Maja',
	teacher: false,
	mine: false,
	body: `c${id}`,
	at: id,
	hearts: 0,
	hearted: false,
	canDelete: true,
	replyToName: null,
	...over
});
const reply = (id: number, threadId: number, over: Partial<CommentRow> = {}) =>
	row(id, { threadId, ...over });
const listOf = (threads: CommentThread[]): CommentList => ({
	threads,
	open: true,
	groupName: 'Salsa Tuesdays'
});
const ids = (l: CommentList) => l.threads.map((t) => [t.top.id, t.replies.map((r) => r.id)]);

describe('the sheet’s small words', () => {
	it('says how long ago, short', () => {
		const now = 1_000 * 24 * 60 * MIN;
		expect(shortAgo(now - 30_000, now)).toBe('now');
		expect(shortAgo(now + 5_000, now)).toBe('now'); // a clock a little ahead
		expect(shortAgo(now - 5 * MIN, now)).toBe('5 min');
		expect(shortAgo(now - 3 * 60 * MIN, now)).toBe('3 h');
		expect(shortAgo(now - 2 * 24 * 60 * MIN, now)).toBe('2 d');
		expect(shortAgo(now - 15 * 24 * 60 * MIN, now)).toBe('2 w');
		expect(shortAgo(now - 400 * 24 * 60 * MIN, now)).toBe('1 y');
	});

	it('takes the initial of a name, none for a deleted comment', () => {
		expect(initialOf('maja')).toBe('M');
		expect(initialOf('Žana')).toBe('Ž');
		expect(initialOf(null)).toBe('');
	});
});

describe('the list as it changes in the sheet', () => {
	it('a heart toggles on and off', () => {
		expect(heartToggled(row(1))).toEqual({ hearted: true, hearts: 1 });
		expect(heartToggled(row(1, { hearted: true, hearts: 3 }))).toEqual({
			hearted: false,
			hearts: 2
		});
		const l = listOf([{ top: row(2), replies: [reply(3, 2)] }]);
		const after = withHearts(l, 3, { hearted: true, hearts: 1 });
		expect(after.threads[0].replies[0]).toMatchObject({ hearted: true, hearts: 1 });
		expect(after.threads[0].top).toEqual(row(2));
		expect(l.threads[0].replies[0].hearted).toBe(false); // the old list is untouched
	});

	it('a posted top comment goes first, a reply at the end of its thread', () => {
		const l = listOf([
			{ top: row(2), replies: [reply(3, 2)] },
			{ top: row(1), replies: [] }
		]);
		expect(ids(withPosted(l, row(9)))).toEqual([
			[9, []],
			[2, [3]],
			[1, []]
		]);
		expect(ids(withPosted(l, reply(9, 1)))).toEqual([
			[2, [3]],
			[1, [9]]
		]);
		expect(ids(withPosted(l, reply(9, 2)))).toEqual([
			[2, [3, 9]],
			[1, []]
		]);
	});

	it('removing a comment follows the deleted rule', () => {
		const l = listOf([
			{ top: row(2), replies: [reply(3, 2), reply(4, 2)] },
			{ top: row(1), replies: [] }
		]);
		// A top with live replies stays as "Comment deleted".
		const topGone = withoutComment(l, 2);
		expect(ids(topGone)).toEqual([
			[2, [3, 4]],
			[1, []]
		]);
		expect(topGone.threads[0].top).toMatchObject({
			body: null,
			authorName: null,
			canDelete: false
		});
		// A top without replies goes.
		expect(ids(withoutComment(l, 1))).toEqual([[2, [3, 4]]]);
		// A reply goes; a deleted top loses its thread with its last reply.
		expect(ids(withoutComment(l, 3))).toEqual([
			[2, [4]],
			[1, []]
		]);
		expect(ids(withoutComment(withoutComment(withoutComment(l, 2), 3), 4))).toEqual([[1, []]]);
	});

	it('lists the comments on screen in order, replies only of open threads', () => {
		const l = listOf([
			{ top: row(2), replies: [reply(3, 2)] },
			{ top: row(1), replies: [reply(5, 1)] }
		]);
		expect(shownIds(l, new Set())).toEqual([2, 1]);
		expect(shownIds(l, new Set([1]))).toEqual([2, 1, 5]);
		expect(commentKey(5)).toBe('comment-5');
	});
});
