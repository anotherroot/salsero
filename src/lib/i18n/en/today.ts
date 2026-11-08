// Today: the list and its rows, the bar card, Coming up, a past
// day, New exercise, the toasts and the refusals. The schedule's own words (the gap,
// due, back in …) are `format`'s (`src/lib/schedule/words.ts`).
import { plural } from './plural';

export const today = {
	/** A row's meta and controls: "Done · Back in a week", "Ahead · due Sunday". */
	row: {
		done: 'Done',
		/** Put on Today from Coming up: "Added · due tomorrow". */
		added: 'Added',
		/** Picked by Next before its day: "Ahead · due Sunday". */
		ahead: 'Ahead',
		/** A lesson's row: "New · from class Tue 3 Nov". */
		fromClass: (day: string): string => `from class ${day}`,
		/** The swipe's button, and Coming up's skipped row. */
		notToday: 'Not today'
	},
	/** A lesson's own exercise, named after the lesson (`shownExercise`, `src/lib/exercises/name.ts`). */
	reviewOf: (title: string): string => `Review: ${title}`,
	/** The bar card over the list. */
	hero: {
		/** Before anything is done: "5 for today"; after, "3 left for today". */
		forToday: (n: number): string => `${n} for today`,
		left: (n: number): string => `${n} left for today`,
		doneOf: (done: number, total: number): string => `${done} of ${total} done`,
		/** The estimate after it: "0 of 7 done · about 30 min". */
		about: (minutes: number): string => `about ${minutes} min`,
		allDone: (n: number): string => `All ${n} done`,
		allDoneMeta: "That's today's practice",
		everything: "You've done everything",
		/** `when`: "tomorrow", "Sunday", "14 Nov" (`whenWords`). */
		everythingMeta: (when: string): string => `Every exercise is done until ${when}`,
		nothingLeft: 'Nothing left for today',
		nothingLeftMeta: (when: string): string => `The rest comes back ${when}`,
		nothingDue: 'Nothing due today',
		nothingDueMeta: 'You can practise ahead below',
		nothingOn: 'Nothing on Today',
		nothingOnMeta: 'Every exercise is paused',
		/** The play: walks the day's exercises page by page. */
		start: 'Start'
	},
	list: {
		/** The Warm-up card's heading: "Warm-up · 2". */
		warmup: (n: number): string => `Warm-up · ${n}`,
		/** The Practice card's heading: "Practice · 5", "Done today · 14" once nothing is left. */
		practice: (nothingLeft: boolean, n: number): string =>
			`${nothingLeft ? 'Done today' : 'Practice'} · ${n}`,
		/** "+ Next 5". */
		next: (n: number): string => `Next ${n}`,
		nextUp: 'Next up',
		/** What comes back first: "Tomorrow · and 3 more". */
		andMore: (day: string, n: number): string => `${day} · and ${n} more`,
		seeComing: "See what's coming",
		emptyTitle: 'Nothing to practise yet',
		emptyBody: 'Build a routine from your figures, or add a custom exercise.',
		buildRoutine: 'Build a routine',
		previousDay: 'Previous day',
		nextDay: 'Next day',
		backToToday: 'Back to today',
		/** Coming up's pane with nothing open (desktop). */
		pickToOpen: 'Pick an exercise to open it.',
		/** The pane with nothing open (desktop). */
		soFar: 'Today so far'
	},
	/** Done for today: where a run ends (`src/lib/exercises/done-today.ts`). */
	doneToday: {
		title: 'Done for today',
		/** A tile's label under its number: "7 / exercises". */
		exercises: (n: number): string => (n === 1 ? 'exercise' : 'exercises'),
		/** The other tile's: "30 min / practised". */
		practised: 'practised',
		/** The Warm-up row: "2 done · 7 days in a row". */
		warmupDone: (n: number): string => `${n} done`,
		streak: (n: number): string => `${n} days in a row`,
		/** A drill that finished learning today; `back` from `backWords`, lower-cased: "Learnt · back in 3 days". */
		learnt: (back: string): string => `Learnt · ${back}`
	},
	/** A past day's totals: "7 exercises". */
	totals: (exercises: number): string => plural(exercises, 'exercise', 'exercises'),
	coming: {
		/** The due ones beyond today's number (never "late"). */
		waiting: 'Next in line',
		paused: 'Paused',
		nothing: 'Nothing is coming up yet.',
		putOn: (name: string): string => `Put ${name} on Today`,
		onToday: 'On Today',
		doneToday: 'Done today'
	},
	past: {
		loggedToday: 'Logged today',
		loggedThatDay: 'Logged that day',
		addSet: (name: string): string => `Add ${name} to this day`,
		/** An entry with nothing to sum up. */
		done: 'Done',
		nothingToday: 'Nothing logged today',
		nothingThatDay: 'Nothing logged on this day',
		forgot: 'Forgot to log something that day?',
		pick: 'Pick an exercise…',
		logOn: (day: string): string => `Add to ${day}`,
		search: 'Search exercises',
		none: 'No exercises yet.'
	},
	newExercise: {
		title: 'New exercise',
		name: 'Name',
		placeholder: 'e.g. Son basic, clave clapping',
		notes: 'Notes',
		optional: '(optional)',
		add: 'Add exercise',
		hint: 'To practise a figure on its own, open it and tap Practise on its own.'
	},
	/** A row's tile, for a screen reader. */
	tile: {
		figurePartner: 'Figure, partner',
		figureSolo: 'Figure, solo',
		routine: 'Routine',
		lesson: 'Lesson review',
		drill: 'Drill',
		doneToday: (label: string): string => `${label}, done today`,
		done: 'Done'
	},
	toast: {
		notToday: (name: string): string => `${name} · Not today`,
		onToday: (name: string): string => `${name} is on Today`
	},
	/** A logged exercise's name once its group is purged. */
	deletedGroup: (title: string, team: string): string => `${title} · ${team} (deleted)`,
	/** What a refused action says. */
	refused: {
		addMore: 'Could not add more. Try again.',
		addToToday: 'Could not add it to Today. Try again.',
		skip: 'Could not skip it. Try again.',
		putBack: 'Could not put it back. Try again.',
		undo: 'Could not undo that. Try again.',
		addExercise: 'Could not add the exercise.',
		pickWhat: 'Pick an exercise to add or skip.',
		noPick: 'No such pick.',
		nothingToAdd: 'Nothing left to add today.',
		name: 'Give it a name (up to 200 characters).',
		noExercise: 'No such exercise.',
		archived: 'That exercise is archived.',
		paused: 'That exercise is paused.',
		warmupOrder: 'Could not save the order. Try again.'
	}
};
