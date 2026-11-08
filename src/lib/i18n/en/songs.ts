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
	/** A song's page: listening, Edit and sections (spec 2026-11-08). */
	page: {
		section: {
			/** A section with no name yet. */
			unnamed: 'Section',
			/** The section sheet's name chips. A function: the dance's words (Coro, Mambo) are the same in both languages. */
			chips: (): string[] => ['Intro', 'Verse', 'Coro', 'Montuno', 'Mambo', 'Break', 'Outro']
		},
		/** What comes next, under the count. */
		ahead: {
			eights: (name: string, n: number): string =>
				`${name} in ${n} ${n === 1 ? 'eight' : 'eights'}`,
			last: (name: string): string => `${name} after this eight`,
			beats: (name: string, n: number): string => `${name} in ${n} ${n === 1 ? 'beat' : 'beats'}`
		},
		/** The listening page. */
		listen: {
			starts: (at: string): string => `Starts at ${at}, where the music starts.`,
			hint: 'The 1 is a guess from the beat. Set it, and add sections, in Edit ✎.',
			sections: 'Sections',
			tapToJump: 'tap to jump',
			countOff: 'Count off',
			playing: 'Playing',
			next: 'Next',
			sample: 'Sample',
			sampleFrom: (at: string): string => `From ${at}`,
			sampleMeta: '15 seconds',
			jumpTo: (name: string, at: string): string => `Jump to ${name}, ${at}`,
			play: 'Play the song',
			pause: 'Pause the song',
			position: 'Position in the song'
		},
		/** Why an Edit change was not saved. */
		refused: {
			taken: 'Another section starts there',
			ends: 'That is past the end of the song',
			missing: 'That section is gone. Reload the page.',
			badValue: 'That could not be saved.',
			start: 'Pick a time inside the song.',
			beat: 'That beat is not in the song.'
		}
	}
};
