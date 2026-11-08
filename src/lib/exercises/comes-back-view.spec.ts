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
	/** An untouched card, as each kind of row opens it. */
	const base: ComesBackChoice = {
		touched: false,
		useTeacher: false,
		mode: 'faces',
		until: false,
		good: 3,
		every: 1
	};
	const touched: ComesBackChoice = { ...base, touched: true };
	it('posts nothing for an entry whose class drill has no setting (or an unreadable one)', () => {
		// The card shows the faces; saving the notes must not make them the member's own.
		expect(postedFields(base)).toEqual({});
	});
	it("posts nothing for an entry following its teacher's setting", () => {
		expect(postedFields({ ...base, mode: 'every', every: 7 })).toEqual({});
		expect(postedFields({ ...base, until: true })).toEqual({});
	});
	it('posts nothing for an untouched own drill, group drill or New exercise', () => {
		expect(postedFields({ ...base, mode: 'every', every: 2 })).toEqual({});
		expect(postedFields({ ...base, until: true, good: 5 })).toEqual({});
		expect(postedFields(base)).toEqual({});
	});
	it('posts the chosen setting once touched', () => {
		expect(postedFields({ ...touched, mode: 'every', every: 2 })).toEqual({
			comesBack: 'every',
			every: '2'
		});
		expect(postedFields(touched)).toEqual({ comesBack: 'faces' });
	});
	it("posts only the teacher marker for Use my teacher's, touched or not", () => {
		expect(postedFields({ ...touched, useTeacher: true, mode: 'every' })).toEqual({
			comesBack: 'teacher'
		});
		expect(postedFields({ ...base, useTeacher: true })).toEqual({ comesBack: 'teacher' });
	});
	it('posts until and good only for faces with the switch on', () => {
		expect(postedFields({ ...touched, until: true, good: 5 })).toEqual({
			comesBack: 'faces',
			until: 'on',
			good: '5'
		});
	});
	it('posts every without until or good', () => {
		expect(postedFields({ ...touched, mode: 'every', every: 3, until: true, good: 5 })).toEqual({
			comesBack: 'every',
			every: '3'
		});
	});
});
