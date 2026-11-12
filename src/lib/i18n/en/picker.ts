// The shared picker's own words: the create row, Done, the empty box, a refused link,
// a row's controls, and the group titles and second lines the builders give every list.
// What a list is called and searched for is its page's (each page passes its own).
import { nouns } from './nouns';

export const picker = {
	/** The create row's lead-in once something is typed: "Not in the list? Create “dob” as". */
	createLead: (typed: string): string => `Not in the list? Create “${typed}” as`,
	/** …and before anything is typed. */
	createLeadBare: 'Not in the list?',
	/** A link picker's Done: what + linked. */
	doneLinked: (n: number): string => `Done · ${n} linked`,
	/** A field picker's Done: what it holds. */
	doneField: (n: number): string => `Done · ${n}`,
	/** The empty box when the search found nothing. */
	noMatch: (typed: string): string => `Nothing matches “${typed}”.`,
	/** A refused link the server said nothing about, named by its row. */
	notLinked: (label: string): string => `${label} was not linked. Try it again.`,
	tryAgain: 'Try it again.',
	/** A section row's preview button. */
	play: (label: string): string => `Play ${label}`,
	/** A link row's +. */
	addKeep: (label: string): string => `Link ${label} and keep picking`,
	/** The spinner in place of a + in flight. */
	linking: (label: string): string => `Linking ${label}`,
	linked: 'Linked',
	/** The skeleton list, for a screen reader. */
	loading: 'Loading',
	/** The refused link's banner. */
	refused: 'That could not be linked.',
	restore: 'Restore',
	restoring: 'Restoring…',
	pickAnother: 'Pick another',
	creating: 'Creating…',
	/** A many-value field's create, refused. */
	notCreated: 'That could not be created.',
	/** The Move field (New figure, the Link popup, a lesson): a move picked, or a new one typed. */
	moveField: {
		label: 'Move',
		placeholder: 'Choose or type a move…',
		title: 'Choose a move',
		search: 'Search or name a new move',
		none: 'There are no moves yet. Type a name to make one.',
		/** After a typed name in the field: what it will make. */
		tag: 'New move',
		/** The picker's group of moves. */
		group: 'Moves'
	},
	/** Link from other places: a group's pickers, while searching (spec 2026-11-10). */
	elsewhere: {
		yours: 'Yours',
		/** A group you only read, as its heading. */
		readOnly: (name: string): string => `${name} · you only read it`,
		/** A row whose family lives in other places too. */
		alsoIn: (names: string): string => `also in ${names}`,
		/** A row whose name the group already has, from another family. */
		hasOwn: 'This group has its own',
		/** The group's own rows, when none match. */
		noneHere: (typed: string): string => `Nothing here matches “${typed}”.`,
		offline: 'Other places need a connection.',
		looking: 'Looking in your other places…',
		/** A row's +. */
		copyHere: (label: string): string => `Copy ${label} here and link`,
		/** A move found elsewhere, in New figure's Move field: a pick makes one of that name here. */
		newMove: 'A new move here, same name'
	},
	/** The builders' group titles. */
	groups: {
		figures: 'Figures',
		routines: 'Routines',
		drills: 'Drills',
		lessons: 'Lessons',
		positions: 'Positions',
		otherVideos: 'Other videos'
	},
	/** A routine row's second line: "4 slots · loops", "1 slot". */
	routineMeta: (slots: number, loops: boolean): string =>
		`${nouns.slots(slots)}${loops ? ' · loops' : ''}`,
	/** Picker preview: a figure's picture on its row, and the sheet it opens. */
	look: {
		/** The picture's button, named by its row. */
		preview: (label: string): string => `Preview ${label}`,
		/** The sheet's main button: what a tap on the row does (link, slot, field picker). */
		linkThis: 'Link this',
		addThis: 'Add this',
		pickThis: 'Pick this',
		/** Over the start positions: "Starts on 1", "Starts on 1/5". */
		startsOn: (count: string): string => `Starts on ${count}`,
		/** Over the end positions. */
		endsAfter: (n: number): string => `Ends after ${nouns.counts(n)}`,
		/** Over the end positions when a routine slot sets the length. */
		ends: 'Ends',
		noPositions: 'No positions set',
		noVideo: 'No video yet',
		/** Under the video: it is one of the figure's own recordings. */
		yourRecording: 'Your recording',
		soundOn: 'Turn the sound on',
		soundOff: 'Turn the sound off',
		/** A move's sheet, after its first variations. */
		andMore: (n: number): string => `and ${n} more`,
		failed: 'This could not be loaded.'
	}
};
