// Practice: the player's setup, the run, Save this run, and where Back goes. The
// chips and the panel's shared words (Play, Stop, Speed, Voice count …) are
// `exercise.panel`'s.
import { plural } from './plural';

export const player = {
	title: 'Practice',
	/** The tab's title: "Practice · Salsa". */
	pageTitle: (dance: string): string => `Practice · ${dance}`,
	/** The band's subtitle over a routine: "Shines · 3 figures". */
	routineLine: (name: string, figures: number): string =>
		`${name} · ${plural(figures, 'figure', 'figures')}`,
	voice: 'Voice',
	recordOwn: 'Record your own count',
	/** Whose voice counts: the built-in clips, or the person's own recording. */
	builtIn: 'Built-in',
	yours: 'Yours',
	couldNotStart: 'Could not start the player.',
	couldNotStartBody: 'Nothing is playing. Tap Play to try again.',
	loadingGrid: 'Loading the beat grid…',
	calls: 'Calls',
	callsLabel: 'Calls · a figure every 1, 2 or 4 eights',
	starting: 'Starting…',
	pickSongFirst: 'Pick a song first.',
	/** The picked song's grid did not load. */
	songFailed: 'That song could not be loaded. Pick another, or use the count.',
	/** The running band: "Paused · 1:04". */
	paused: (clock: string): string => `Paused · ${clock}`,
	stopAndBack: 'Stop and go back',
	routine: 'Routine',
	/** The desktop's heading over the routine: "Routine · 5 slots", "Routine · slot 2 of 5". */
	routineSlots: (n: number): string => `Routine · ${plural(n, 'slot', 'slots')}`,
	routineSlotOf: (slot: number, total: number): string => `Routine · slot ${slot} of ${total}`,
	now: 'Now',
	/** The count disc's name. */
	countNotStarted: 'Count not started',
	countDigit: (digit: string): string => `Count ${digit}`,
	/** The run's subtitle part for a count-only tempo: "180 BPM". */
	bpm: (n: number): string => `${n} BPM`,
	/** Save this run's line: "3:42 · 12 figures called · logged as a set". */
	called: (n: number): string => `${plural(n, 'figure', 'figures')} called`,
	loggedAsSet: 'logged as a set',
	saveTitle: 'Save this run',
	/** What "Unsaved changes" calls the sheet. */
	unsavedLabel: 'This run',
	exercise: 'Exercise',
	chooseExercise: 'Choose an exercise…',
	chooseExerciseTitle: 'Choose an exercise',
	searchExercises: 'Search exercises',
	noExercises: 'No exercises yet.',
	notePlaceholder: 'Anything to remember?',
	dontSave: 'Don’t save',
	/** Where the band's back goes with no opener recorded. */
	backToToday: 'Back to Today',
	backToMusic: 'Back to Music',
	/** What a refused save says. */
	refused: {
		couldNotSave: 'Could not save that run.',
		noteTooLong: 'That note is too long — keep it under 2000 characters.'
	}
};
