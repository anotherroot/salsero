// The exercise page and the log popup: the type names, the log form and its footer,
// a day's sets, each type's content, the practice panel in the popup, and the
// refusals of the log and the page's actions. The four faces are `format.feel`;
// a set's summary is `format.minutes`/`format.reps`.

export const exercise = {
	/** Each type's name and the question over its faces (`src/lib/exercises/kinds.ts`). */
	types: {
		lesson: 'Lesson review',
		figure: 'Figure practice',
		drill: 'Drill',
		routine: 'Routine',
		remember: 'How well do you remember it?',
		howItWent: 'How did it go?'
	},
	/** The log form and its footer. */
	log: {
		logSet: 'Log set',
		/** The simple popup's button. */
		done: 'Done',
		saving: 'Saving…',
		logged: 'Logged',
		addToDay: 'Add set to this day',
		stopToLog: 'Stop the count to log it.',
		pickFeel: 'Pick how it went',
		/** Where Next goes: "Next: Clave clapping". */
		next: (name: string): string => `Next: ${name}`,
		/** Under Minutes or Reps: "0–600". */
		range: (max: number): string => `0–${max}`,
		/** `when`: "Yesterday", "3 days ago" (`lastDoneLabel`). */
		lastTime: (when: string): string => `Last time: ${when}`,
		firstTime: 'First time.',
		minutes: 'Minutes',
		reps: 'Reps',
		/** Under Minutes, the panel's exact time: "From the practice: 3:12". */
		fromPractice: (clock: string): string => `From the practice: ${clock}`,
		note: 'Note',
		optional: '(optional)',
		notePlaceholder: 'What went well, what to fix',
		/** What Unsaved changes calls the log form. */
		formLabel: 'Practice log',
		didNotSave: 'It did not save.',
		loadError: 'Could not load this exercise’s details.',
		stillLog: 'You can still log a set.',
		skip: 'Skip',
		details: 'Details',
		detailsLabel: 'Details and settings',
		/** A back-filled day: "Adding to Tuesday, 3 November". */
		addingTo: (day: string): string => `Adding to ${day}`,
		setsThatDay: 'Sets that day',
		setsToday: 'Sets today',
		setDeleted: 'Set deleted',
		couldNotPutBack: 'Could not put the set back.',
		sessionDone: 'Session done',
		finish: 'Finish'
	},
	/** A day's sets. */
	sets: {
		/** A set with nothing to sum up. */
		set: 'Set',
		deleteFailed: 'Could not delete the set.',
		/** The trash button: "Delete set logged at 18:30". */
		deleteLabel: (time: string): string => `Delete set logged at ${time}`
	},
	/** Each type's content, in the popup and on the page. */
	content: {
		description: 'Description',
		sections: 'Sections',
		links: 'Links',
		linkSection: 'Link a section…',
		unlinkSection: 'Unlink this section',
		reference: 'Reference',
		hide: 'Hide',
		show: 'Show',
		recordingMissing: 'The file for this recording is missing.',
		videoMissing: 'The file for this video is missing.',
		cantPlay: "This browser can't play this file.",
		figureEmpty: 'No notes, recordings, sections or links yet — add them on the figure page.',
		editLinks: 'Edit links on the figure page',
		/** A lesson's row: "Tuesday, 3 November · 2 videos". */
		videos: (n: number): string => `${n} ${n === 1 ? 'video' : 'videos'}`,
		figures: 'Figures',
		practiseInPlayer: 'Practise in player',
		routineNote: 'A run there saves itself. Log here when you practised away from the app.'
	},
	/** The exercise page. */
	page: {
		/** The summary tiles: "23 / sets", "4 h 10 / practised", "Easy / recently". */
		tileSets: (n: number): string => (n === 1 ? 'set' : 'sets'),
		tilePractised: 'practised',
		tileRecently: 'recently',
		/** A history day in another year: "Tuesday, 30 December, 2025". */
		dayWithYear: (label: string, year: string): string => `${label}, ${year}`,
		ownerFigure: 'Figure',
		ownerLesson: (date: string): string => `Lesson · ${date}`,
		ownerRoutine: 'Routine',
		archiveBody: (name: string, sets: number): string => {
			const head = `${name} leaves Today and every list.`;
			return sets === 0 ? head : `${head} Its ${sets} ${sets === 1 ? 'set is' : 'sets are'} kept.`;
		},
		logASet: 'Log a set',
		practised: 'I practised this',
		/** The simple page's way to its lesson: "From class Tue 3 Nov ›". */
		fromClass: (day: string): string => `From class ${day} ›`,
		comments: 'Comments on the class',
		settings: 'Settings',
		settingsLabel: 'Exercise settings',
		name: 'Name',
		active: 'Active',
		activeHint: 'Show it in the to-do list',
		description: 'Description',
		practiceNotes: 'Practice notes',
		archive: 'Archive exercise',
		archiveTitle: 'Archive this drill?',
		archiveButton: 'Archive',
		notOnToday: 'Not on your Today',
		fromLesson: (title: string): string => `From ${title}`,
		history: 'History',
		nothingYet: 'Nothing logged yet',
		nothingYetBody: 'Log a set after you practise — it shows up here, grouped by day.',
		showingLatest: (n: number): string => `Showing the latest ${n}.`,
		activeNo: "No — not on Today's list",
		comesBack: 'It comes back tomorrow',
		stopEditing: 'Stop editing',
		editSettings: 'Edit settings',
		editDrill: 'Edit drill'
	},
	/** The practice panel in the popup, and its chips. */
	panel: {
		label: 'Practice',
		practiseWith: 'Practise with',
		play: 'Play',
		pause: 'Pause',
		resume: 'Resume',
		stop: 'Stop',
		voiceVolume: 'Voice volume',
		/** Time banked by earlier runs: "3:12 practised — Play carries on". */
		banked: (clock: string): string => `${clock} practised — Play carries on`,
		songGone: 'Its song is not ready',
		songGoneBody: 'Pick another, or use the count.',
		couldNotStart: 'Could not start the count.',
		voiceCount: 'Voice count',
		cue: 'Call it on cue',
		/** A chip that turns something off (the count, the clave, the call). */
		off: 'Off',
		/** A call chip: "Every 2" (8-counts). */
		every: (n: number): string => `Every ${n}`,
		speedLabel: 'Speed',
		/** A playback speed: "0.8×". */
		speed: (s: number): string => `${s}×`,
		/** The collapsed line's parts: "Count 180 · 2 3 4 · 6 7 8 · clave 2-3 · call every 2". */
		summaryCount: (bpm: number): string => `Count ${bpm}`,
		summaryNoCount: 'Off',
		summaryClave: (pattern: string): string => `clave ${pattern}`,
		summaryCall: (n: number): string => `call every ${n}`
	},
	/** What a refused log or page action says. */
	refused: {
		checkValues: 'Check the values and try again.',
		gone: 'That exercise no longer exists.',
		setGone: 'That set was already removed.',
		putBack: 'That set could not be put back.',
		archiveHere: 'Only custom exercises are archived here. Archive a figure from its page.',
		pickSection: 'Pick a section.',
		linkGone: 'That link was already removed.'
	}
};
