// Songs: the song field and its "Pick a song" popup, a sample's ▶. Part 2's Music
// area extends this (the list, a song's page, sharing).

export const songs = {
	/** Where a song's audio came from, and changing it (song page, Song details, `AudioFrom`, `AudioSwap`). */
	source: {
		from: 'From',
		fromSpotify: 'From Spotify',
		findOnYouTube: 'Find it on YouTube',
		fromVideo: 'From the video it finds',
		findingIt: 'Finding it on YouTube',
		youtubeAudio: 'YouTube · the audio',
		audioFrom: 'Audio from',
		useAnother: 'Use another YouTube link',
		useLink: 'Use a YouTube link',
		anotherLabel: 'Another YouTube link',
		swapHelp:
			'The song downloads again and its beat is found again. The 1s you tapped are cleared.',
		downloadThis: 'Download this one',
		cancel: 'Cancel',
		askTitle: 'Download the audio again?',
		askCopies: (n: number): string =>
			n === 1
				? 'This song gets the audio from the new link, and so does 1 copy kept in step with it.'
				: `This song gets the audio from the new link, and so do ${n} copies kept in step with it.`,
		askSelf: 'This song gets the audio from the new link.',
		askBody:
			'The beat is found again, and the 1s tapped for the count are cleared, so the count needs tapping again.',
		download: 'Download'
	},
	/** Add a song's link field (`AddSongSheet`, the list's `addUrl`). */
	add: {
		label: 'YouTube or Spotify link',
		/** Until playlists come (plan 2), the help line says one song. */
		helpOne: 'One song from YouTube or Spotify.',
		help: 'A song, a playlist or an album. From a playlist you pick which songs to add.',
		notSong: 'Paste a song, playlist or album',
		listsSoon: "Playlists come in the next update. Paste one song's link for now.",
		shortFailed: 'Paste the full open.spotify.com link'
	},
	/** Use another YouTube link (`AudioSwap`, the song page's `audio`). */
	audio: {
		notYouTube: 'Paste a YouTube video link',
		busy: 'Wait until this song has finished downloading.',
		upload: 'An uploaded song has no link to change.'
	},
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
	}
};
