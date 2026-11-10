// Send feedback (a row on You and Settings, its sheet) and the admin's list of
// what testers sent (/admin). Names of systems and browsers stay as they are.

export const feedback = {
	/** The label over the row on Settings. */
	section: 'Feedback',
	/** The row on You and Settings. */
	row: 'Send feedback',
	rowSub: 'Something not working, or missing?',
	/** The sheet. */
	title: 'Send feedback',
	intro:
		'Say what you did and what happened. The page you were on, the app version and your phone or browser are sent with it.',
	label: 'Your message',
	placeholder: 'I tapped … and then …',
	send: 'Send',
	sending: 'Sending',
	sent: 'Thank you! Sent.',
	couldNotSend: 'It did not send. Try again.',
	/** The card after a screenshot in the Android app. */
	offer: {
		title: 'Something wrong here?',
		sub: 'Send this screenshot with a note',
		report: 'Report',
		close: 'Not now'
	},
	/** The screenshot tile at the top of the sheet. */
	shot: {
		title: 'Screenshot of this screen',
		picked: 'Your screenshot',
		goes: 'Goes with your message',
		remove: 'Remove the screenshot',
		add: 'Add a screenshot',
		addSub: 'From your photos or files',
		unreadable: 'That picture could not be opened.'
	},
	refusals: {
		empty: 'Write something first.',
		tooLong: 'That is too long: 4000 characters at most.'
	},
	/** The admin page's section and each message's lines. */
	admin: {
		section: 'Feedback',
		/** The Admin row's line on Settings while messages wait. */
		waiting: (n: number): string => (n === 1 ? '1 new message' : `${n} new messages`),
		none: 'No feedback yet.',
		done: 'Done',
		reopen: 'Open again',
		showDone: (n: number): string => `Done (${n})`,
		hideDone: 'Hide done',
		/** "Sent 10 Nov, 13:04". */
		sent: (when: string): string => `Sent ${when}`,
		page: (path: string): string => `Page: ${path}`,
		trail: (paths: string): string => `Before: ${paths}`,
		errors: 'Errors on the page',
		/** The Android app: "Android app 9 (Play)". */
		app: (version: number, play: string): string => `Android app ${version}${play}`,
		inBrowser: 'In a browser',
		window: (size: string): string => `Window ${size}`,
		/** The site's build: "Site of 10 Nov, 08:05". */
		site: (when: string): string => `Site of ${when}`,
		/** The screenshot on a message, and its full view. */
		shot: 'Screenshot',
		shotOf: (who: string): string => `Screenshot from ${who}`,
		didNotSave: 'It did not save.',
		gone: 'That message is gone.'
	}
};
