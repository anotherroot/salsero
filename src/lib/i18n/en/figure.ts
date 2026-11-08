// The figure page: the facts, Recordings and its sheets, the three rows, the
// switcher, New figure, Move to…, Archive, edit mode and the page's refusals.
// A move's page and the lists are `moves`; the positions' words are `positions`.
import { plural } from './plural';

/** "Salsa Tuesdays’", "Ana’s": an English possessive (`positions` reads it too). */
export const possessive = (name: string): string => {
	const n = name.trim();
	return /s$/i.test(n) ? `${n}’` : `${n}’s`;
};

export const figure = {
	/** The band's subtitle: "Figure · starts on 1 · 16 counts". */
	subtitle: {
		figure: 'Figure',
		teamFigure: (team: string): string => `${possessive(team)} figure`,
		timing: (lead: string, start: number, length: number): string =>
			`${lead} · starts on ${start} · ${length} counts`,
		editing: (variation: string): string => `Editing ${variation}`
	},
	/** The facts card and a sibling's line: "Starts on 1 · 16 counts". */
	timing: {
		label: 'Timing',
		line: (start: number, length: number): string => `Starts on ${start} · ${length} counts`,
		oneEight: ' · one 8-count',
		eights: (n: number): string => ` · ${n} eights`,
		/** The eight count chips, for a screen reader. */
		startsOnCount: (n: number): string => `Starts on count ${n}`
	},
	facts: 'Facts',
	positions: 'Positions',
	noPosition: 'No position',
	/** Between two positions of one side: "Cerrada or Abierta". */
	or: 'or',
	notes: {
		placeholder: 'Count, hand holds, what the teacher said…'
	},
	/** The edit form's fields (FigureFields, also the New move sheet's). */
	fields: {
		figurePlaceholder: 'e.g. Basic, Doble, From cross',
		danced: 'Danced',
		style: 'Style'
	},
	/** Starts on and Counts (FigureTiming). */
	length: {
		startsOn: 'Starts on',
		counts: 'Counts',
		/** The unit inside the field. */
		unit: 'counts',
		help: (max: number): string => `How long it takes, 1 to ${max}. One 8-count is 8.`,
		error: (max: number): string => `1 to ${max} counts. One 8-count is 8.`,
		shortcuts: 'Length shortcuts'
	},
	edit: {
		stop: 'Stop editing',
		/** What Unsaved changes calls the edit form: "Doble edits". */
		label: (variation: string): string => `${variation} edits`,
		notSaved: 'It did not save.'
	},
	/** The practice line and the reader's pinned row. */
	practice: {
		doneToday: 'Done today',
		paused: "Paused · not on Today's list",
		/** The ⋯'s Its exercise line when there is no schedule yet. */
		fallback: 'Practice',
		practise: 'Practise',
		adding: 'Adding to Today…',
		addFailed: 'Could not add it to Today.',
		added: 'On Today now',
		open: 'Open'
	},
	/** The page's own ⋯ items. */
	menu: {
		exercise: 'Its exercise',
		create: 'Create exercise',
		createMeta: 'Put it on Today on its own',
		history: 'History',
		move: 'Move to another move…',
		moveMeta: 'Or a new move of its own',
		archive: (variation: string): string => `Archive ${variation}`
	},
	archive: {
		title: (variation: string): string => `Archive ${variation}?`,
		button: (variation: string): string => `Archive ${variation}`,
		buttonLast: 'Archive and remove move',
		kept: 'Its recordings and practice history are kept.',
		captionLast: (move: string, variation: string): string =>
			`${move} goes with it: ${variation} is its last figure.`,
		caption: (move: string, variation: string): string => `${variation} leaves ${move}.`
	},
	/** The warning when the last figure goes (a move, an archive). */
	remove: {
		title: (move: string): string => `${move} will be removed`,
		body: (variation: string): string =>
			`${variation} is its last figure, and a move with no figures is gone. It leaves the Figures list.`,
		kept: ' Its recordings and practice history are kept.'
	},
	recordings: {
		title: 'Recordings',
		titleCount: (n: number): string => `Recordings · ${n}`,
		addLabel: 'Add to Recordings',
		addVideo: 'Add video',
		video: 'Video',
		audio: 'Audio',
		fromYouTube: 'From YouTube',
		/** A recording's caption and the player's subtitle. */
		recording: 'Recording',
		/** "Recording · Enchufla · Doble", "Recording · Wednesday, 28 October". */
		recordingOf: (what: string): string => `Recording · ${what}`,
		/** A recording's day in another year: "Wednesday, 28 October, 2025". */
		dayWithYear: (day: string, year: string): string => `${day}, ${year}`,
		missing: 'This file is missing',
		unplayable: 'Can’t play here',
		play: (day: string): string => `Play the recording from ${day}`,
		playLabel: (label: string): string => `Play ${label}`,
		/** The audio element's name. */
		from: (day: string): string => `The recording from ${day}`,
		download: 'Download',
		openOnYouTube: 'Open on YouTube',
		/** The variation bar's sheet: "no recordings", "3 recordings". */
		none: 'no recordings',
		unlink: 'Unlink',
		unlinkLabel: (section: string, figure: string): string => `Unlink ${section} from ${figure}`,
		notDeleted: 'Not deleted',
		deleteLabel: 'Delete this recording',
		deleteTitle: 'Delete this recording?',
		/** The delete question's body: "Wednesday, 28 October · 24 MB. …". */
		deleteBody: (day: string, size: string, goes: string): string =>
			`${day} · ${size}. ${goes}This can’t be undone.`,
		/** The saved sections that go with it, ending in a space; none says nothing. */
		sectionsGo: (n: number): string =>
			n === 0
				? ''
				: n === 1
					? 'Its 1 saved section goes with it. '
					: `Its ${n} saved sections go with it. `,
		waitUpload: 'Wait for the upload to finish'
	},
	/** Recordings' + Add sheet. */
	add: {
		title: (figure: string): string => `Add to ${figure}`,
		section: 'Link a section',
		sectionMeta: 'A part of a lesson video',
		video: 'Video from the phone',
		link: 'Link',
		linkMeta: 'YouTube or any web page'
	},
	/** A link as a row of Recordings. */
	links: {
		saving: 'Saving at 480p…',
		failed: (why: string): string => `Couldn’t save: ${why}`,
		unknownError: 'unknown error',
		remove: (title: string): string => `Remove ${title}`,
		saveLabel: (title: string): string => `Save ${title} as a video`,
		retryLabel: (title: string): string => `Retry saving ${title}`,
		retry: 'Retry'
	},
	/** Follows from, Leads to, In routines. */
	relations: {
		follows: 'Follows from',
		leads: 'Leads to',
		routines: 'In routines',
		/** "In 10 routines": the sheet's title. */
		inRoutines: (n: number): string => `In ${plural(n, 'routine', 'routines')}`,
		none: 'None',
		label: 'Moves and routines around this figure',
		loops: 'loops',
		searchRoutines: 'Search routines',
		searchFigures: 'Search figures',
		noRoutine: 'No routine matches.',
		noFigure: 'No figure matches.',
		/** "Slot 3 of 6". */
		slot: (n: number, of: number): string => `Slot ${n} of ${of}`,
		/** "Slots 2 and 5 of 8", "Slots 1, 4 and 6 of 9". */
		slots: (slots: number[], of: number): string =>
			`Slots ${slots.slice(0, -1).join(', ')} and ${slots[slots.length - 1]} of ${of}`
	},
	taughtIn: (n: number): string => `Taught in · ${n}`,
	/** The switcher at the bottom, its list and the desktop's tabs. */
	switcher: {
		/** "2 of 3 figures". */
		position: (i: number, count: number): string =>
			`${i} of ${count} ${count === 1 ? 'figure' : 'figures'}`,
		previous: 'Previous figure',
		next: 'Next figure',
		/** The bar's and the list sheet's name: "Figures of Enchufla". */
		of: (move: string): string => `Figures of ${move}`,
		/** The desktop tabs' name: "Enchufla: figures". */
		tabs: (move: string): string => `${move}: figures`,
		/** The tabs' "+ Figure". */
		tab: 'Figure',
		open: (move: string): string => `Open ${move}`,
		/** New figure's sub: "of Enchufla". */
		newOf: (move: string): string => `of ${move}`,
		namePlaceholder: 'e.g. Doble, From cross',
		copyOf: (variation: string): string =>
			`It starts as a copy of ${variation} — handholds, timing and notes, not its recordings. Change them with Edit.`
	},
	/** Move to… */
	moveTo: {
		title: (variation: string): string => `Move “${variation}” to…`,
		label: (variation: string): string => `Moving ${variation}`,
		ownMove: 'A new move of its own',
		ownMoveMeta: (variation: string): string => `${variation} becomes its first figure`,
		newName: 'New move’s name',
		join: 'Or join a move',
		noOthers: 'There are no other moves yet.',
		move: 'Move',
		choose: 'Choose a move…',
		pickTitle: 'Join a move',
		search: 'Search moves',
		moves: 'Moves',
		nameIn: (move: string): string => `Name in ${move}`,
		ctaLast: 'Move and remove move',
		ctaTo: (move: string): string => `Move to ${move}`,
		ctaOwn: 'Make it its own move',
		clash: (move: string, name: string): string =>
			`${move} already has a ${name}. Pick another name.`
	},
	/** The page's refusals, composed in the request. */
	refused: {
		notAdded: 'Add a lesson with this figure to practise it.',
		names: 'Give the figure a name (up to 200 characters).',
		timing: (max: number): string =>
			`A figure starts on a count from 1 to 8 and takes 1 to ${max} counts.`,
		newMoveName: 'Give the new move a name (up to 200 characters).',
		pickTarget: 'Pick where to move it.',
		sameMove: (variation: string, move: string): string =>
			`${variation} is already a figure of ${move}.`,
		alreadyPractised: 'This figure is already practised on its own.',
		recordingGone: 'That recording was already removed.',
		pickSection: 'Pick a section.',
		linkGone: 'That link was already removed.',
		/** The recordings upload (its card shows the message). */
		onlyMedia: 'Only video and audio files can be uploaded.'
	}
};
