import { describe, expect, it } from 'vitest';
import { getDance } from '$lib/dances/dances';
import type { CountPattern } from '$lib/labels';
import type { CountTakeRow } from '$lib/types';
import {
	exerciseLine,
	playState,
	practiceBack,
	runSubtitle,
	runSummary,
	setupSubtitle,
	stageDigit,
	stageDots,
	stageSize,
	voiceKind
} from './view';

const salsa = getDance('salsa');
const bachata = getDance('bachata');

const EX = { id: 9, name: 'Casino drill' };

describe('what the Practice page derives', () => {
	it('sizes the stage by what else shares the screen', () => {
		expect(stageSize(true, true)).toBe(136);
		expect(stageSize(false, true)).toBe(176);
		expect(stageSize(true, false)).toBe(176);
		expect(stageSize(false, false)).toBe(230);
	});
	it('puts the 1 in a disc, dims a paused count, shows – before the first beat', () => {
		expect(stageDigit(1, false)).toEqual({ text: '1', disc: true, dim: false });
		expect(stageDigit(1, true)).toEqual({ text: '1', disc: false, dim: true });
		expect(stageDigit(6, false)).toEqual({ text: '6', disc: false, dim: false });
		expect(stageDigit(null, false)).toEqual({ text: '–', disc: false, dim: true });
	});
	it('draws eight dots, the current one big, 4 and 8 quiet', () => {
		const d = stageDots(1, false);
		expect(d.map((x) => x.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		expect(d[0]).toEqual({ n: 1, size: 16, tone: 'now' });
		expect(d[1]).toEqual({ n: 2, size: 10, tone: 'beat' });
		expect(d[3]).toEqual({ n: 4, size: 10, tone: 'quiet' });
		expect(stageDots(6, true)[5]).toEqual({ n: 6, size: 16, tone: 'held' });
		expect(stageDots(null, false).some((x) => x.size === 16)).toBe(false);
	});
	it('says the routine and its size under Practice', () => {
		expect(setupSubtitle({ name: 'Casino basics', figureIds: [1, 2, 3, 4, 5, 6] })).toBe(
			'Casino basics · 6 figures'
		);
		expect(setupSubtitle({ name: 'Uno', figureIds: [9] })).toBe('Uno · 1 figure');
		expect(setupSubtitle(null)).toBeUndefined();
	});
	it('says what the run is running with', () => {
		expect(
			runSubtitle(
				{ routine: 'Casino basics', song: true, speed: 0.9, bpm: null, clave: '3-2' },
				salsa
			)
		).toBe('Casino basics · 0.9× · clave 3-2');
		expect(
			runSubtitle({ routine: null, song: false, speed: 1, bpm: 180, clave: '2-3' }, salsa)
		).toBe('180 BPM · clave 2-3');
		expect(
			runSubtitle(
				{ routine: 'Sensual flow', song: false, speed: 1, bpm: 128, clave: null },
				bachata
			)
		).toBe('Sensual flow · 128 BPM');
		expect(
			runSubtitle(
				{ routine: 'Sensual flow', song: false, speed: 1, bpm: 128, clave: '3-2' },
				bachata
			)
		).toBe('Sensual flow · 128 BPM');
		expect(
			runSubtitle({ routine: null, song: true, speed: 1, bpm: null, clave: null }, salsa)
		).toBeUndefined();
	});
	it('sums the run up, dropping the calls when nothing was called by design', () => {
		expect(runSummary(222, 12)).toBe('3:42 · 12 figures called · logged as a set');
		expect(runSummary(60, 1)).toBe('1:00 · 1 figure called · logged as a set');
		expect(runSummary(252, null)).toBe('4:12 · logged as a set');
	});
	it('says why Play cannot start', () => {
		const base = { source: 'song', songId: 4, ready: true, error: null, starting: false } as const;
		expect(playState({ ...base, source: 'count', songId: null, ready: false })).toEqual({
			disabled: false,
			busy: false,
			label: 'Play',
			why: null
		});
		expect(playState(base)).toEqual({ disabled: false, busy: false, label: 'Play', why: null });
		expect(playState({ ...base, songId: null, ready: false })).toEqual({
			disabled: true,
			busy: false,
			label: 'Play',
			why: 'Pick a song first.'
		});
		expect(playState({ ...base, ready: false })).toMatchObject({ disabled: true, why: null });
		expect(playState({ ...base, ready: false, error: 'x' })).toMatchObject({
			disabled: true,
			why: null
		});
		expect(playState({ ...base, starting: true })).toEqual({
			disabled: true,
			busy: true,
			label: 'Starting…',
			why: null
		});
	});
	it('calls the voice Yours only when a recorded set fits the tempo', () => {
		const take = (pattern: CountPattern, bpm: number, phrase: 'a' | 'b'): CountTakeRow => ({
			id: 1,
			pattern,
			bpm,
			phrase,
			file: 'x.wav',
			preRollS: 0.1,
			lengthS: 1.3
		});
		const takes = [take('salsa', 180, 'a'), take('salsa', 180, 'b')];
		expect(voiceKind([], 'salsa', 180)).toBe('Built-in');
		expect(voiceKind(takes, 'salsa', 180)).toBe('Yours');
		expect(voiceKind(takes, 'all', 180)).toBe('Built-in');
		expect(voiceKind(takes, 'salsa', 230)).toBe('Built-in');
		expect(voiceKind(takes, 'salsa', null)).toBe('Built-in');
	});
	it('describes the exercise a run logs to', () => {
		expect(exerciseLine({ source: 'routine', everyDays: 3 })).toBe('Routine · Every 3 days');
		expect(exerciseLine({ source: 'figure', everyDays: 7 })).toBe('Figure practice · Weekly');
	});
	it('shows no number for a count run without a tempo', () => {
		expect(
			runSubtitle({ routine: null, song: false, speed: 1, bpm: null, clave: null }, salsa)
		).toBeUndefined();
	});
	it('goes back where Practice was opened from', () => {
		const p = { dance: 'salsa', from: null, routine: null, song: null, exercise: null } as const;
		expect(practiceBack(p)).toEqual({ href: '/salsa/songs', label: 'Back to Music' });
		expect(practiceBack({ ...p, song: { id: 4, title: 'Vivir mi vida' } })).toEqual({
			href: '/salsa/songs/4',
			label: 'Back to Vivir mi vida'
		});
		expect(practiceBack({ ...p, routine: { id: 3, name: 'Casino basics' }, exercise: EX })).toEqual(
			{ href: '/salsa/routines/3', label: 'Back to Casino basics' }
		);
		expect(
			practiceBack({
				...p,
				from: 'today',
				routine: { id: 3, name: 'Casino basics' },
				exercise: EX
			})
		).toEqual({ href: '/salsa', label: 'Back to Today' });
		expect(practiceBack({ ...p, exercise: EX })).toEqual({
			href: '/salsa',
			label: 'Back to Today'
		});
	});
	it('goes back to the exercise page when opened from it', () => {
		const p = { dance: 'salsa', routine: { id: 3, name: 'Casino basics' }, song: null } as const;
		expect(practiceBack({ ...p, from: 'exercise', exercise: EX })).toEqual({
			href: '/salsa/exercises/9',
			label: 'Back to Casino drill'
		});
		// Without an exercise there is nothing to go back to.
		expect(practiceBack({ ...p, from: 'exercise', exercise: null }).href).toBe('/salsa/routines/3');
	});
	it('never lets `from` steer Back anywhere but Today', () => {
		const p = { dance: 'bachata', routine: null, song: null, exercise: null } as const;
		expect(practiceBack({ ...p, from: 'https://evil.example' })).toEqual({
			href: '/bachata/songs',
			label: 'Back to Music'
		});
		expect(practiceBack({ ...p, from: '//evil.example' }).href.startsWith('/bachata')).toBe(true);
	});
});
