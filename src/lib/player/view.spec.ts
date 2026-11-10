import { describe, expect, it } from 'vitest';
import { getDance } from '$lib/dances/dances';
import { withLocale } from '$lib/i18n/current';
import type { CountPattern } from '$lib/labels';
import type { CountTakeRow, RunClip, RunDetails } from '$lib/types';
import {
	aboutShown,
	mayAutoPlay,
	slotDetails,
	aboutPreview,
	hasDetails,
	routinePreview,
	runTitle,
	voicePreview,
	exercisePlayerHref,
	routinePractiseHref,
	playState,
	practiceBack,
	routinePlace,
	stepDone,
	stepMarks,
	runSubtitle,
	runSources,
	setupSubtitle,
	slotTone,
	stageDigit,
	stageDots,
	voiceKind
} from './view';

const salsa = getDance('salsa');
const bachata = getDance('bachata');

const EX = { id: 9, name: 'Casino drill' };

describe('what the Practice page derives', () => {
	it('draws the 1 like every count, dims a paused count, shows – before the first beat', () => {
		expect(stageDigit(1, false)).toEqual({ text: '1', dim: false });
		expect(stageDigit(1, true)).toEqual({ text: '1', dim: true });
		expect(stageDigit(6, false)).toEqual({ text: '6', dim: false });
		expect(stageDigit(null, false)).toEqual({ text: '–', dim: true });
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
	it('goes back where Practice was opened from', () => {
		const p = {
			dance: 'salsa',
			from: null,
			routine: null,
			song: null,
			exercise: null,
			run: null
		} as const;
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
		const p = {
			dance: 'salsa',
			routine: { id: 3, name: 'Casino basics' },
			song: null,
			run: null
		} as const;
		expect(practiceBack({ ...p, from: 'exercise', exercise: EX })).toEqual({
			href: '/salsa/exercises/9',
			label: 'Back to Casino drill'
		});
		// Without an exercise there is nothing to go back to.
		expect(practiceBack({ ...p, from: 'exercise', exercise: null }).href).toBe('/salsa/routines/3');
		// An archived exercise's page 404s.
		expect(practiceBack({ ...p, from: 'exercise', exercise: { ...EX, archived: true } }).href).toBe(
			'/salsa/routines/3'
		);
	});
	it("goes back to the run's exercise page from a run", () => {
		const p = { dance: 'salsa', routine: null, song: null } as const;
		expect(
			practiceBack({
				...p,
				from: 'run',
				exercise: { id: 4, name: 'Warmup' },
				run: { skip: [3] }
			})
		).toEqual({ href: '/salsa/exercises/4?run=1&skip=3', label: 'Back to Warmup' });
		// An archived exercise's page 404s: Back falls through to Today.
		expect(
			practiceBack({
				...p,
				from: 'run',
				exercise: { id: 4, name: 'Warmup', archived: true },
				run: { skip: [] }
			}).href
		).toBe('/salsa');
		// No run: `from=run` is an unknown `from`.
		expect(
			practiceBack({ ...p, from: 'run', exercise: { id: 4, name: 'Warmup' }, run: null }).href
		).toBe('/salsa');
	});
	it('never lets `from` steer Back anywhere but Today', () => {
		const p = { dance: 'bachata', routine: null, song: null, exercise: null, run: null } as const;
		expect(practiceBack({ ...p, from: 'https://evil.example' })).toEqual({
			href: '/bachata/songs',
			label: 'Back to Music'
		});
		expect(practiceBack({ ...p, from: '//evil.example' }).href.startsWith('/bachata')).toBe(true);
	});
});

describe('the run on desk', () => {
	it('tones a routine row: the one called now, the danced ones, the ones to come', () => {
		expect(slotTone(1, 1)).toBe('now');
		expect(slotTone(0, 1)).toBe('past');
		expect(slotTone(2, 1)).toBe('next');
		expect(slotTone(0, null)).toBe('next');
		expect(slotTone(0, 0)).toBe('now'); // a looping routine back at its first slot: nothing is past
	});
});

describe('the routine run', () => {
	it('says where the run is, or how long the routine is', () => {
		expect(routinePlace(4, 16)).toBe('5 of 16');
		expect(routinePlace(null, 16)).toBe('16 figures');
		expect(routinePlace(null, 1)).toBe('1 figure');
	});

	it('marks each count of a figure up to 16, else each 8-count', () => {
		expect(stepMarks(8)).toEqual({ marks: 8, per: 1 });
		expect(stepMarks(16)).toEqual({ marks: 16, per: 1 });
		expect(stepMarks(32)).toEqual({ marks: 4, per: 8 });
		expect(stepMarks(0)).toEqual({ marks: 1, per: 1 });
	});

	it('fills a mark per beat from the figure\'s "1"', () => {
		const beats = Array.from({ length: 64 }, (_, i) => i * 0.5);
		const eight = stepMarks(8);
		expect(stepDone(beats, 4, 4, eight)).toBe(1);
		expect(stepDone(beats, 4, 5.1, eight)).toBe(3);
		expect(stepDone(beats, 4, 30, eight)).toBe(8);
		expect(stepDone(beats, 4, 3, eight)).toBe(0);
		const long = stepMarks(32);
		expect(stepDone(beats, 4, 8.5, long)).toBe(2);
	});
});

describe('runSources', () => {
	it('names the Source switch in the reader’s language, read when asked', () => {
		expect(runSources()).toEqual([
			{ value: 'count', label: 'Count only' },
			{ value: 'song', label: 'A song' }
		]);
		expect(withLocale('sl', () => runSources().map((s) => s.label))).toEqual([
			'Samo štetje',
			'Skladba'
		]);
	});
});

describe('the Practice page in Slovenian', () => {
	const sl = <T>(fn: () => T): T => withLocale('sl', fn);

	it('counts the routine’s versions with Slovenian plurals', () => {
		expect(sl(() => setupSubtitle({ name: 'Prva', figureIds: [1, 2] }))).toBe('Prva · 2 figuri');
		expect(sl(() => setupSubtitle({ name: 'Prva', figureIds: [1, 2, 3, 4, 5] }))).toBe(
			'Prva · 5 figur'
		);
	});

	it('says why Play waits, whose voice counts, and where Back goes', () => {
		expect(
			sl(() =>
				playState({ source: 'song', songId: null, ready: false, error: null, starting: false })
			)
		).toEqual({
			disabled: true,
			busy: false,
			label: 'Predvajaj',
			why: 'Najprej izberite skladbo.'
		});
		expect(sl(() => voiceKind([], 'salsa', 180))).toBe('Vgrajen');
		const p = { dance: 'salsa', routine: null, song: null, exercise: null, run: null } as const;
		expect(sl(() => practiceBack({ ...p, from: 'today' }).label)).toBe('Nazaj: Danes');
		expect(sl(() => practiceBack({ ...p, from: null }).label)).toBe('Nazaj: Glasba');
	});
});

describe('the exercise page opens the player', () => {
	it('links the exercise, where it was opened from, and Play at once when asked', () => {
		expect(exercisePlayerHref('salsa', 7, 'from=exercise', false)).toBe(
			'/salsa/player?exercise=7&from=exercise'
		);
		expect(exercisePlayerHref('salsa', 7, 'from=run&skip=3,5', true)).toBe(
			'/salsa/player?exercise=7&from=run&skip=3,5&play=1'
		);
	});
	it("runs a routine's exercise on its routine", () => {
		expect(exercisePlayerHref('salsa', 79, 'from=exercise', true, 14)).toBe(
			'/salsa/player?routine=14&exercise=79&from=exercise&play=1'
		);
	});
});

describe("the routine page's Practise", () => {
	it('lands on its exercise page when it has one', () => {
		expect(routinePractiseHref('salsa', 14, 79)).toBe('/salsa/exercises/79');
	});
	it('opens the player on the routine alone when it has none', () => {
		expect(routinePractiseHref('salsa', 14, null)).toBe('/salsa/player?routine=14');
	});
});

describe('the run in one player (B2)', () => {
	const none: RunDetails = {
		heading: 'Clave countind and clapping',
		facts: [],
		hasPositions: false,
		notes: null,
		clips: [],
		links: [],
		figures: []
	};
	const section = (n: number): RunClip => ({
		kind: 'section',
		src: '/lesson-videos/a.mp4',
		startMs: n,
		endMs: n + 1000,
		caption: 'Nadaljevalna · 0:42–0:58'
	});
	const recording: RunClip = {
		kind: 'recording',
		src: '/recordings/r.mp4',
		startMs: 0,
		endMs: null,
		caption: 'Recording'
	};
	const link = { url: 'https://youtu.be/x', title: 'Pa ti pa mi' };

	it('has details only when there is something to read', () => {
		expect(hasDetails(null)).toBe(false);
		expect(hasDetails(none)).toBe(false);
		expect(hasDetails({ ...none, facts: ['1 → 1 · 8 counts'] })).toBe(false);
		expect(hasDetails({ ...none, notes: 'x' })).toBe(true);
		expect(hasDetails({ ...none, hasPositions: true, facts: ['1 → 1', 'A → B'] })).toBe(true);
		expect(hasDetails({ ...none, links: [link] })).toBe(true);
		expect(hasDetails({ ...none, clips: [recording] })).toBe(true);
		expect(hasDetails({ ...none, figures: [{ name: 'Adios · Basic', details: null }] })).toBe(true);
	});

	it("previews a lesson's About: notes, its figures, its videos", () => {
		const video: RunClip = { ...recording, kind: 'lesson', caption: 'Video 1' };
		const fig = { name: 'Adios · Basic', details: null };
		expect(
			aboutPreview({ ...none, notes: 'x', figures: [fig, fig, fig], clips: [video, video] })
		).toBe('Notes · 3 figures · 2 videos');
	});

	it('previews About: a description’s first line, else what is inside', () => {
		const drill =
			'Do 1 to 3 repetitions of salsa step the switch to son then back to salsa and so on';
		expect(aboutPreview({ ...none, notes: drill })).toBe(drill);
		expect(aboutPreview({ ...none, notes: '1. Basic on 1\n2. Son' })).toBe('1. Basic on 1');
		expect(aboutPreview({ ...none, notes: 'x', clips: [section(0)], links: [link] })).toBe(
			'Notes · a lesson section · a link'
		);
		expect(aboutPreview({ ...none, clips: [section(0), section(5), recording] })).toBe(
			'2 lesson sections · a recording'
		);
		expect(aboutPreview({ ...none, hasPositions: true })).toBe('Positions');
	});

	it('previews Voice: the count and the volume, or Off', () => {
		expect(voicePreview('salsa', 1)).toBe('1 2 3 · 5 6 7 · 100%');
		expect(voicePreview('son', 0.55)).toBe('2 3 4 · 6 7 8 · 55%');
		expect(voicePreview('off', 0.5)).toBe('Off');
	});

	it('previews Routine: where the run is in Follow, how long it is in Still', () => {
		expect(routinePreview(4, 16, 'follow')).toBe('5 of 16 · Follow');
		expect(routinePreview(null, 16, 'follow')).toBe('1 of 16 · Follow');
		expect(routinePreview(4, 16, 'still')).toBe('16 figures · Still');
	});

	it('titles the run: the exercise, else the routine, else the song, else Count only', () => {
		expect(runTitle({ exercise: 'Warmup', routine: null, song: 'Suavemente' })).toBe('Warmup');
		expect(runTitle({ exercise: null, routine: 'Learning pa ti', song: null })).toBe(
			'Learning pa ti'
		);
		expect(runTitle({ exercise: null, routine: null, song: 'Suavemente' })).toBe('Suavemente');
		expect(runTitle({ exercise: null, routine: null, song: null })).toBe('Count only');
	});

	it('subtitles the run: what it is, the song, the tempo as played, the clave', () => {
		const base = {
			kind: null,
			songInTitle: false,
			song: null,
			bpm: null,
			speed: 1,
			clave: null
		} as const;
		expect(runSubtitle({ ...base, kind: 'figure', bpm: 130, clave: '2-3' }, salsa)).toBe(
			'Figure · 130 BPM · clave 2-3'
		);
		expect(
			runSubtitle(
				{ ...base, kind: 'drill', song: { title: 'Suavemente', bpm: 125 }, speed: 0.8 },
				salsa
			)
		).toBe('Drill · Suavemente · 100 BPM · 0.8×');
		expect(
			runSubtitle({ ...base, songInTitle: true, song: { title: 'Suavemente', bpm: 125 } }, salsa)
		).toBe('125 BPM');
		expect(
			runSubtitle(
				{ ...base, songInTitle: true, song: { title: 'X', bpm: null }, speed: 0.9 },
				salsa
			)
		).toBe('0.9×');
		expect(runSubtitle({ ...base, kind: 'routine', bpm: 128, clave: '3-2' }, bachata)).toBe(
			'Routine · 128 BPM'
		);
		expect(runSubtitle(base, salsa)).toBeUndefined();
	});

	it('words it all in Slovenian', () => {
		const sl = <T>(fn: () => T): T => withLocale('sl', fn);
		expect(sl(() => routinePreview(4, 16, 'follow'))).toBe('5 od 16 · Sledi');
		expect(sl(() => runTitle({ exercise: null, routine: null, song: null }))).toBe('Samo štetje');
		expect(
			sl(() =>
				runSubtitle(
					{ kind: 'drill', songInTitle: false, song: null, bpm: 130, speed: 1, clave: '2-3' },
					salsa
				)
			)
		).toBe('Vaja · 130 BPM · clave 2-3');
		expect(sl(() => aboutPreview({ ...none, notes: 'x', links: [link, link] }))).toBe(
			'Zapiski · 2 povezavi'
		);
	});
});

describe('a slot’s details, from the routine list', () => {
	const nine: RunDetails = {
		heading: 'Enchufla · Doble',
		facts: ['1 → 1 · 8 counts'],
		hasPositions: false,
		notes: 'Two turns',
		clips: [],
		links: [],
		figures: []
	};
	const labelOf = (id: number) => (id === 3 ? 'Enchufla · Basic' : `#${id}`);

	it('gives each of the slot’s figures, in order; one without details by name only', () => {
		expect(slotDetails([3, 9], { 9: nine }, labelOf)).toEqual([
			{
				heading: 'Enchufla · Basic',
				facts: [],
				hasPositions: false,
				notes: null,
				clips: [],
				links: [],
				figures: []
			},
			nine
		]);
	});
});

describe('About in the run', () => {
	const d = (heading: string): RunDetails => ({
		heading,
		facts: [],
		hasPositions: false,
		notes: 'x',
		clips: [],
		links: [],
		figures: []
	});
	const figureDetails = { 3: d('Guapea'), 9: d('Enchufla') };

	it('in a routine, shows the figure lit when it opened, until it is closed', () => {
		expect(aboutShown({ routine: true, pinned: 9, details: null, figureDetails })?.heading).toBe(
			'Enchufla'
		);
		expect(aboutShown({ routine: true, pinned: null, details: null, figureDetails })).toBeNull();
		expect(aboutShown({ routine: true, pinned: 4, details: null, figureDetails })).toBeNull();
	});
	it('otherwise shows the exercise’s, when it has any', () => {
		expect(
			aboutShown({ routine: false, pinned: null, details: d('Warmup'), figureDetails })?.heading
		).toBe('Warmup');
		expect(
			aboutShown({
				routine: false,
				pinned: null,
				details: { ...d('X'), notes: null },
				figureDetails
			})
		).toBeNull();
	});
});

describe('▶ on the exercise page', () => {
	it('starts by itself only after a tap in this page, where the browser can tell', () => {
		expect(mayAutoPlay({ hasBeenActive: true })).toBe(true);
		expect(mayAutoPlay({ hasBeenActive: false })).toBe(false);
		expect(mayAutoPlay(undefined)).toBe(true);
	});
});

describe('the Practice page in Slovenian, more', () => {
	const sl = <T>(fn: () => T): T => withLocale('sl', fn);

	it('counts a routine’s figures with the noun forms', () => {
		expect(sl(() => setupSubtitle({ name: 'Prva', figureIds: [1, 2, 3] }))).toBe('Prva · 3 figure');
	});

	it('says Play, starting, and whose voice counts', () => {
		const base = { source: 'count', songId: null, ready: false, error: null } as const;
		expect(sl(() => playState({ ...base, starting: false }).label)).toBe('Predvajaj');
		expect(sl(() => playState({ ...base, starting: true }).label)).toBe('Zaganjanje …');
		const takes: CountTakeRow[] = (['a', 'b'] as const).map((phrase) => ({
			id: 1,
			pattern: 'salsa',
			bpm: 180,
			phrase,
			file: 'x.wav',
			preRollS: 0.1,
			lengthS: 1.3
		}));
		expect(sl(() => voiceKind(takes, 'salsa', 180))).toBe('Vaš');
	});

	it('goes back to an opener by its own name, after a colon', () => {
		const p = { dance: 'salsa', from: null, routine: null, exercise: null, run: null } as const;
		expect(sl(() => practiceBack({ ...p, song: { id: 4, title: 'Vivir mi vida' } }).label)).toBe(
			'Nazaj: Vivir mi vida'
		);
	});
});

describe('the count in a quiet section (count off)', () => {
	it('shows a dash, never the number', () => {
		expect(stageDigit(1, false, true)).toEqual({ text: '–', dim: true });
		expect(stageDigit(5, false, true).text).toBe('–');
	});
	it('draws the eight dots alike: no beat lit, no 4 and 8 apart', () => {
		const dots = stageDots(3, false, true);
		expect(new Set(dots.map((d) => `${d.size}:${d.tone}`))).toEqual(new Set(['10:quiet']));
	});
});
