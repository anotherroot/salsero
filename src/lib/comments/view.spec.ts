import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import {
	atReply,
	bodyError,
	cardWords,
	commentKey,
	COMMENT_MAX,
	composerPlaceholder,
	composerShown,
	deletedWords,
	heartToggled,
	hideReplies,
	initialOf,
	repliesLabel,
	replyingTo,
	shortAgo,
	shownIds,
	teacherTag,
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

	it('shows the composer only in an open sheet with an open, loaded list', () => {
		const l = listOf([]);
		expect(composerShown(true, l, null)).toBe(true);
		// Closed: the composer (and its unsaved text) goes, so nothing can post it later.
		expect(composerShown(false, l, null)).toBe(false);
		expect(composerShown(true, null, null)).toBe(false);
		expect(composerShown(true, { ...l, open: false }, null)).toBe(false);
		expect(composerShown(true, l, 'That did not work. Try again.')).toBe(false);
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

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	const card = (count: number, newCount: number) => ({ count, newCount, newest: null });

	it('counts the new ones in four forms', () => {
		expect(sl(() => cardWords(card(9, 1)).newPill)).toBe('1 nov');
		expect(sl(() => cardWords(card(9, 2)).newPill)).toBe('2 nova');
		expect(sl(() => cardWords(card(9, 3)).newPill)).toBe('3 novi');
		expect(sl(() => cardWords(card(9, 4)).newPill)).toBe('4 novi');
		expect(sl(() => cardWords(card(9, 5)).newPill)).toBe('5 novih');
		expect(sl(() => cardWords(card(9, 101)).newPill)).toBe('101 nov');
	});

	it('words the card, empty and not', () => {
		expect(sl(() => cardWords(card(0, 0)))).toEqual({
			title: 'Komentarji',
			count: null,
			newPill: null,
			empty: 'Še ni komentarjev. Vprašajte ali povejte kaj.'
		});
		expect(sl(() => cardWords(card(4, 0)).title)).toBe('Komentarji');
	});

	it('refuses an empty or too long comment', () => {
		expect(sl(() => bodyError(' '))).toBe('Najprej kaj napišite.');
		expect(sl(() => bodyError('a'.repeat(COMMENT_MAX + 1)))).toBe(
			'Komentar je lahko dolg največ 1000 znakov.'
		);
		expect(sl(() => bodyError('a'))).toBeNull();
	});

	it('marks a teacher with a word for a woman or a man', () => {
		expect(teacherTag()).toBe('Teacher');
		expect(sl(() => teacherTag())).toBe('vodja tečaja');
	});

	it('says replies in four forms, and the names after a colon', () => {
		expect(sl(() => repliesLabel(1))).toBe('1 odgovor');
		expect(sl(() => repliesLabel(2))).toBe('2 odgovora');
		expect(sl(() => repliesLabel(3))).toBe('3 odgovori');
		expect(sl(() => repliesLabel(5))).toBe('5 odgovorov');
		expect(sl(() => hideReplies())).toBe('Skrij odgovore');
		expect(sl(() => replyingTo('Maja'))).toBe('Odgovarjate: Maja');
		expect(sl(() => whoSees('Salsa Tuesdays'))).toBe('Komentarje vidi ves tečaj Salsa Tuesdays');
		expect(sl(() => deletedWords())).toBe('Komentar je izbrisan');
		expect(sl(() => composerPlaceholder())).toBe('Napišite komentar …');
	});

	it('says how long ago in words', () => {
		const now = 1_000 * 24 * 60 * MIN;
		const ago = (ms: number) => sl(() => shortAgo(now - ms, now));
		expect(ago(30_000)).toBe('pravkar');
		expect(ago(5 * MIN)).toBe('pred 5 min');
		expect(ago(3 * 60 * MIN)).toBe('pred 3 h');
		expect(ago(24 * 60 * MIN)).toBe('pred enim dnevom');
		expect(ago(2 * 24 * 60 * MIN)).toBe('pred 2 dnevoma');
		expect(ago(5 * 24 * 60 * MIN)).toBe('pred 5 dnevi');
		expect(ago(7 * 24 * 60 * MIN)).toBe('pred enim tednom');
		expect(ago(15 * 24 * 60 * MIN)).toBe('pred 2 tednoma');
		expect(ago(400 * 24 * 60 * MIN)).toBe('pred enim letom');
		expect(ago(3 * 365 * 24 * 60 * MIN)).toBe('pred 3 leti');
	});

	it('is English again outside', () => {
		expect(cardWords(card(9, 5)).newPill).toBe('5 new');
		expect(deletedWords()).toBe('Comment deleted');
		expect(hideReplies()).toBe('Hide replies');
		expect(composerPlaceholder()).toBe('Write a comment…');
	});
});
