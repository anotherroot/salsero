// Sync (offline phase 3): the band's status, the Sync page, the Waiting badge,
// and Sign out's question when changes have not synced.

export const sync = {
	title: 'Sync',
	status: {
		/** The band's subtitle ends in "· 3 waiting". */
		waiting: (n: number): string => `${n} waiting`,
		/** The band's pill. */
		refused: (n: number): string => `${n} couldn't sync`,
		signIn: 'Sign in to sync'
	},
	refusedHeading: "Couldn't sync",
	waitingHeading: 'Waiting',
	retry: 'Retry',
	discard: 'Discard',
	compare: 'Compare',
	discardTitle: 'Discard this change?',
	discardBody: 'It was never saved on the server.',
	discardMore: (n: number): string =>
		n === 1 ? 'The change waiting for it goes too.' : `The ${n} changes waiting for it go too.`,
	held: 'Waits for the change above',
	lastSynced: (when: string): string => `Last synced ${when}`,
	never: 'Not synced yet',
	tryNow: 'Try now',
	allSynced: 'Everything is synced.',
	signIn: 'Sign in',
	waitingBadge: 'Waiting',
	reason: {
		gone: 'It was archived or deleted meanwhile.',
		clash: (by: string | null): string =>
			by ? `${by} changed it meanwhile.` : 'Someone changed it meanwhile.',
		stale: 'The app was updated since.',
		access: 'You can no longer change it.',
		error: 'The server could not save it.',
		notAllowed: 'It needs a connection.',
		badIds: "It doesn't fit what the server has."
	},
	label: {
		/** "Log · Enchufla drill · Tue 10:04". */
		log: (thing: string, when: string): string => `Log · ${thing} · ${when}`,
		note: (thing: string): string => `Note on ${thing}`,
		name: (thing: string): string => `Name of ${thing}`,
		new: (thing: string): string => `New · ${thing}`,
		removed: (thing: string): string => `Removed · ${thing}`,
		edit: (thing: string): string => `Change to ${thing}`,
		comment: (thing: string): string => `Comment on ${thing}`,
		heart: 'A heart on a comment',
		other: 'A change'
	},
	signOut: {
		title: (n: number): string =>
			n === 1 ? "1 change hasn't synced" : `${n} changes haven't synced`,
		body: 'Sign out and lose them?',
		confirm: 'Sign out'
	}
};
