// The frame around every page: the tabs, the side, the skeleton, the reload toast,
// the error pages, the app's update, Get the app, and the shared sheets' own words
// (Unsaved changes, the clash sheet's fixed words, search, upload).
export const shell = {
	tabs: {
		today: 'Today',
		moves: 'Moves',
		lessons: 'Lessons',
		groups: 'Groups',
		music: 'Music',
		/** Groups at Follow my class. */
		myClass: 'My class',
		/** Above Follow my class the Groups tab (the groups, then the settings); at Follow my class its own tab (the settings). */
		you: 'You',
		/** The Music tab's name while a playlist waits to be picked (its dot). */
		musicToPick: (label: string): string => `${label}, a playlist to pick`
	},
	/** The main nav's name (the tab bar, the side). */
	mainNav: 'Main',
	/** In group mode, back to the person's own side. */
	mine: 'Mine',
	settings: 'Settings',
	/** The band's back: "Back to Moves". */
	backTo: (title: string): string => `Back to ${title}`,
	/** The titles of lists the skeleton draws (their pages say the same). */
	lists: {
		comingUp: 'Coming up',
		coverage: 'Coverage',
		noPosition: 'No position',
		myCount: 'My count'
	},
	groupMode: {
		/** The sheet's title over Mine and each group. */
		workIn: 'Work in',
		workInGroup: 'Work in a group',
		switchGroup: 'Switch group',
		/** The tick on the current row, for a screen reader. */
		workingIn: 'Working in'
	},
	reload: {
		title: 'The app was updated',
		staleTitle: 'This page is out of date',
		staleLine: 'Reload to continue.',
		/** The button, and the verb of Unsaved changes ("Reload without saving"). */
		reload: 'Reload',
		unsaved: 'Kept so nothing unsaved is lost.',
		held: 'Kept while this runs.',
		open: 'Kept while this is open.',
		next: 'Your next page loads it.'
	},
	error: {
		offlineTitle: 'Offline',
		offlineHeading: 'You’re offline',
		offlineBody:
			'This page needs the server. Check the connection and try again; nothing you saved is lost.',
		notFoundTitle: 'Not found',
		notFoundHeading: 'Nothing here',
		notFoundBody: 'This page does not exist, or what it showed was deleted.',
		title: 'Error',
		heading: 'Something went wrong',
		serverBody: 'The server could not open this page. Try again in a moment.',
		body: 'Go back and try again.',
		code: (status: number): string => `ERROR ${status}`,
		goToday: 'Go to Today'
	},
	update: {
		downloading: (pct: number): string => `Downloading… ${pct}%`,
		installing: 'Installing…',
		update: 'Update',
		fromPlay: 'Update from Google Play',
		permission: 'Allow this app to install updates, then come back.',
		busy: 'Updating after your upload finishes.',
		current: 'You have the latest version.',
		offline: 'No connection.',
		download: 'The download broke.',
		check: "The download didn't check out.",
		install: "It didn't install.",
		rowTitle: 'New version of the app',
		hide: 'Hide until tomorrow',
		version: (name: string): string => `Version ${name} is ready`,
		ready: 'Ready to install',
		neededTitle: 'Update needed',
		neededBody: 'This version of the app no longer works. Update to keep going.'
	},
	getApp: {
		title: 'Get the app',
		intro: "Practise from your phone's home screen.",
		openOnPhone: 'Open this page on your phone.',
		qr: 'QR code for this page',
		download: (app: string, size: string): string => `Download ${app} · ${size}`,
		notReady: "The Android app isn't ready yet.",
		open: (app: string): string => `Open ${app}`,
		androidSteps: [
			'1. Your browser asks to allow installing apps from it: allow it, then tap Install.',
			"2. If Play Protect says it doesn't know the app, tap Install anyway.",
			'3. Open the app and sign in with the account you just made.'
		],
		sketch: 'Sketch of the allow screen: a switch turned on',
		ios: 'In Safari, tap Share, then Add to Home Screen.',
		iosNote:
			'On iPhone, lesson videos upload only while the page is open, and there is no daily reminder.',
		skip: 'Skip, use it in the browser'
	},
	unsaved: {
		title: 'Unsaved changes',
		/** `labels`: what is unsaved, joined with commas; `many`: more than one. */
		line: (labels: string, many: boolean): string =>
			`${labels} ${many ? 'are' : 'is'} not saved yet.`,
		saving: 'Saving…',
		notSaved: 'Not saved',
		stay: 'Stay',
		stayAndFix: 'Stay and fix it',
		/** `verb`: Leave, Close, Reload, Stop editing. */
		without: (verb: string): string => `${verb} without saving`,
		/** The verb for leaving a page. */
		leave: 'Leave',
		/** The dialog's Save failed with no message from the server. */
		didNotSave: 'It did not save.',
		/** The dialog's Save was stopped by the form itself, with no field to point at. */
		notSent: 'It was not sent.'
	},
	clash: {
		goneSub: 'Nothing was saved. Copy what you typed before you close this.',
		sub: 'Theirs is saved. Yours is not yet: change it, then pick one.',
		nothingTyped: 'Nothing was typed.',
		theirs: 'Theirs',
		yours: 'Yours',
		empty: '(empty)',
		/** `fields`: the other changed fields, joined with commas. */
		alsoChanged: (fields: string): string =>
			`Also changed: ${fields}. Save mine keeps yours there too.`,
		saveMine: 'Save mine',
		keepTheirs: 'Keep theirs'
	},
	clearSearch: 'Clear search',
	/** A banner's ×. */
	dismiss: 'Dismiss',
	/** A stepper's − and + (the tempo). */
	stepper: { slower: 'Slower', faster: 'Faster' },
	upload: {
		title: (pct: number): string => `Uploading… ${pct}%`,
		helper: 'You can keep using the app; closing the tab stops it',
		/** The progress bar's name: `what` is "recording", "videos". */
		bar: (what: string): string => `Uploading ${what}`,
		/** What goes up, for `bar`. */
		nouns: { file: 'file', recording: 'recording', videos: 'videos' },
		/** What Unsaved changes calls an upload in flight. */
		anUpload: 'An upload',
		failed: 'Upload failed.',
		/** A 413: "That file is too large (limit 95 MB)." */
		tooLarge: (limit: string): string => `That file is too large (limit ${limit}).`,
		connection: 'Upload failed — check the connection and try again.',
		/** Under the Android app's upload link. */
		inBackground: 'Compressed and uploaded in the background',
		/** An upload route's refusals: "That file is larger than 95 MB." */
		larger: (limit: string): string => `That file is larger than ${limit}.`,
		empty: 'Empty upload.',
		interrupted: 'The upload was interrupted. Try again.'
	},
	offline: {
		/** The toast when a write can't reach the server: the device's copy is read only. */
		needsConnection: 'Needs a connection. Nothing was changed.',
		/** At the top of a sheet whose actions need a connection (offline phase 3). */
		needsConnectionFor: 'Needs a connection for these'
	}
};
