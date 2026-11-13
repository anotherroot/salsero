import { describe, expect, it } from 'vitest';
import {
	audible,
	focusWord,
	quietFor,
	quietForApp,
	takesPart,
	whileOpen,
	type Playing
} from './one-sound';

const p = (playing: boolean, muted = false, ambient = false): Playing => ({
	playing,
	muted,
	ambient
});
const look = (x: Playing) => x;

describe('one sound at a time', () => {
	it('a video that starts stops every other one playing', () => {
		const small = p(true);
		const full = p(true);
		const paused = p(false);
		expect(quietFor([small, full, paused], full, look)).toEqual([small]);
	});

	it('a muted video the person plays still stops another, and is stopped', () => {
		const small = p(true, true);
		const full = p(true);
		expect(quietFor([small, full], full, look)).toEqual([small]);
		expect(quietFor([small, full], small, look)).toEqual([full]);
	});

	it('a muted background loop neither stops nor is stopped', () => {
		const loop = p(true, true, true);
		const song = p(true);
		expect(quietFor([loop, song], loop, look)).toEqual([]);
		expect(quietFor([loop, song], song, look)).toEqual([]);
	});

	it('a background loop given the sound counts', () => {
		const loop = p(true, false, true);
		const song = p(true);
		expect(takesPart(loop)).toBe(true);
		expect(quietFor([loop, song], loop, look)).toEqual([song]);
	});

	it('another app taking the sound stops only what is audible', () => {
		const loud = p(true);
		const muted = p(true, true);
		const loop = p(true, true, true);
		expect(quietForApp([loud, muted, loop], look)).toEqual([loud]);
	});

	it('the app is told on while anything is audible', () => {
		expect(focusWord([p(false), p(true, true)], look)).toBe('off');
		expect(focusWord([p(false), p(true)], look)).toBe('on');
		expect(audible(p(true, true))).toBe(false);
	});
});

describe('a preview sheet over a player (picker preview)', () => {
	it('stops every other one that counts, before its own has started', () => {
		const lesson = p(true);
		const paused = p(false);
		const loop = p(true, true, true);
		const sheet = p(false);
		expect(whileOpen([lesson, paused, loop, sheet], sheet, look, () => true)).toEqual({
			stop: [lesson],
			resume: [lesson]
		});
	});

	it('resumes on Back only the plain media it stopped, never a run or a holder', () => {
		const lesson = p(true);
		const run = p(true);
		const sheet = p(false);
		expect(whileOpen([lesson, run, sheet], sheet, look, (x) => x !== run)).toEqual({
			stop: [lesson, run],
			resume: [lesson]
		});
	});
});
