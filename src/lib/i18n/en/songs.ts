// Songs: the song field and its "Pick a song" popup, a sample's ▶. Part 2's Music
// area extends this (the list, a song's page, sharing).

export const songs = {
	picker: {
		title: 'Pick a song',
		search: 'Search songs',
		hint: 'hear 15 s · tap a song to pick it',
		/** The count line: "8 songs", or "1 match" while searching. */
		count: (n: number, searching: boolean): string => {
			const word = searching ? 'match' : 'song';
			return n === 1 ? `1 ${word}` : `${n} ${word}${searching ? 'es' : 's'}`;
		},
		noMatch: (query: string): string => `No song matches “${query}”`,
		noMatchBody: 'Once it is added and ready, it shows here.',
		addInMusic: 'Add it in Music',
		recent: 'Recent',
		yours: 'Your songs',
		all: 'All songs A–Z'
	},
	/** A song row's badges (`SongRow`). */
	row: { draft: 'Draft', isNew: 'New' },
	sample: {
		/** Under the song while its sample plays: "Sample from 1:04". */
		from: (clock: string): string => `Sample from ${clock}`,
		play: 'Play a sample',
		playOf: (name: string): string => `Play a sample of ${name}`,
		stop: 'Stop the sample'
	},
	/** A lesson's, drill's or routine's Music list and its sheets (`MusicSection`). */
	music: {
		heading: 'Music',
		add: 'Add a song',
		noteLabel: 'Note',
		notePlaceholder: 'What to practise to it',
		noteHelp: 'Members see it under the song.',
		addButton: 'Add to Music',
		save: 'Save',
		practise: 'Practise to this',
		edit: 'Edit note',
		remove: 'Remove',
		notShared: 'Not shared',
		notSharedLine: "Not shared: members don't see it until it is shared again.",
		pick: 'Pick a song',
		optional: '(optional)',
		/** What "Unsaved changes" calls the note sheet. */
		unsavedLabel: 'A note',
		saveFailed: 'That could not be saved.'
	},
	/** The Music tab's list (`MusicList`, `library.ts`) and its empty pane. */
	list: {
		/** A song with no title and no link. */
		untitled: 'Untitled song',
		/** A search's heading: "3 matches · title or artist". */
		searchHeading: (n: number): string => `${n} ${n === 1 ? 'match' : 'matches'} · title or artist`,
		beingAdded: (n: number): string => `Being added · ${n}`,
		allAZ: (n: number): string => `All songs A–Z · ${n}`,
		drafts: (n: number): string => `Drafts · ${n}`,
		sharedWithClass: (n: number): string => `Shared with the class · ${n}`,
		/** A shared song's meta in group mode ends "· used by 4". */
		usedBy: (n: number): string => `used by ${n}`,
		waitingDownload: 'Waiting to download',
		findingBeat: 'Finding the beat',
		failed: 'Failed',
		/** `error` is the worker's own words. */
		failedWith: (error: string): string => `Failed: ${error}`,
		countOnly: 'Count only',
		countOnlyClave: 'The count and clave, no song',
		countOnlyPlain: 'The count, no song',
		/** The Count only row's group. */
		practice: 'Practice',
		retry: 'Retry',
		retryOf: (name: string): string => `Retry ${name}`,
		retryFailed: 'Could not retry.',
		workerTitle: 'Runs on the laptop at home',
		workerBody: 'Downloads and beat analysis happen about once a minute while it is on.',
		noMatchBody: 'Add it with the + above.',
		emptyClassTitle: 'No class songs yet',
		emptyClassBody:
			"Add one from YouTube or upload an audio file. It stays a draft, seen only by the group's editors, until you share it with the class.",
		emptyTitle: 'No songs yet',
		emptyBody:
			'Add one from YouTube or upload an audio file. The laptop at home downloads it and finds the beat.',
		/** The pane beside the list with no song open (desktop). */
		paneBody: 'Its count, the 1s you tapped and its sample open here, beside the list.',
		paneCountOnly: 'Practice with the count only'
	},
	/** The Add a song sheet, and the upload's own words. */
	add: {
		youtubeLink: 'YouTube link',
		title: 'Title',
		titlePlaceholder: 'Song title',
		style: 'Style',
		submit: 'Add song',
		adding: 'Adding song',
		or: 'or',
		uploadFile: 'Upload an audio file',
		oneAtATime: 'One upload at a time — wait for the one already going.',
		upTo: (limit: string): string => `Up to ${limit}. It gets the style above.`,
		/** Refused before uploading: "That file is 120 MB; the limit is 95 MB." */
		tooLarge: (mb: string, limit: string): string =>
			`That file is ${mb} MB; the limit is ${limit}.`,
		audioOnly: 'Only audio files can be added.',
		/** Under the upload's bar: "Uploading · 6 of 9.7 MB · keep the app open". */
		progress: (loaded: string, total: string): string =>
			`Uploading · ${loaded} of ${total} MB · keep the app open`,
		percent: (n: number): string => `${n}%`,
		failed: (reason: string): string => `Upload failed: ${reason}`,
		/** Add song's and Retry's refusals. */
		badUrl: 'Paste a full link, starting with https://',
		longTitle: 'Keep the title to 200 characters.',
		onlyFailed: 'Only a failed song can be retried.'
	},
	/** A group song: who sees it, and Stop sharing's and Delete's questions. */
	share: {
		classSongNote: (group: string): string => `${group}'s song. The count is the teacher's.`,
		usedIn: (n: number): string => `Used in ${n === 1 ? '1 person' : `${n} people`}'s practice.`,
		untilShared: "They'll switch to count only until you share it again.",
		untilRestored: "They'll switch to count only until you restore it.",
		stopTitle: (name: string): string => `Stop sharing ${name}?`,
		deleteTitle: (name: string): string => `Delete ${name}?`,
		stopLead: 'Members no longer see it, and it is a draft again.',
		deleteLead: 'It goes to Recently deleted for 30 days.'
	}
};
