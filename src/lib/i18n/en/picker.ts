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
		`${nouns.slots(slots)}${loops ? ' · loops' : ''}`
};
