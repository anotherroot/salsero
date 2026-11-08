import { describe, expect, it } from 'vitest';
import {
	comesBackWords,
	GOOD_MEANS,
	learningNote,
	postedFields,
	teacherLine,
	type ComesBackChoice
} from './comes-back-view';

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

describe('postedFields', () => {
	const base: ComesBackChoice = {
		following: false,
		touched: false,
		useTeacher: false,
		mode: 'faces',
		until: false,
		good: 3,
		every: 1
	};
	it("posts nothing for an entry following its teacher's setting until it is touched", () => {
		expect(postedFields({ ...base, following: true, mode: 'every', every: 7 })).toEqual({});
		expect(postedFields({ ...base, following: true, until: true })).toEqual({});
	});
	it('posts the chosen setting once a following entry is touched', () => {
		expect(
			postedFields({ ...base, following: true, touched: true, mode: 'every', every: 2 })
		).toEqual({
			comesBack: 'every',
			every: '2'
		});
	});
	it("posts only the teacher marker for Use my teacher's, even if following and touched", () => {
		expect(postedFields({ ...base, useTeacher: true, touched: true, mode: 'every' })).toEqual({
			comesBack: 'teacher'
		});
	});
	it('always posts a setting of its own', () => {
		expect(postedFields(base)).toEqual({ comesBack: 'faces' });
	});
	it('posts until and good only for faces with the switch on', () => {
		expect(postedFields({ ...base, until: true, good: 5 })).toEqual({
			comesBack: 'faces',
			until: 'on',
			good: '5'
		});
	});
	it('posts every without until or good', () => {
		expect(postedFields({ ...base, mode: 'every', every: 3, until: true, good: 5 })).toEqual({
			comesBack: 'every',
			every: '3'
		});
	});
});
