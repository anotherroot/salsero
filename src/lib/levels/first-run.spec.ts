import { describe, expect, it } from 'vitest';
import { afterJoin, afterSkip, inviteCodeOf, joinStepHref, SLIDES } from './first-run';

describe('the first run', () => {
	it('has three slides', () => {
		expect(SLIDES.map((s) => s.title)).toEqual([
			'Practise what you learned in class',
			'A few things a day',
			'You say when it comes back'
		]);
	});
	it('reads the code of the teacher link', () => {
		expect(inviteCodeOf('/g/ABC123')).toBe('ABC123');
		expect(inviteCodeOf('/g/ab%20c?x=1')).toBe('ab c');
		expect(inviteCodeOf('/salsa/groups')).toBeNull();
		expect(inviteCodeOf('/g/')).toBeNull();
	});
	it('ends on the joined class dance Today unless next is a real page', () => {
		expect(afterJoin('/', 'bachata')).toBe('/bachata');
		expect(afterJoin('/g/ABC', 'bachata')).toBe('/bachata');
		expect(afterJoin('/salsa/songs', 'bachata')).toBe('/salsa/songs');
	});
	it('does not send Not now back to the join link', () => {
		expect(afterSkip('/g/ABC')).toBe('/');
		expect(afterSkip('/salsa/songs')).toBe('/salsa/songs');
	});
	it('keeps next in the join step link', () => {
		expect(joinStepHref('/g/A B')).toBe('/welcome/start?step=join&next=%2Fg%2FA%20B');
	});
});
