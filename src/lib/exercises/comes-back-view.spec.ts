import { describe, expect, it } from 'vitest';
import { comesBackWords, GOOD_MEANS, learningNote, teacherLine } from './comes-back-view';

describe('comes back words', () => {
	it('names each setting', () => {
		expect(comesBackWords({ kind: 'faces' })).toBe('By how it went');
		expect(comesBackWords({ kind: 'until', good: 3, since: 0 })).toBe(
			'Every day until it feels good on 3 days'
		);
		expect(comesBackWords({ kind: 'until', good: 5, since: 0 })).toBe(
			'Every day until it feels good on 5 days'
		);
		expect(comesBackWords({ kind: 'every', days: 1 })).toBe('Every day');
		expect(comesBackWords({ kind: 'every', days: 2 })).toBe('Every 2 days');
		expect(comesBackWords({ kind: 'every', days: 3 })).toBe('Every 3 days');
		expect(comesBackWords({ kind: 'every', days: 7 })).toBe('Weekly');
	});
	it('says how many good days so far, or only what good means', () => {
		expect(learningNote(2, 3)).toBe("Good means I've got it or Easy. 2 of 3 so far.");
		expect(learningNote(0, 5)).toBe("Good means I've got it or Easy. 0 of 5 so far.");
		expect(learningNote(4, 3)).toBe("Good means I've got it or Easy. 3 of 3 so far.");
		expect(learningNote(null, 3)).toBe(GOOD_MEANS);
	});
	it("gives a member's teacher line in lower case after the colon", () => {
		expect(teacherLine({ kind: 'until', good: 3, since: 0 })).toBe(
			'Your teacher set: every day until it feels good on 3 days'
		);
		expect(teacherLine({ kind: 'faces' })).toBe('Your teacher set: by how it went');
		expect(teacherLine({ kind: 'every', days: 7 })).toBe('Your teacher set: weekly');
	});
});
