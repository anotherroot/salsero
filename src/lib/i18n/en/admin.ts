// The admin page (/admin): one dance's people, groups, limits, invites and requests.
// Sizes come in as `byteSize` writes them, dates as `dateLabel`/`dayLabel` do.
export const admin = {
	title: 'Admin',
	/** The top line: "Limits add up to 12.0 GB · 8.0 GB free". */
	limitsLine: (sum: string, free: string): string => `Limits add up to ${sum} · ${free} free`,
	/** A preset's button: "2 GB", "0.5 GB". */
	preset: (gb: number): string => `${gb} GB`,
	/** "840 MB of 1.0 GB". */
	usesOf: (used: string, limit: string): string => `${used} of ${limit}`,
	/** "840 MB, no limit". */
	usesNoLimit: (used: string): string => `${used}, no limit`,
	/** A request's lead; `uses` is `usesOf` or `usesNoLimit`. */
	requestUses: (uses: string): string => `Uses ${uses}`,
	/** A person row's second line. */
	personMeta: (date: string, uses: string): string => `Joined ${date} · ${uses}`,
	/** A group row's mark when it is deleted. */
	deleted: 'deleted',
	groupsMade: (made: number, limit: number): string => `Groups made: ${made} · limit ${limit}`,
	/** A person's app in their dance: "Salsa app 2 (Play) · today". */
	app: (dance: string, version: number, play: string, when: string): string =>
		`${dance} app ${version}${play} · ${when}`,
	noApp: (dance: string): string => `${dance}: no app`,
	/** Section labels. */
	waiting: 'Waiting',
	groups: 'Groups',
	noGroups: 'No groups yet.',
	people: 'People',
	/** The invite row, its section and its sheet. */
	inviteSomeone: 'Invite someone',
	inviteSub: 'One link, works once, for 24 hours',
	couldNotInvite: 'Could not make an invite.',
	/** The share sheet's title. */
	shareTitle: 'Join me on the salsa app',
	copied: 'Copied',
	share: 'Share',
	shownOnce: 'Shown once. Opening this again makes a new code.',
	qr: 'QR code for the invite',
	/** The limit fields. `set` is the hidden submit that Enter presses. */
	set: 'Set',
	orGb: 'Or a number of GB',
	limit: 'Limit',
	giveMore: 'Give more',
	decline: 'Decline',
	didNotSave: 'It did not save.',
	setLimit: 'Set limit',
	noLimit: 'No limit',
	setGroupLimit: 'Set group limit',
	groupsTheyMay: 'Groups they may make',
	useDefault: 'Use the default',
	computed: 'Computed',
	/** Names the invite's language choice. */
	inviteLanguage: 'Language of the invite',
	/** Names a person's language select. */
	language: 'Language',
	badLanguage: 'Pick a language.',
	languageFailed: 'The language did not change.',
	/** The actions' refusals. */
	refused: {
		pickRequest: 'Pick a request.',
		badLimit: 'Give a limit in GB, more than zero.',
		requestClosed: 'That request is already closed.',
		personGone: 'That person is gone.',
		groupGone: 'That group is gone.',
		badGroupLimit: 'Give a whole number of groups, 0 or more.'
	}
};
