// Moves: the three lists (Figures, Routines, the out-of-sync card), a move's page,
// Coverage, the band's switch and the empty pane beside a list. The figure page,
// a routine's page and the positions' screens are areas of their own.
import { plural } from './plural';

export const moves = {
	/** The band's switch (the tab itself is `shell.tabs.moves`). */
	segments: { figures: 'Figures', routines: 'Routines', positions: 'Positions' },
	/** The band's +, by the list it sits over. */
	newFigure: 'New figure',
	newRoutine: 'New routine',
	newPosition: 'New position',
	/** Under a figure row and over the Figures list. */
	row: {
		startsOn: (n: number): string => `Starts on ${n}`,
		noSection: 'No section',
		noLesson: 'No lesson',
		/** A row's "2 copies differ" / "1 copy differs". */
		differ: (n: number): string => plural(n, 'copy differs', 'copies differ')
	},
	heading: {
		/** The owner word before the count: "Yours · 14 figures". */
		yours: 'Yours',
		matching: (n: number): string => plural(n, 'figure matches', 'figures match'),
		unlinked: (n: number): string => `${n} with no section or no lesson`,
		/** Under a move's heading when groups' twins folded into it. */
		alsoIn: (figures: string, groups: string[]): string =>
			`${figures} · also in ${groups.join(', ')}`
	},
	chips: {
		all: 'All',
		unlinked: 'Not linked',
		partner: 'With partner',
		solo: 'Solo'
	},
	/** The dances' style labels that read differently in another language; the rest stay the registry's. */
	styles: {
		other: 'Other',
		dominican: 'Dominican',
		sensual: 'Sensual',
		traditional: 'Traditional'
	} as Record<string, string>,
	/** The Coverage tile's meta. */
	tile: {
		unrouted: (n: number): string => `${n} in no routine`,
		allRouted: 'All in a routine'
	},
	members: {
		hidden: "Members don't see it yet",
		note: 'Anything not in a published lesson stays with the editors. Link it from a lesson and members get it.'
	},
	sync: {
		/** The card's title: "3 figures out of sync". */
		title: (counted: string): string => `${counted} out of sync`,
		meta: "Your copies and the clubs' don't agree",
		allInStep: 'All in step',
		allInStepMeta: 'Nothing differs. Tap to show them all',
		emptyTitle: 'Every copy agrees',
		emptyBody: 'Nothing is out of sync any more.'
	},
	/** The pane beside a list with nothing open (desktop). */
	pane: {
		figures: {
			title: 'Pick a figure',
			body: 'Its timing, recordings and routines open here, beside the list. A move’s name opens the move.',
			group: 'The group’s figures open here.'
		},
		routines: {
			title: 'Pick a routine',
			body: 'Its slots, where it breaks and whether it loops open here, beside the list.',
			group:
				'Sketch a routine first, link it from a lesson later. The editor is the same as for your own.'
		}
	},
	figures: {
		coverage: 'Coverage',
		empty: 'No figures yet',
		emptyBody: 'Add the first one you learned.',
		search: 'Search figures',
		filter: 'Filter figures',
		allLinked: 'All linked',
		allLinkedBody: 'Every figure has a section and a lesson.',
		noMatch: 'No figures match',
		noneOwn: 'No figures of your own yet.',
		adding: 'Adding figure',
		add: 'Add figure',
		recordingsNext: 'You can add recordings next.'
	},
	routines: {
		empty: 'No routines yet',
		emptyBody: 'String some figures together and call them as one.',
		badLoop: 'does not loop',
		fromClass: (label: string): string => `From class ${label}`,
		name: 'Name',
		namePlaceholder: 'Basic combo',
		notes: 'Notes',
		notesPlaceholder: 'What this is for, when to reach for it…',
		creating: 'Creating routine',
		create: 'Create routine'
	},
	move: {
		/** "Move · 3 figures". */
		subtitle: (figures: string): string => `Move · ${figures}`,
		routine: 'Routine',
		lesson: 'Lesson',
		/** The figures a routine uses: "Doble, Básica and Simple". */
		and: (names: string[]): string =>
			names.length <= 1
				? names.join('')
				: `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`,
		rename: 'Rename move',
		renameItem: 'Rename',
		more: 'More',
		newFigure: 'New figure',
		figures: 'Figures',
		usedIn: 'Used in',
		moveName: 'Move name',
		figureName: 'Figure name',
		figurePlaceholder: 'e.g. Doble',
		/** Under New figure: what the new figure starts as. */
		startsAs: (move: string): string =>
			`It starts on 1 and takes 8 counts, in the style of ${move}.`,
		addFigure: 'Add figure'
	},
	coverage: {
		title: 'Coverage',
		subtitle: 'Versions by how many routines use them',
		selected: (n: number): string => `${n} selected`,
		stopSelecting: 'Stop selecting',
		select: 'Select',
		tapInOrder: 'Tap in the order the routine should call them.',
		empty: 'No figures yet',
		isSelected: 'Selected,',
		notSelected: 'Not selected,',
		picked: 'Picked versions',
		pickedLine: (n: number): string =>
			`${plural(n, 'figure', 'figures')}, in the order you picked them. Put them in order on the routine page.`,
		/** The groups' titles. */
		none: 'In no routine',
		one: 'In 1 routine',
		many: 'In 2+ routines'
	},
	/** The actions' refusals, composed in the request. */
	refused: {
		moveName: 'Give the move a name (up to 200 characters).',
		figureName: 'Give the figure a name (up to 200 characters).',
		routineName: 'Give the routine a name (up to 200 characters).',
		notes: 'Notes are up to 2000 characters.',
		partnerStyle: 'Pick how it is danced and its style.',
		pickMove: 'Pick a move.',
		moveTaken: (name: string): string => `There's already a move called ${name}.`,
		figureTaken: (move: string, name: string): string =>
			`${move} already has a figure called ${name}. Rename one first.`,
		pickOne: 'Pick at least one figure.'
	}
};
