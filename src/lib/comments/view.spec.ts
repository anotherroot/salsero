import { describe, expect, it } from 'vitest';
import {
	atReply,
	bodyError,
	cardWords,
	COMMENT_MAX,
	repliesLabel,
	replyingTo,
	whoSees
} from './view';

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
