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
			added: 'Section added',
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
		/** Edit: the Grid and Song tabs, saving as you go. */
		edit: {
			open: 'Edit the song',
			subtitle: 'Editing · saves as you go',
			leave: 'Leave Edit',
			tabs: 'Edit',
			grid: 'Grid',
			song: 'Song',
			speed: {
				title: 'Count speed',
				help: 'If the count runs at half or double your steps, switch it.',
				askTitle: 'Change count speed?',
				ask: (n: number, factor: string): string =>
					`Counting at ${factor} clears ${n === 1 ? 'the 1 you set' : `your ${n} 1s`}. Your sections stay, each on its nearest 1.`,
				change: 'Change',
				done: (factor: string): string => `Counting at ${factor}`
			},
			sample: {
				title: 'Sample',
				from: (at: string): string => `From ${at}`,
				automatic: 'Automatic',
				yours: 'Yours',
				autoMeta: 'A third of the way in, on a 1',
				yoursMeta: 'Set by you',
				here: 'Start the sample here',
				hereMeta: (at: string): string => `At ${at}, the 1 before where it is now`,
				back: 'Back to automatic',
				doneHere: (at: string): string => `The sample starts near ${at}`,
				doneBack: 'The sample is automatic again'
			},
			start: {
				title: 'Music starts',
				at: (at: string): string => `At ${at}`,
				found: 'Found by the home box',
				yours: 'Yours',
				unmeasured: 'Not measured yet',
				fromZero: 'Plays from 0:00',
				here: 'Start it here',
				hereMeta: (at: string): string => `At ${at}, where it is now`,
				zero: 'From 0:00',
				zeroMeta: 'Play the whole file',
				back: 'Back to what was found',
				doneHere: (at: string): string => `The song starts at ${at}`,
				doneZero: 'The song plays from 0:00',
				doneBack: 'Back to where the music starts'
			},
			details: 'Song details',
			detailsMeta: 'Title, artist and style',
			clear: {
				ones: 'Clear all 1s',
				onesMeta: (n: number): string => `${n} set by you`,
				sections: 'Clear all sections',
				sectionsMeta: (n: number): string => `${n} ${n === 1 ? 'section' : 'sections'}`,
				doneOnes: 'All 1s cleared',
				doneSections: 'All sections cleared'
			}
		},
		/** Edit · Grid: the whole song's count. */
		grid: {
			label: 'The song’s count, a row per eight',
			beat: (at: string, n: number, section: string | null): string =>
				section ? `${at}, beat ${n} of ${section}` : `${at}, beat ${n}`,
			off: (at: string, section: string): string => `${at}, ${section}`,
			yours: 'your 1',
			short: (n: number): string => `+${n} ${n === 1 ? 'beat' : 'beats'}`,
			countOff: 'Count off',
			editSection: (name: string): string => `Edit ${name}`,
			before: (from: string, to: string, eights: number): string =>
				`Before the music · ${from}–${to} · ${eights} ${eights === 1 ? 'eight' : 'eights'}`,
			musicStarts: (at: string): string => `Music starts · ${at}`,
			moveStart: 'Move where the music starts',
			hint: 'Play, and tap on every 1. Tap a beat to jump there; hold it for more.'
		},
		/** Tap on the 1, and the beat menu. */
		tap: {
			button: 'Tap on the 1',
			got: 'Got it',
			playFirst: 'Play the song first.',
			playFirstBody: 'A tap marks the beat that is playing.',
			toast: (at: string, shift: number): string =>
				shift === 0
					? `1 set at ${at}. The count from here didn't change.`
					: `1 set at ${at}. The count from here moved ${shift} ${shift === 1 ? 'beat' : 'beats'}.`,
			before: 'Before'
		},
		menu: {
			beat: (n: number, section: string | null): string =>
				section ? `beat ${n} of ${section}` : `beat ${n}`,
			one: 'Make this the 1',
			section: 'Start a section here',
			remove: 'Remove this 1',
			start: 'Start the song here',
			removed: (at: string): string => `The 1 at ${at} is removed`,
			close: 'Close the menu'
		},
		suggest: {
			line: (at: string, n: number, later: boolean): string =>
				`The beat suggests the 1 is here from ${at}, ${n} ${n === 1 ? 'beat' : 'beats'} ${later ? 'later' : 'earlier'}. It can't tell a 1 from a 5.`,
			use: 'Use it',
			notNow: 'Not now'
		},
		plusSection: 'Section',
		plusSectionLabel: 'Start a section at this eight',
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
