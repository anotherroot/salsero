// Settings, its storage line and paired phones, and My count (/voice), reached from it.
// The level names are `entry.levels`, the theme labels `settings.theme`, Back is `shell.backTo`.
export const settings = {
	/** The row's label and its sheet's title. */
	language: 'Language',
	/** A refused language. */
	badLanguage: 'Pick a language.',
	/** The Theme row's three choices. */
	theme: { system: 'System', light: 'Light', dark: 'Dark' },
	/** The toasts after a save. */
	saved: 'Saved',
	couldNotSave: 'Could not save.',
	storage: {
		label: 'Storage',
		/** The bar, for a screen reader. */
		spaceUsed: 'Space used',
		using: (used: string): string => `Using ${used}`,
		usingOf: (used: string, limit: string): string => `Using ${used} of ${limit}`,
		whatUses: 'What uses space',
		whatUsesSub: 'Biggest first, with Delete',
		askForMore: 'Ask for more',
		/** `date` is the day it was asked, as `dateLabel` writes it. */
		asked: (date: string): string => `Asked on ${date} · waiting`,
		askIntro: 'The admin sees how much you use. A note is optional.',
		note: 'Note',
		couldNotAsk: 'Could not ask.',
		noLimit: 'You have no limit, so there is nothing to ask for.',
		noteTooLong: 'Keep the note under 500 characters.',
		/** An upload refused at the limit; sizes as `byteSize` writes them. */
		noRoom: (used: string, limit: string): string =>
			`Not enough room: you use ${used} of ${limit}. Free some space or ask for more in Settings.`,
		noRoomGroup: (used: string, limit: string): string =>
			`Not enough room: the group uses ${used} of ${limit}. The owner can ask for more.`,
		noRoomServer: 'Not enough room on the server. Ask the admin.'
	},
	practice: {
		label: 'Practice',
		perDay: 'Exercises a day',
		fewer: 'Fewer',
		more: 'More',
		perDayNote: (n: number): string =>
			`Today shows this many. When they're done, Next ${n} brings more.`,
		newFigures: 'New figures start on',
		styleIntro: 'The style a new figure starts on. You can change it on the figure.',
		style: 'Style'
	},
	appearance: {
		label: 'Appearance',
		theme: 'Theme',
		themeIntro: "System follows the phone's or computer's own light or dark setting.",
		note: 'For this browser or phone only.'
	},
	getAppSub: "For your phone's home screen",
	/** The You page's short list (YouSettings): the rest is Settings' own words. */
	you: {
		inApp: 'In the Android app',
		allSettings: 'All settings'
	},
	android: {
		label: 'Android app',
		version: (v: string | number): string => `Version ${v}`,
		reminder: 'Daily reminder',
		reminderSub: 'What is due, as a notification',
		time: 'Time',
		reminderTime: 'Reminder time',
		compress: 'Compress videos to',
		size: 'Size',
		note: 'Read by the phone app when it opens.'
	},
	devices: {
		label: 'Paired phones',
		/** The name a newly paired phone gets: "Salsa app". */
		appLabel: (dance: string): string => `${dance} app`,
		removeLabel: (label: string): string => `Remove ${label}`,
		removed: (label: string): string => `${label} removed`,
		/** `date` as `dateLabel` writes it. */
		paired: (date: string): string => `Paired ${date}`,
		/** `when`: today, yesterday, or a date. */
		lastUsed: (paired: string, when: string): string => `${paired} · last used ${when}`,
		gone: 'That phone is already gone.'
	},
	admin: { label: 'Admin', sub: 'Invite someone' },
	account: { label: 'Account', name: 'Name', signedIn: 'Signed in', signOut: 'Sign out' },
	refusals: {
		theme: 'Pick one of the themes.',
		style: 'Pick one of the styles.',
		reminder: 'Pick a time, or switch it off.',
		size: 'Pick one of the sizes.',
		level: 'Pick one of the three.',
		daily: (min: number, max: number): string => `Pick a number from ${min} to ${max}.`,
		tooLate: 'Too late to undo.'
	},
	/** My count. Its title is `shell.lists.myCount`. The count itself stays as said. */
	voice: {
		backToPractice: 'Back to Practice',
		countPattern: 'Count pattern',
		/** The band while arming: "Count 1 2 3 · 5 6 7". */
		countSub: (pattern: string): string => `Count ${pattern}`,
		atBpm: (pattern: string, bpm: number): string => `${pattern} at ${bpm} BPM`,
		recording: 'Recording',
		pickBars: 'Pick the bars',
		intro:
			'Record yourself counting and the player uses your voice. A tempo with nothing recorded uses the built-in count.',
		tempos: 'Tempos',
		record: 'Record',
		redo: 'Redo',
		recordLabel: (bpm: number): string => `Record ${bpm} BPM`,
		redoLabel: (bpm: number): string => `Redo ${bpm} BPM`,
		recordedTakes: 'Recorded takes',
		headphones: 'Put headphones on first',
		headphonesBody: 'Through a speaker the click gets recorded along with your voice.',
		howItGoes: 'How it goes',
		stepOne: 'One bar of clicks to find the tempo.',
		/** Step two, around the pattern in bold: "Count <b>1 2 3 · 5 6 7</b> out loud for 4 bars." */
		stepTwoBefore: 'Count',
		stepTwoAfter: (bars: number): string => `out loud for ${bars} bars.`,
		start: 'Start',
		/** "Say <b>3</b> now". */
		sayBefore: 'Say',
		sayAfter: 'now',
		barsCounted: 'Bars counted',
		stopNote:
			'Stop keeps the whole bars you counted. Redo throws them away and starts the count-in again.',
		stop: 'Stop',
		couldNotSaveTakes: 'Could not save the takes',
		couldNotSaveTakesLine: 'Could not save the takes.',
		pickIntro:
			'Pick the best bar for each half. Listen before you keep it: a rushed or muttered one is worse than the built-in voice.',
		firstHalf: 'First half',
		secondHalf: 'Second half',
		counts: (counts: string): string => `Counts ${counts}`,
		nothingUsable: 'Nothing usable in this half.',
		barFor: (counts: string): string => `Bar for counts ${counts}`,
		bar: (n: number): string => `Bar ${n}`,
		listen: (n: number): string => `Listen to bar ${n}`,
		saving: 'Saving…',
		keep: 'Keep these',
		recordAgain: 'Record again',
		/** What leaving would lose (Unsaved changes). */
		unsaved: 'Your recorded count',
		pickFirst: 'Pick a bar to keep first.',
		couldNotDo: 'Could not do that.',
		uploadFailed: 'Upload failed.',
		// The grid (voice/grid.ts).
		ownVoice: (done: number, total: number): string =>
			`${done} of ${total} tempos in your own voice`,
		recorded: 'Recorded',
		halfRecorded: (counts: string): string => `Half recorded · counts ${counts}`,
		notRecorded: 'Not recorded',
		temposRecorded: (done: number, total: number): string =>
			`Tempos · ${done} of ${total} recorded`,
		takeTitle: (bpm: number, counts: string): string => `${bpm} BPM · counts ${counts}`,
		takeMeta: (pattern: string, letter: string): string => `${pattern} · phrase ${letter}`,
		deleteLabel: (bpm: number, letter: string): string => `Delete ${bpm} BPM phrase ${letter}`,
		deleted: (title: string): string => `${title} deleted`,
		keptBoth: (bpm: number): string => `Kept both halves for ${bpm} BPM`,
		kept: (counts: string, bpm: number): string => `Kept counts ${counts} for ${bpm} BPM`,
		// The recording screen (voice/recording.ts).
		nothingCaptured: 'Nothing usable was captured',
		checkMic: 'Check the microphone permission.',
		getReady: 'Get ready',
		countIn: 'Count-in',
		startOnNext: 'Start counting on the next 1',
		barOf: (n: number, bars: number): string => `Bar ${n} of ${bars}`,
		silentOn: (n: number): string => `Silent on ${n}`,
		everyBeat: 'Count evenly, every beat.',
		leaveSilent: (beats: number[]): string =>
			`Count evenly and leave beats ${beats.join(' and ')} silent.`,
		micRefused: 'The microphone was refused',
		micRefusedBody: 'Allow it for this app in the phone’s settings, then try again.',
		failed: 'Recording failed',
		failedLine: 'Recording failed.',
		// The server's refusals.
		unknownTake: 'Unknown take.',
		takeGone: 'That take is already gone.',
		newerTake: 'A newer take holds that slot now.',
		takeTooLarge: (limit: string): string => `That take is larger than ${limit}.`
	},
	/** /device/pair: the Android app pairs the phone with the account. */
	pair: {
		title: 'Pair the app',
		paired: 'Paired',
		pairedBody: 'Opening the app now. If it does not open by itself, tap the button.',
		openApp: 'Open the app',
		pairPhone: 'Pair this phone',
		body: 'Lets the app upload videos in the background and remind you what is due. You can remove it again in Settings.',
		pairing: 'Pairing…'
	}
};
