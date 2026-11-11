import { describe, expect, it } from 'vitest';
import { commonShift, roundScore, scoreDrop, shownShift } from './score';

const perfect = {
	spot: 10,
	close: 0,
	of: 10,
	restarts: 0,
	listenEights: 1,
	skipped: false,
	shift: 0
};

describe('scoreDrop', () => {
	it('takes 15 % for each start-over', () => {
		const s = scoreDrop({ ...perfect, restarts: 5 });
		expect(s.score).toBeCloseTo(44.37, 1);
		expect(s.restartsLoss).toBeCloseTo(55.63, 1);
		expect(s.timing).toBe(100);
	});

	it('lets two eights of listening go free, then takes 5 % an eight', () => {
		expect(scoreDrop({ ...perfect, listenEights: 2 }).score).toBe(100);
		expect(scoreDrop({ ...perfect, listenEights: 3 }).score).toBeCloseTo(95, 6);
		expect(scoreDrop({ ...perfect, listenEights: 4 }).score).toBeCloseTo(90.25, 6);
	});

	it('counts a close beat as 0.7 of one on time', () => {
		expect(scoreDrop({ ...perfect, spot: 8, close: 2 }).timing).toBeCloseTo(94, 6);
	});

	it('adds up: timing less what restarts and listening took', () => {
		const s = scoreDrop({ ...perfect, spot: 7, close: 2, restarts: 2, listenEights: 3.5 });
		expect(s.timing - s.restartsLoss - s.listenLoss).toBeCloseTo(s.score, 9);
	});

	it('gives a skipped spot nothing', () => {
		expect(scoreDrop({ ...perfect, skipped: true })).toEqual({
			score: 0,
			timing: 0,
			restartsLoss: 0,
			listenLoss: 0,
			countLoss: 0
		});
	});
});

describe('the count', () => {
	it('keeps half for 4 off, a quarter for 2 off, a tenth for 1 off', () => {
		const four = scoreDrop({ ...perfect, shift: 4 });
		expect(four).toMatchObject({ score: 50, countLoss: 50 });
		expect(scoreDrop({ ...perfect, shift: 2 }).score).toBeCloseTo(25, 9);
		expect(scoreDrop({ ...perfect, shift: 1 }).score).toBeCloseTo(10, 9);
	});

	it('adds up with the restarts and the listening', () => {
		const s = scoreDrop({
			...perfect,
			spot: 7,
			close: 2,
			restarts: 2,
			listenEights: 3.5,
			shift: 4
		});
		expect(s.timing - s.countLoss - s.restartsLoss - s.listenLoss).toBeCloseTo(s.score, 9);
	});
});

describe('commonShift', () => {
	it('names the shift seen most, when there is one', () => {
		expect(commonShift([0, 4, 4, 2, 0])).toEqual({ shift: 4, drops: 2 });
		expect(commonShift([0, 0])).toBeNull();
	});
});

describe('roundScore', () => {
	it('averages the drops, rounded', () => {
		const r = roundScore([scoreDrop(perfect), scoreDrop({ ...perfect, spot: 5, close: 0 })]);
		expect(r).toEqual({ score: 75, timing: 75, restartsLoss: 0, listenLoss: 0, countLoss: 0 });
	});

	it('is nothing for no drops', () => {
		expect(roundScore([])).toEqual({
			score: 0,
			timing: 0,
			restartsLoss: 0,
			listenLoss: 0,
			countLoss: 0
		});
	});
});

describe('commonShift needs a habit', () => {
	it('needs two drops, and at least as many as were on the count', () => {
		expect(commonShift([4, 0, 0, 0])).toBeNull();
		expect(commonShift([4, 4, 0, 0])).toEqual({ shift: 4, drops: 2 });
		expect(commonShift([4, 4, 0, 0, 0])).toBeNull();
	});
});

describe('shownShift', () => {
	it('says how far off, whichever way round', () => {
		expect(shownShift(7)).toBe(1);
		expect(shownShift(6)).toBe(2);
		expect(shownShift(4)).toBe(4);
		expect(shownShift(0)).toBe(0);
	});
});
