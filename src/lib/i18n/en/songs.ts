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
		saveFailed: 'That could not be saved.',
		/** The Music actions' refusals (`music-form.ts`, `addMusic`). */
		noteTooLong: 'A note is up to 500 characters.',
		pickSong: 'Pick a song.',
		gone: 'That song was already removed.',
		notYours: 'That is not yours to change.',
		cannotGo: 'That song cannot go here.',
		already: 'Already in Music'
	},
	/** A song's page (`songs/[id]`, `song-page.ts`). */
	page: {
		/** The tab title of a song with no title. */
		untitled: 'Song',
		details: 'Song details',
		editSong: 'Edit song',
		history: 'History',
		stopSharing: 'Stop sharing',
		practise: 'Practice with this song',
		audioMissing: 'The song’s audio file is missing.',
		audioUnplayable: 'This browser can’t play the song’s audio.',
		wouldNotPlay: 'The song would not play.',
		play: 'Play the song',
		pause: 'Pause the song',
		position: 'Position in the song',
		gotIt: 'Got it',
		tapOnOne: 'Tap on the 1',
		/** `tapProblem`'s one refusal, and the line under it. */
		playFirst: 'Play the song first.',
		playFirstBody: 'A tap marks the beat that is playing.',
		guessHint:
			'The count is a guess. Play the song and tap on every “1” you hear until it lines up.',
		slipHint: 'If the count slips after a break, tap the 1 again there.',
		sample: 'Sample',
		/** The sample row: "From 1:04". */
		sampleFrom: (clock: string): string => `From ${clock}`,
		sampleYours: 'Yours',
		sampleSetByYou: 'Set by you',
		sampleAutomatic: 'Automatic',
		sampleAutomaticMeta: 'A third of the way in, on a 1',
		startSampleAt: (clock: string): string => `Start the sample at ${clock}`,
		backToAutomatic: 'Back to automatic',
		countSpeed: 'Count speed',
		countSpeedHelp:
			'If the count runs at half or double your steps, switch it. This clears your taps.',
		tempoFailed: 'Could not change the count speed.',
		yourOnes: 'Your 1s',
		yourOnesCount: (n: number): string => `Your 1s · ${n}`,
		clearAll: 'Clear all',
		removeOneAt: (time: string): string => `Remove the 1 at ${time}`,
		progress: 'Progress',
		laptopNote:
			'It runs on the laptop about once a minute while it is on. This page updates by itself.',
		failedTitle: 'This song failed',
		unknownError: 'Unknown error',
		uploadInstead: 'Upload a file instead',
		/** Where the song came from: "From https://…". */
		from: (url: string): string => `From ${url}`,
		editorsOnly: "Only the group's editors see it",
		shareWithClass: 'Share with the class',
		changeSpeedTitle: 'Change count speed?',
		change: 'Change',
		/** Changing the count speed clears the 1s tapped: one, or `n`. */
		clears: (n: number): string =>
			n === 1 ? 'This clears the 1 you tapped.' : `This clears your ${n} 1s.`,
		archiveTitle: 'Archive this song?',
		archiveBody: (name: string): string =>
			`${name} leaves Music and the song popup. Sets you logged with it stay.`,
		archive: 'Archive',
		archiveSong: 'Archive song',
		saving: 'Saving',
		artist: 'Artist',
		/** A still-being-added song's steps (`songSteps`). */
		steps: {
			added: 'Added',
			uploaded: 'Uploaded',
			fromYouTube: 'From YouTube',
			download: 'Download',
			waitingFetcher: 'Waiting for the home fetcher',
			findBeat: 'Find the beat',
			onLaptop: 'Beat analysis on the laptop',
			downloaded: 'Downloaded',
			waitingAnalysis: 'Waiting for beat analysis'
		},
		/** The page's refusals. */
		noBeats: 'No beats to snap to.',
		badTempo: 'Bad tempo.',
		noTitle: 'Give the song a title (up to 200 characters).',
		longArtist: 'Keep the artist to 200 characters.',
		pickStyle: 'Pick a style.',
		onlyReady: 'Only a ready song can be shared.'
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
