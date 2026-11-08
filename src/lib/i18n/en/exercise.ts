// The exercise page: the type names, the Done sheet and its footer,
// a day's sets, each type's content, the practice panel, and the
// refusals of the log and the page's actions. The four faces are `format.feel`;
// a set's summary is `format.minutes`/`format.reps`.

export const exercise = {
	/** Each type's name and the question over its faces (`src/lib/exercises/kinds.ts`). */
	types: {
		lesson: 'Lesson review',
		figure: 'Figure practice',
		drill: 'Drill',
		routine: 'Routine',
		howItWent: 'How did it go?'
	},
	/** The Done sheet's small words. */
	log: {
		done: 'Done',
		saving: 'Saving…',
		pickFeel: 'Pick how it went',
		/** `when`: "Yesterday", "3 days ago" (`lastDoneLabel`). */
		lastTime: (when: string): string => `Last time: ${when}`,
		firstTime: 'First time.',
		note: 'Note',
		optional: '(optional)',
		notePlaceholder: 'What went well, what to fix',
		didNotSave: 'It did not save.'
	},
	/** Each type's content on the page. */
	content: {
		description: 'Description',
		/** A section row's Unlink while a drill's Recordings are edited; `name` is the section's label. */
		unlink: 'Unlink',
		unlinkNamed: (name: string): string => `Unlink ${name}`,
		reference: 'Reference',
		recordingMissing: 'The file for this recording is missing.',
		videoMissing: 'The file for this video is missing.',
		cantPlay: "This browser can't play this file.",
		figureEmpty: 'No notes, recordings, sections or links yet — add them on the figure page.',
		editLinks: 'Edit links on the figure page',
		figures: 'Figures',
		practiseInPlayer: 'Practise in player',
		routineNote: 'A run there saves itself. Tap Done when you practised away from the app.',
		/** The drill's Recordings heading: "Recordings", "Recordings · 3". */
		recordings: (n: number): string => (n === 0 ? 'Recordings' : `Recordings · ${n}`)
	},
	/** The exercise page. */
	page: {
		/** The history tiles: "3 / times", "17 min / in all". */
		times: (n: number): string => (n === 1 ? 'time' : 'times'),
		inAll: 'in all',
		/** A history day in another year: "Tuesday, 30 December, 2025". */
		dayWithYear: (label: string, year: string): string => `${label}, ${year}`,
		ownerFigure: 'Figure',
		ownerLesson: (date: string): string => `Lesson · ${date}`,
		ownerRoutine: 'Routine',
		archiveBody: (name: string, times: number): string => {
			const head = `${name} leaves Today and every list.`;
			return times === 0 ? head : `${head} Its history is kept.`;
		},
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
		nothingYetBody: 'Tap Done after you practise — it shows up here, grouped by day.',
		showingLatest: (n: number): string => `Showing the latest ${n}.`,
		/** A history day's sheet: its one action, and the toast after it (`label`: "Thu 5 Nov"). */
		deleteDay: 'Delete this day',
		dayDeleted: (label: string): string => `${label} deleted`,
		activeNo: "No — not on Today's list",
		comesBack: 'It comes back tomorrow',
		stopEditing: 'Stop editing',
		editSettings: 'Edit settings',
		editDrill: 'Edit drill'
	},
	/** The practice panel on the exercise page, and its chips. */
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
		/** What a practice plays to (SourcePicker): the switch, its two options, the song, the tempo. */
		source: 'Source',
		countOnly: 'Count only',
		aSong: 'A song',
		song: 'Song',
		tempo: 'Tempo',
		/** The seek bar's name. */
		position: 'Song position',
		/** A playback speed: "0.8×". */
		speed: (s: number): string => `${s}×`,
		/** The collapsed line's parts: "Count 180 · 2 3 4 · 6 7 8 · clave 2-3 · call every 2". */
		summaryCount: (bpm: number): string => `Count ${bpm}`,
		summaryNoCount: 'Off',
		summaryClave: (pattern: string): string => `clave ${pattern}`,
		summaryCall: (n: number): string => `call every ${n}`
	},
	/**
	 * Comes back: how a drill returns to Today (the card on the page and in New
	 * exercise, a member's line, and its words on Today and in Coming up).
	 * The faces' names are `format.feel`.
	 */
	comesBack: {
		title: 'Comes back',
		/** A group drill's own card. */
		forClass: 'Comes back, for the class',
		byFaces: 'By how it went',
		byFacesNote: 'The faces decide when it comes back.',
		until: 'Every day until it feels good',
		untilNote: 'Then the faces take over.',
		goodDaysLabel: 'Good days',
		/** A chip: "3 good days". */
		goodDays: (n: number): string => `${n} good days`,
		/** `gotit`, `easy`: the faces' names. */
		goodMeans: (gotit: string, easy: string): string => `Good means ${gotit} or ${easy}.`,
		/** After `goodMeans`: "2 of 3 so far." */
		soFar: (good: number, of: number): string => `${good} of ${of} so far.`,
		fixed: 'On a fixed rhythm',
		/** `done`: the simple popup's Done. */
		fixedNote: (done: string): string => `Just ${done}, no faces.`,
		howOften: 'How often',
		/** A rhythm: "Every day", "Every 2 days", "Every 3 days", "Weekly". */
		rhythm: (days: number): string =>
			days === 1 ? 'Every day' : days === 7 ? 'Weekly' : `Every ${days} days`,
		/** The until setting in words (History, a member's line): "Every day until it feels good on 3 days". */
		untilWords: (good: number): string => `Every day until it feels good on ${good} days`,
		/** A learning drill on Today and in Coming up: "Learning · 2 of 3 good days". */
		learning: (good: number, of: number): string => `Learning · ${good} of ${of} good days`,
		membersCan: 'Members can change it for themselves.',
		useTeacher: "Use my teacher's",
		/** A member's line over the card: "Your teacher set: weekly". */
		teacherSet: (words: string): string => `Your teacher set: ${words}`,
		/** The page's badge on an entry that follows its class drill. */
		setByTeacher: 'Set by your teacher'
	},
	/** The Warm-up switch (New exercise, the exercise page) and a warm-up in Coming up. */
	warmup: {
		title: 'Warm-up',
		/** `daily`: the person's daily number. */
		note: (daily: number): string => `Do it first. It doesn't count toward your ${daily}.`,
		/** Coming up's line: "Warm-up · every day". */
		withRhythm: (rhythm: string): string => `Warm-up · ${rhythm}`
	},
	/** The Done sheet. */
	done: {
		/** Under a face's time when saving it finishes a learning drill. */
		learnt: 'learnt',
		/** The band's subtitle: "Drill · learning · 3:20". */
		learning: 'learning',
		warmup: 'warm-up',
		/** The toast after Done; `back`: when it comes back, lower case. */
		saved: (back: string): string => `Saved · ${back}`,
		/** The toast after Done on a past day; `day`: "Thu 5 Nov". */
		added: (day: string): string => `Added to ${day}`,
		/** The pinned button once the exercise has today's entry. */
		doneToday: 'Done today',
		stopFirst: 'Stop the count first.',
		/** Under the Done sheet's faces: no button, a face saves. */
		tapFace: 'Tap a face to save it',
		/** The run's place in the band: "Drill · 3 of 7 · 4:12". */
		place: (at: number, of: number): string => `${at} of ${of}`,
		/** The Done sheet's line in a run: "4:12 · Next: <name>". */
		next: (name: string): string => `Next: ${name}`,
		/** The run's pinned bar: on without saving, this run only. */
		skip: 'Skip',
		/** A fixed rhythm's Done in a run: saves and goes on. */
		doneNext: 'Done · next'
	},
	/** What a refused log or page action says. */
	refused: {
		checkValues: 'Check the values and try again.',
		gone: 'That exercise no longer exists.',
		dayGone: 'That day was already removed.',
		dayPutBack: 'That day could not be put back.',
		archiveHere: 'Only custom exercises are archived here. Archive a figure from its page.',
		pickSection: 'Pick a section.',
		linkGone: 'That link was already removed.'
	}
};
